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

/** Finds the Extra Services card on the Leaderboard tab BY ITS LABELS (so a moved/resized card still works):
 *  title cell "Extra Services", then the "Job number" / "Sales Rep" header cells and the "Monthly" label.
 *  Returns { jobCol, repCol, headerRow, titleRow, monthlyCol } or falls back to the fixed AU/BA/198 guess. */
function nlxLocate_(board) {
  var fb = { jobCol: NLX_JOB_COL, repCol: NLX_REP_COL, headerRow: NLX_FIRST_ROW, titleRow: NLX_FIRST_ROW - 8, monthlyCol: 0, found: false };
  function find(text, minRow, maxRow) {
    var hits = board.createTextFinder(text).matchEntireCell(true).matchCase(false).findAll();
    for (var i = 0; i < hits.length; i++) {
      var r = hits[i].getRow();
      if (r >= minRow && r <= maxRow) return hits[i];
    }
    return null;
  }
  var title = find("Extra Services", 1, 5000);
  if (!title) return fb;
  var t = title.getRow();
  var job = find("Job number", t, t + 20), rep = find("Sales Rep", t, t + 20);
  if (!job || !rep) return fb;
  var mon = find("Monthly", t, t + 20);
  return { jobCol: job.getColumn(), repCol: rep.getColumn(), headerRow: job.getRow(), titleRow: t, monthlyCol: mon ? mon.getColumn() : 0, found: true };
}

/** The card's own "Today's  6 / 8" — numbers (or "n/m") in the cells between the title and the header, left of "Monthly". */
function nlxCardNumbers_(board, loc) {
  var r1 = loc.titleRow + 1, r2 = loc.headerRow - 1;
  if (r2 < r1) return [];
  var c1 = loc.jobCol, c2 = loc.monthlyCol > loc.jobCol ? loc.monthlyCol - 1 : loc.repCol;
  var vals = board.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1).getDisplayValues();
  var nums = [];
  vals.forEach(function (row) {
    row.forEach(function (cell) {
      var s = String(cell || "").trim();
      var m = s.match(/^(\d+)\s*(?:\/\s*(\d+))?$/);
      if (m) { nums.push(parseInt(m[1], 10)); if (m[2]) nums.push(parseInt(m[2], 10)); }
    });
  });
  return nums;
}

function nlxPush() {
  var board = nlxBoard_();
  if (!board) throw new Error('Tab "' + NLX_BOARD_TAB + '" not found.');
  var loc = nlxLocate_(board);
  var first = loc.headerRow; // header row itself is skipped below
  var n = Math.min(NLX_MAXROWS, Math.max(0, board.getLastRow() - first + 1));
  var jobs = [];
  if (n > 0) {
    var jv = board.getRange(first, loc.jobCol, n, 1).getValues();
    var rv = board.getRange(first, loc.repCol, n, 1).getValues();
    for (var i = 0; i < n; i++) {
      var code = String(jv[i][0] || "").trim();
      var forRep = String(rv[i][0] || "").trim();
      if (!code || !forRep) continue;
      if (forRep.toLowerCase() === "sales rep" || code.toLowerCase() === "job number") continue; // header
      jobs.push({ code: code, forRep: forRep });
    }
  }
  var nums = loc.found ? nlxCardNumbers_(board, loc) : [];
  var today = nums.length > 0 ? nums[0] : null;
  var target = nums.length > 1 ? nums[1] : NLX_TARGET;
  Logger.log("card " + (loc.found ? "found" : "NOT found (using AU/BA fallback)") + ": jobCol " + loc.jobCol + ", repCol " + loc.repCol + ", header row " + loc.headerRow + ", numbers " + JSON.stringify(nums) + ", entries " + jobs.length);

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
    name: NLX_NAME, target: target, today: today, jobs: jobs, monthCount: monthCount,
    asOfDate: Utilities.formatDate(new Date(), NLX_TZ, "yyyy-MM-dd"),
  });
}

/** onEdit — push when the edit touches the Leaderboard entry block or the Extra Services Booked tab. */
function nlxOnEdit(e) {
  if (!e || !e.range) return;
  var name = e.range.getSheet().getName();
  if (name === NLX_BOARD_TAB) {
    // Any edit on the Leaderboard tab at/after the card's rows pushes (the 1-minute timer is the backstop).
    if (e.range.getLastRow() < NLX_FIRST_ROW - 10) return;
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
