/** TEMPLATE (no secrets) — the deployed copy is Desktop/NoLimits-ExtraServices.gs with the URL + key inline.
 *  Extra Services (Clara) → dashboard /live card. File in the FOLLOW-UP spreadsheet's Apps Script project; run nlxStart() once. */
var NLX_URL = "https://YOUR-DASHBOARD.vercel.app";
var NLX_SECRET = "SET-ME"; // = INGEST_SECRET

function nlxPost_(body) {
  var res, code;
  for (var attempt = 1; attempt <= 3; attempt++) {
    res = UrlFetchApp.fetch(NLX_URL.replace(/\/$/, "") + "/api/ingest/extra-services", {
      method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + NLX_SECRET },
      payload: JSON.stringify(body), muteHttpExceptions: true,
    });
    code = res.getResponseCode();
    if (code < 300) return res.getContentText();
    if (code < 500) break;
    Utilities.sleep(3000);
  }
  throw new Error("extra-services ingest failed " + code + ": " + res.getContentText());
}

var NLX_TZ = "Australia/Sydney";
var NLX_NAME = "Clara";            // the one person booking extra services
var NLX_TARGET = 8;                // today's target — the "/ 8" on the card (edit here)

// TODAY — the Leaderboard tab's hand-kept "Extra Services" card entries:
// job number in column AU (47), the sales rep it's for in column BA (53), growing down from row 198.
var NLX_BOARD_TAB = "Leaderboard";
var NLX_BOARD_GID = 1760907362;    // fallback if the tab is renamed
var NLX_FIRST_ROW = 198;           // row 198 is the "Job number / Sales Rep" header — skipped below
var NLX_MAXROWS = 20;              // keep well short of the unrelated rankings table further down
var NLX_JOB_COL = 47;              // AU
var NLX_REP_COL = 53;              // BA

// MONTH — the "Extra Services Booked" tab: D = date, E = Sales Person, F = Job Number (headers on row 2).
// A booking = a row dated this month with a Job Number filled in.
var NLX_BOOK_TAB = "Extra Services Booked";
var NLX_BOOK_FIRST_ROW = 3;
var NLX_BOOK_DATE_COL = 4;         // D
var NLX_BOOK_JOB_COL = 6;          // F

function nlxBoard_() {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(NLX_BOARD_TAB);
  if (s) return s;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) if (all[i].getSheetId() === NLX_BOARD_GID) return all[i];
  return null;
}

/** A date cell (Date object OR text like "Friday, November 13, 2026") → yyyy-MM-dd in Sydney time; "" if unparseable. */
function nlxDay_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, NLX_TZ, "yyyy-MM-dd");
  var s = String(v == null ? "" : v).trim();
  if (!s) return "";
  var d = new Date(s);
  return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, NLX_TZ, "yyyy-MM-dd");
}

function nlxPush() {
  var board = nlxBoard_();
  if (!board) throw new Error('Tab "' + NLX_BOARD_TAB + '" not found.');
  var n = Math.min(NLX_MAXROWS, Math.max(0, board.getLastRow() - NLX_FIRST_ROW + 1));
  var jobs = [];
  if (n > 0) {
    var jv = board.getRange(NLX_FIRST_ROW, NLX_JOB_COL, n, 1).getValues();
    var rv = board.getRange(NLX_FIRST_ROW, NLX_REP_COL, n, 1).getValues();
    for (var i = 0; i < n; i++) {
      var code = String(jv[i][0] || "").trim();
      var forRep = String(rv[i][0] || "").trim();
      if (!code || !forRep) continue;
      if (forRep.toLowerCase() === "sales rep" || code.toLowerCase() === "job number") continue; // header
      jobs.push({ code: code, forRep: forRep });
    }
  }

  var monthCount = 0;
  var book = SpreadsheetApp.getActive().getSheetByName(NLX_BOOK_TAB);
  var thisMonth = Utilities.formatDate(new Date(), NLX_TZ, "yyyy-MM");
  if (book) {
    var bn = Math.max(0, book.getLastRow() - NLX_BOOK_FIRST_ROW + 1);
    if (bn > 0) {
      var width = NLX_BOOK_JOB_COL - NLX_BOOK_DATE_COL + 1;
      var rows = book.getRange(NLX_BOOK_FIRST_ROW, NLX_BOOK_DATE_COL, bn, width).getValues();
      for (var j = 0; j < rows.length; j++) {
        if (String(rows[j][width - 1] || "").trim() === "") continue;           // no job number → not a booking
        if (nlxDay_(rows[j][0]).slice(0, 7) !== thisMonth) continue;
        monthCount += 1;
      }
    }
  } else {
    Logger.log('Tab "' + NLX_BOOK_TAB + '" not found — month will be 0.');
  }

  Logger.log("extra services (" + NLX_NAME + "): today " + jobs.length + ", month " + monthCount);
  return nlxPost_({
    name: NLX_NAME, target: NLX_TARGET, jobs: jobs, monthCount: monthCount,
    asOfDate: Utilities.formatDate(new Date(), NLX_TZ, "yyyy-MM-dd"),
  });
}

/** onEdit — push when the edit touches the Leaderboard entry block or the Extra Services Booked tab. */
function nlxOnEdit(e) {
  if (!e || !e.range) return;
  var name = e.range.getSheet().getName();
  if (name === NLX_BOARD_TAB) {
    if (e.range.getLastColumn() < NLX_JOB_COL || e.range.getColumn() > NLX_REP_COL) return;
    if (e.range.getLastRow() < NLX_FIRST_ROW || e.range.getRow() > NLX_FIRST_ROW + NLX_MAXROWS - 1) return;
    nlxPush();
  } else if (name === NLX_BOOK_TAB) {
    nlxPush();
  }
}

/** RUN THIS ONE (in the Follow-Up spreadsheet's script). Deletes ONLY this script's triggers, reinstalls
 *  them (edit + every minute) and pushes now. Safe to re-run. */
function nlxStart() {
  var mine = { nlxOnEdit: true, nlxPush: true };
  ScriptApp.getProjectTriggers().forEach(function (t) { if (mine[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("nlxOnEdit").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger("nlxPush").timeBased().everyMinutes(1).create();
  return nlxPush();
}
