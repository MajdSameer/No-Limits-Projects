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
 * This sheet is large (~3,600+ rows × 54 cols, plus giant AU/AV/AW
 * confirmation-text columns and volatile formulas), which makes a single
 * full-width getValues() read prone to "Service Spreadsheets timed out" — when
 * that happens the whole push used to fail, including the month/pipeline/
 * revenue tally that the floor actually watches. This version reads the tally
 * off a handful of narrow, targeted columns and pushes it FIRST, then does the
 * heavier recent-bookings detail sync (capped to the most recent SYNC_ROWS
 * rows) in its own try/catch, and retries any individual read that times out a
 * couple of times before giving up — so a transient hiccup on this sheet no
 * longer means the dashboard's monthly numbers go stale.
 */

var BOOK_TAB = "Booking";
var HEADER_ROWS = 2; // real headers are on row 2; data starts row 3
var WINDOW_DAYS = 90;
var BATCH = 300;
var SYNC_ROWS = 2500; // detail sync only needs the most-recent rows (bookings are recent + upcoming)
var MAX_ROW_NET = 60000; // sanity cap: a single booking can't net more than this
var READ_TRIES = 3; // attempts for a single getValues() read before giving up

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

// The recent-bookings detail sync only needs A..AT — skip the huge AU/AV/AW
// message columns that make a full-width read so much slower.
var MAIN_COLS = 46;

/** Parse a money-ish cell (number, or "$1,234.50" text) to a number; blank → 0. */
function bookNum_(v) {
  if (v === "" || v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

/**
 * getValues() with a short retry — this sheet is big/heavy enough that a read
 * can throw a transient "Service Spreadsheets timed out" even on a narrow
 * range; retrying a couple of times recovers most of those without waiting for
 * the next scheduled run (15 min later).
 */
function getValuesRetry_(sheet, row, col, numRows, numCols) {
  var lastErr;
  for (var attempt = 1; attempt <= READ_TRIES; attempt++) {
    try {
      return sheet.getRange(row, col, numRows, numCols).getValues();
    } catch (err) {
      lastErr = err;
      if (attempt < READ_TRIES) Utilities.sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

/**
 * The month/pipeline/revenue tally only needs 6 of the sheet's 54 columns.
 * Read as a few small, targeted getValues() calls (retried on timeout)
 * instead of folding it into the big all-columns read below — so the tally
 * that the floor watches doesn't depend on the heavy read succeeding.
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

  var dateCol = getValuesRetry_(sheet, firstRow, COL.date + 1, n, 1);
  var salesCol = getValuesRetry_(sheet, firstRow, COL.sales + 1, n, 1);
  var extrasCol = getValuesRetry_(sheet, firstRow, COL.extra1 + 1, n, 3); // AK,AL,AM are contiguous
  var totalCol = getValuesRetry_(sheet, firstRow, COL.total + 1, n, 1);
  var extra4Col = getValuesRetry_(sheet, firstRow, COL.extra4 + 1, n, 1);

  var monthCounts = {}; // sales person -> rows with a move date this month
  var pipelineCounts = {}; // sales person -> rows with a move date in the next 3 months
  var monthRevenue = {}; // sales person -> NET revenue ($) of this month's rows
  var skipped = 0;
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
        bookNum_(extrasCol[i][0]) -
        bookNum_(extrasCol[i][1]) -
        bookNum_(extrasCol[i][2]) -
        bookNum_(extra4Col[i][0]);
      // Safety floor: a real booking nets $0..a few thousand. Negative/absurd
      // means junk in a cell (or a drifted column) — count it as $0 so one bad
      // row can't poison the whole rep's month.
      if (!(net > 0) || net > MAX_ROW_NET) {
        net = 0;
        skipped++;
      }
      monthRevenue[sales] = (monthRevenue[sales] || 0) + net;
    }
    if (pipeMonths[ym]) pipelineCounts[sales] = (pipelineCounts[sales] || 0) + 1;
  }
  if (skipped) Logger.log(skipped + " row(s) had a junk/negative net → counted as $0");
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

  // Push the month tally FIRST, off its own narrow reads, so the board's
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

  // Recent + upcoming full-detail sync: needs every column up to AT (skipping
  // the huge AU/AV/AW message columns), so it's the heavy read. Capped to the
  // most recent SYNC_ROWS rows (bookings synced here are only ever recent +
  // upcoming anyway) and isolated in its own try/catch so a timeout/error here
  // can't undo the monthly push above — the floor's headline numbers stay live
  // even when this part fails and just retries on the next run.
  try {
    var cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    var wideCount = Math.min(n, SYNC_ROWS);
    var wideStart = lastRow - wideCount + 1;
    var values = getValuesRetry_(sheet, wideStart, 1, wideCount, MAIN_COLS);

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
