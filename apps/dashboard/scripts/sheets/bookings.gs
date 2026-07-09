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
  // Revenue: the rep's NET take = total (AT) minus the extra charges that don't
  // go to the sales rep (AK, AL, AM, BB).
  total: 45, // AT
  extra1: 36, // AK
  extra2: 37, // AL
  extra3: 38, // AM
  extra4: 53, // BB
};

// We must read out to col BB (54) for the revenue maths.
var LAST_COL = 54;

/** Parse a money-ish cell (number, or "$1,234.50" text) to a number; blank → 0. */
function bookNum_(v) {
  if (v === "" || v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

/**
 * The month/pipeline/revenue tally only needs 7 of the sheet's 54 columns. Read
 * as separate single-column getValues() calls (same pattern as inspectors.gs)
 * instead of folding it into the big all-columns read below — this sheet is
 * large enough that a single full-width read across every row can time out,
 * and when it does, the tally must NOT go down with it (see pushBookings()).
 */
function pushMonthlyTally_(sheet, tz, firstRow, n) {
  var nowd = new Date();
  var thisMonth = Utilities.formatDate(nowd, tz, "yyyy-MM");
  // Pipeline window = this month + the next two (e.g. Jun, Jul, Aug — counts ALL
  // of the current month, including days before today).
  var pipeMonths = {};
  for (var k = 0; k < 3; k++) {
    pipeMonths[Utilities.formatDate(new Date(nowd.getFullYear(), nowd.getMonth() + k, 1), tz, "yyyy-MM")] = 1;
  }

  var dateCol = sheet.getRange(firstRow, COL.date + 1, n, 1).getValues();
  var salesCol = sheet.getRange(firstRow, COL.sales + 1, n, 1).getValues();
  var totalCol = sheet.getRange(firstRow, COL.total + 1, n, 1).getValues();
  var extra1Col = sheet.getRange(firstRow, COL.extra1 + 1, n, 1).getValues();
  var extra2Col = sheet.getRange(firstRow, COL.extra2 + 1, n, 1).getValues();
  var extra3Col = sheet.getRange(firstRow, COL.extra3 + 1, n, 1).getValues();
  var extra4Col = sheet.getRange(firstRow, COL.extra4 + 1, n, 1).getValues();

  var monthCounts = {}; // sales person -> rows with a move date this month
  var pipelineCounts = {}; // sales person -> rows with a move date in the next 3 months
  var monthRevenue = {}; // sales person -> NET revenue ($) of this month's rows
  for (var i = 0; i < n; i++) {
    var date = dateCol[i][0];
    if (!(date instanceof Date) || isNaN(date.getTime())) continue;
    var sales = String(salesCol[i][0] || "").trim();
    if (!sales) continue;

    var ym = Utilities.formatDate(date, tz, "yyyy-MM");
    if (ym === thisMonth) {
      monthCounts[sales] = (monthCounts[sales] || 0) + 1;
      // NET revenue to the rep = AT − AK − AL − AM − BB. Counts every row in
      // the month (done or upcoming); the deposit is already part of AT.
      var net =
        bookNum_(totalCol[i][0]) -
        bookNum_(extra1Col[i][0]) -
        bookNum_(extra2Col[i][0]) -
        bookNum_(extra3Col[i][0]) -
        bookNum_(extra4Col[i][0]);
      monthRevenue[sales] = (monthRevenue[sales] || 0) + net;
    }
    if (pipeMonths[ym]) pipelineCounts[sales] = (pipelineCounts[sales] || 0) + 1;
  }
  return { month: thisMonth, counts: monthCounts, pipeline: pipelineCounts, revenue: monthRevenue };
}

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
  var firstRow = HEADER_ROWS + 1;
  var n = lastRow - HEADER_ROWS;

  // Push the month tally FIRST, off its own narrow read, so the board's
  // headline numbers land even when the full-width sync below is too slow (or
  // times out outright) on a big sheet.
  var tally = pushMonthlyTally_(sheet, tz, firstRow, n);
  var monthlyRes = UrlFetchApp.fetch(url.replace(/\/$/, "") + "/api/ingest/monthly", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret },
    payload: JSON.stringify(tally),
    muteHttpExceptions: true,
  });
  if (monthlyRes.getResponseCode() >= 300) {
    throw new Error("Monthly ingest failed " + monthlyRes.getResponseCode() + ": " + monthlyRes.getContentText());
  }

  // Recent + upcoming full-detail sync: needs every column, so it's the heavy
  // read. Isolated so a timeout/error here (a big/slow sheet) can't undo the
  // monthly push above — the floor's headline numbers stay live even when this
  // part fails and just retries on the next run.
  try {
    var cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    var values = sheet.getRange(firstRow, 1, n, LAST_COL).getValues();

    var rows = [];
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      var job = String(v[COL.job] || "").trim();
      var date = v[COL.date];
      if (!job || !(date instanceof Date) || isNaN(date.getTime()) || date < cutoff) continue;
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
    return "sent " + sent + " booking rows (monthly ok)";
  } catch (err) {
    Logger.log("Bookings detail sync failed (monthly tally still pushed OK): %s", err);
    return "monthly ok; detail sync failed: " + err;
  }
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
