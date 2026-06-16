/**
 * No Limits — Booking tab → dashboard push (Google Apps Script).
 *
 * Bound to the "No Limits & RRR Removals" spreadsheet (a DIFFERENT spreadsheet
 * from the Follow-Up one, so this is its own Apps Script project). Reads the
 * "Booking" tab and POSTs recent + upcoming bookings to /api/ingest/bookings.
 *
 * It needs its own DASHBOARD_URL + INGEST_SECRET script properties (same values
 * as the other scripts). After pasting, run installBookingTriggers() once.
 *
 * Only the last WINDOW_DAYS of move dates (plus all future) are sent; the
 * dashboard side skips non-NL/RRR/PM companies and any sales rep that isn't a
 * roster rep or the subcontractor "Domanic".
 */

var BOOK_TAB = "Booking";
var HEADER_ROWS = 2; // real headers are on row 2; data starts row 3
var WINDOW_DAYS = 90;
var BATCH = 300;

// 0-based column indexes within the row (col A = 0).
var COL = {
  company: 2, // C
  date: 4, // E (a Date cell)
  job: 5, // F
  leadFrom: 6, // G
  sales: 7, // H
  name: 10, // K
  phone: 11, // L
  email: 13, // N
  pickup: 14, // O
  delivery: 15, // P
  state: 16, // Q
  beds: 20, // U
  cubic: 21, // V
  men: 22, // W
  notes: 26, // AA
  deposit: 27, // AB
};

function pushBookings() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("DASHBOARD_URL");
  var secret = props.getProperty("INGEST_SECRET");
  if (!url || !secret) {
    throw new Error("Set DASHBOARD_URL and INGEST_SECRET in Project Settings → Script Properties.");
  }
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(BOOK_TAB);
  if (!sheet) throw new Error('Tab "' + BOOK_TAB + '" not found.');
  var tz = ss.getSpreadsheetTimeZone() || "Australia/Sydney";

  var lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROWS) return "no rows";
  var values = sheet.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, 28).getValues();

  var cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  var nowd = new Date();
  var thisMonth = Utilities.formatDate(nowd, tz, "yyyy-MM");
  // Pipeline window = this month + the next two (e.g. Jun, Jul, Aug).
  var pipeMonths = {};
  for (var k = 0; k < 3; k++) {
    pipeMonths[Utilities.formatDate(new Date(nowd.getFullYear(), nowd.getMonth() + k, 1), tz, "yyyy-MM")] = 1;
  }

  var rows = [];
  var monthCounts = {}; // sales person -> rows with a move date this month
  var pipelineCounts = {}; // sales person -> rows with a move date in the next 3 months
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    var job = String(v[COL.job] || "").trim();
    var date = v[COL.date];
    if (!(date instanceof Date) || isNaN(date.getTime())) continue;

    // Tallies: every row with a sales person, by the month of its move date
    // (raw row count — the number the floor watches, not deduped by job).
    var sales = String(v[COL.sales] || "").trim();
    if (sales) {
      var ym = Utilities.formatDate(date, tz, "yyyy-MM");
      if (ym === thisMonth) monthCounts[sales] = (monthCounts[sales] || 0) + 1;
      if (pipeMonths[ym]) pipelineCounts[sales] = (pipelineCounts[sales] || 0) + 1;
    }

    if (!job || date < cutoff) continue; // bookings sync: recent + upcoming only
    rows.push({
      jobNumber: job,
      company: String(v[COL.company] || "").trim(),
      moveDate: Utilities.formatDate(date, tz, "yyyy-MM-dd"),
      salesPerson: String(v[COL.sales] || "").trim(),
      customerName: String(v[COL.name] || "").trim(),
      customerPhone: String(v[COL.phone] || "").trim(),
      customerEmail: String(v[COL.email] || "").trim(),
      pickup: String(v[COL.pickup] || "").trim(),
      delivery: String(v[COL.delivery] || "").trim(),
      state: String(v[COL.state] || "").trim(),
      beds: v[COL.beds],
      cubic: v[COL.cubic],
      men: v[COL.men],
      deposit: v[COL.deposit],
      leadSource: String(v[COL.leadFrom] || "").trim(),
      notes: String(v[COL.notes] || "").trim(),
    });
  }

  // Push the month tally first so the board's headline total is right even if
  // the bigger bookings sync below is slow.
  var monthlyRes = UrlFetchApp.fetch(url.replace(/\/$/, "") + "/api/ingest/monthly", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret },
    payload: JSON.stringify({ month: thisMonth, counts: monthCounts, pipeline: pipelineCounts }),
    muteHttpExceptions: true,
  });
  if (monthlyRes.getResponseCode() >= 300) {
    throw new Error("Monthly ingest failed " + monthlyRes.getResponseCode() + ": " + monthlyRes.getContentText());
  }

  var endpoint = url.replace(/\/$/, "") + "/api/ingest/bookings";
  var sent = 0;
  for (var b = 0; b < rows.length; b += BATCH) {
    var batch = rows.slice(b, b + BATCH);
    var res = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + secret },
      payload: JSON.stringify({ rows: batch }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) {
      throw new Error("Bookings ingest failed " + res.getResponseCode() + ": " + res.getContentText());
    }
    sent += batch.length;
  }
  return "sent " + sent + " booking rows";
}

function onBookingEdit(e) {
  if (e && e.range && e.range.getSheet().getName() !== BOOK_TAB) return;
  pushBookings();
}

/** Run once to (re)install the booking edit + 15-minute triggers. */
function installBookingTriggers() {
  var ours = { onBookingEdit: true, pushBookings: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (ours[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onBookingEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushBookings").timeBased().everyMinutes(15).create();
}
