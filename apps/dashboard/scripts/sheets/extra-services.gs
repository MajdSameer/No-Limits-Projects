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

/** Reads the Leaderboard area (rows NLX_SCAN_FROM..end) ONCE as text, then finds the Extra Services card by its labels,
 *  matching loosely (case/space-insensitive, "contains"), since the sheet has several similar blocks (site inspectors use
 *  the same "Job number / Sales Rep" headers). The card = the "Extra Services" title, then the nearest "Job number" header
 *  below/right of it, the "Sales Rep" header to its right on the same row, and the "Monthly" label. */
var NLX_SCAN_FROM = 100;

function nlxNorm_(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().toLowerCase(); }

function nlxReadGrid_(board) {
  var lastRow = board.getLastRow(), lastCol = board.getLastColumn();
  var rows = Math.min(lastRow, 400) - NLX_SCAN_FROM + 1;
  if (rows < 1 || lastCol < 1) return { rows: [], top: NLX_SCAN_FROM };
  return { rows: board.getRange(NLX_SCAN_FROM, 1, rows, lastCol).getDisplayValues(), top: NLX_SCAN_FROM };
}

/** All cells whose text contains `needle` → [{row, col}] (1-based sheet coords). */
function nlxFindAll_(grid, needle) {
  var out = [];
  for (var r = 0; r < grid.rows.length; r++) {
    for (var c = 0; c < grid.rows[r].length; c++) {
      if (nlxNorm_(grid.rows[r][c]).indexOf(needle) >= 0) out.push({ row: grid.top + r, col: c + 1 });
    }
  }
  return out;
}

function nlxCell_(grid, row, col) {
  var r = grid.rows[row - grid.top];
  return r ? String(r[col - 1] == null ? "" : r[col - 1]).trim() : "";
}

function nlxLocate_(grid) {
  var titles = nlxFindAll_(grid, "extra services");
  var jobs = nlxFindAll_(grid, "job number"), reps = nlxFindAll_(grid, "sales rep"), mons = nlxFindAll_(grid, "monthly");
  Logger.log("scan: titles " + JSON.stringify(titles) + " | 'job number' " + JSON.stringify(jobs) + " | 'sales rep' " + JSON.stringify(reps) + " | 'monthly' " + JSON.stringify(mons));
  for (var i = 0; i < titles.length; i++) {
    var t = titles[i], best = null;
    jobs.forEach(function (j) {
      if (j.row >= t.row && j.row <= t.row + 25 && j.col >= t.col - 1 && (!best || j.col < best.col || (j.col === best.col && j.row < best.row))) best = j;
    });
    if (!best) continue;
    var rep = null;
    reps.forEach(function (r) { if (r.row === best.row && r.col > best.col && (!rep || r.col < rep.col)) rep = r; });
    if (!rep) continue;
    var mon = null;
    mons.forEach(function (m) { if (m.row >= t.row && m.row <= best.row && m.col > best.col && (!mon || m.col < mon.col)) mon = m; });
    return { found: true, titleRow: t.row, titleCol: t.col, jobCol: best.col, repCol: rep.col, headerRow: best.row, monthlyCol: mon ? mon.col : 0 };
  }
  return { found: false };
}

/** The card's own "Today's  6 / 8": numbers (or "n/m") in the cells between the title and the header, left of "Monthly". */
function nlxCardNumbers_(grid, loc) {
  var c2 = loc.monthlyCol > loc.jobCol ? loc.monthlyCol - 1 : loc.repCol;
  var nums = [];
  for (var r = loc.titleRow + 1; r < loc.headerRow; r++) {
    for (var c = loc.jobCol; c <= c2; c++) {
      var m = nlxCell_(grid, r, c).match(/^(\d+)\s*(?:\/\s*(\d+))?$/);
      if (m) { nums.push(parseInt(m[1], 10)); if (m[2]) nums.push(parseInt(m[2], 10)); }
    }
  }
  return nums;
}

function nlxPush() {
  var board = nlxBoard_();
  if (!board) throw new Error('Tab "' + NLX_BOARD_TAB + '" not found.');
  var grid = nlxReadGrid_(board);
  var loc = nlxLocate_(grid);
  var jobs = [], today = null, target = NLX_TARGET;
  if (loc.found) {
    for (var r = loc.headerRow + 1; r <= loc.headerRow + NLX_MAXROWS; r++) {
      var code = nlxCell_(grid, r, loc.jobCol), forRep = nlxCell_(grid, r, loc.repCol);
      if (!code || !forRep) continue;
      jobs.push({ code: code, forRep: forRep });
    }
    var nums = nlxCardNumbers_(grid, loc);
    if (nums.length > 0) today = nums[0];
    if (nums.length > 1) target = nums[1];
    Logger.log("card FOUND: title r" + loc.titleRow + "c" + loc.titleCol + ", jobCol " + loc.jobCol + ", repCol " + loc.repCol + ", header row " + loc.headerRow + ", numbers " + JSON.stringify(nums) + ", entries " + jobs.length);
  } else {
    Logger.log("card NOT FOUND — send this log line + a screenshot to fix; pushing month only, today stays 0");
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
