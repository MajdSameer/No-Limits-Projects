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
 *
 * Also tallies the "Cleaning Bookings" and "Car reallocation Bookings" tabs
 * (same spreadsheet) into the SAME monthCounts/pipelineCounts a rep's /live
 * "This month"/"Next 3 months" totals come from — see EXTRA_TALLY_TABS below.
 * Those two tabs aren't part of the bookings-table sync (rows array), just the
 * count tally, so /bookings and /subcontractor are unaffected.
 */

var BOOK_TAB = "Booking";
var HEADER_ROWS = 2; // real headers are on row 2; data starts row 3
var WINDOW_DAYS = 90;
var BATCH = 300;

// Extra tabs whose rows should count toward a rep's monthly/pipeline totals
// on /live, on top of the Booking tab above — cleaning and car-relocation
// jobs, so booking one of those also moves a rep up the board. Both tabs
// share this layout: header row 2, data from row 3, Date in col D, Sales
// Person in col E (1-indexed columns, unlike the 0-based COL map above).
// Missing a tab (renamed/deleted) is skipped, not fatal — the main Booking
// tally still pushes.
var EXTRA_TALLY_TABS = [
  { name: "Cleaning Bookings", dateCol: 4, salesCol: 5 },
  { name: "Car reallocation Bookings", dateCol: 4, salesCol: 5 },
];

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

/** Adds each EXTRA_TALLY_TABS tab's rows into monthCounts/pipelineCounts, in
 * place — same "row with a Sales Person, bucketed by move-date month" rule as
 * the Booking tab's own tally, just on a 2-column read (Date, Sales Person
 * only) so it doesn't pay for those tabs' much wider/heavier columns (long
 * confirmation-message text etc). Car reallocation Bookings' Date column is a
 * spreadsheet-wide ARRAYFORMULA — fine for Apps Script's own getValues() (the
 * Booking/Leaderboard tabs already lean on formula cells like this), just
 * slow over the external Sheets API, which is why it has to be read here
 * rather than fetched externally when this was being designed. */
function tallyExtraBookings_(ss, tz, thisMonth, pipeMonths, monthCounts, pipelineCounts) {
  EXTRA_TALLY_TABS.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.name);
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow <= HEADER_ROWS) return;
    var numRows = lastRow - HEADER_ROWS;
    var dates = sheet.getRange(HEADER_ROWS + 1, tab.dateCol, numRows, 1).getValues();
    var sales = sheet.getRange(HEADER_ROWS + 1, tab.salesCol, numRows, 1).getValues();
    for (var i = 0; i < numRows; i++) {
      var person = String(sales[i][0] || "").trim();
      var date = dates[i][0];
      if (!person || !(date instanceof Date) || isNaN(date.getTime())) continue;
      var ym = Utilities.formatDate(date, tz, "yyyy-MM");
      if (ym === thisMonth) monthCounts[person] = (monthCounts[person] || 0) + 1;
      if (pipeMonths[ym]) pipelineCounts[person] = (pipelineCounts[person] || 0) + 1;
    }
  });
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
  var values = sheet.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, LAST_COL).getValues();

  var cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  var nowd = new Date();
  var thisMonth = Utilities.formatDate(nowd, tz, "yyyy-MM");
  // Pipeline window = this month + the next two (e.g. Jun, Jul, Aug — counts ALL
  // of the current month, including days before today).
  var pipeMonths = {};
  for (var k = 0; k < 3; k++) {
    pipeMonths[Utilities.formatDate(new Date(nowd.getFullYear(), nowd.getMonth() + k, 1), tz, "yyyy-MM")] = 1;
  }

  var rows = [];
  var monthCounts = {}; // sales person -> rows with a move date this month
  var pipelineCounts = {}; // sales person -> rows with a move date in the next 3 months
  var monthRevenue = {}; // sales person -> NET revenue ($) of this month's rows
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
      if (ym === thisMonth) {
        monthCounts[sales] = (monthCounts[sales] || 0) + 1;
        // NET revenue to the rep = AT − AK − AL − AM − BB. Counts every row in
        // the month (done or upcoming); the deposit is already part of AT.
        var net =
          bookNum_(v[COL.total]) -
          bookNum_(v[COL.extra1]) -
          bookNum_(v[COL.extra2]) -
          bookNum_(v[COL.extra3]) -
          bookNum_(v[COL.extra4]);
        monthRevenue[sales] = (monthRevenue[sales] || 0) + net;
      }
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

  // Fold cleaning + car-relocation bookings into the same rep totals, on top
  // of the Booking tab's own moving counts — see EXTRA_TALLY_TABS.
  tallyExtraBookings_(ss, tz, thisMonth, pipeMonths, monthCounts, pipelineCounts);

  // Push the month tally first so the board's headline total is right even if
  // the bigger bookings sync below is slow.
  var monthlyRes = UrlFetchApp.fetch(url.replace(/\/$/, "") + "/api/ingest/monthly", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret },
    payload: JSON.stringify({
      month: thisMonth,
      counts: monthCounts,
      pipeline: pipelineCounts,
      revenue: monthRevenue,
    }),
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
  if (e && e.range) {
    var name = e.range.getSheet().getName();
    var watched = name === BOOK_TAB;
    for (var i = 0; !watched && i < EXTRA_TALLY_TABS.length; i++) {
      if (EXTRA_TALLY_TABS[i].name === name) watched = true;
    }
    if (!watched) return;
  }
  pushBookings();
}

/**
 * Run once to (re)install the booking edit + time-based triggers. The
 * time-based one is a 5-minute backup (down from 15) for anything that
 * doesn't fire onEdit — a formula/IMPORTRANGE-driven change, a bulk API
 * write, etc. — since onEdit only fires for a direct user edit to the sheet.
 * A direct edit should already push within seconds via onEdit; if it's
 * still taking minutes even for a manual edit, the deployed onEdit trigger
 * may have gone stale — re-running this function refreshes both triggers.
 * Not set to the fastest possible 1 minute: this sheet has previously timed
 * out on its own reads when large (~3,600 rows), and a 1-minute cadence
 * risks a slow run still executing when the next one fires.
 */
function installBookingTriggers() {
  var ours = { onBookingEdit: true, pushBookings: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (ours[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onBookingEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushBookings").timeBased().everyMinutes(5).create();
}
