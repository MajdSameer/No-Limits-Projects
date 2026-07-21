/**
 * No Limits — Site Inspections → dashboard live push (Google Apps Script).
 *
 * Lives as an extra FILE in the Follow-Up spreadsheet's ONE Apps Script
 * project (alongside leaderboard.gs / roster.gs).
 *
 * TWO DIFFERENT SOURCES, for two different numbers:
 *
 * TODAY comes from the **"Leaderboard" tab's hand-kept entry block**
 * (job#/rep grow down from row 198 — Martin col AU job# / BA rep, Danny
 * col BJ job# / BP rep). That block is what staff actually keep updated in
 * real time as inspections happen (it gets reset each day), so it's the
 * true same-day source. The "Site Inspection Booked" tab's dates are NOT a
 * reliable "today" signal — inspections get pre-booked there well in
 * advance, so "dated today" in that tab doesn't mean "happened today".
 *
 * MONTH comes from the **"Site Inspection Booked" tab** instead (col D
 * date, col H inspector) — every row for that inspector this calendar
 * month. No dedup, no job-code format validation: the sheet's own
 * reference count (a SUMPRODUCT over this same tab) doesn't validate
 * either, so every logged row is one real inspection.
 *
 * SETUP — see scripts/sheets/README.md. In short:
 *   1. In the Follow-Up sheet's Apps Script project, add/replace this file.
 *   2. Run installInspectorTriggers() once — it installs ONLY its own triggers.
 *   3. Test: run pushInspections() and check the log, then open /live.
 */

var INSP_TZ = "Australia/Sydney";

// TODAY — the Leaderboard tab's hand-kept entry block.
var INSP_TAB = "Leaderboard";
var INSP_GID = 1760907362; // fallback if the tab gets renamed
var INSP_FIRST_ROW = 198; // first row of today's entries
var INSP_MAXROWS = 600; // how far down to scan for today's entries

// MONTH — the booking log (Site Inspection Booked tab).
var INSP_BOOK_TAB = "Site Inspection Booked";
var INSP_BOOK_FIRST_ROW = 3; // first data row (row 2 is the header)
var INSP_BOOK_DATE_COL = 4; // D — booking date
var INSP_BOOK_INSP_COL = 8; // H — which site inspector

// Per inspector: today's job#/rep columns (1-based) in the Leaderboard block.
var INSP_PEOPLE = [
  { name: "Martin", jobCol: 47 /* AU */, repCol: 53 /* BA */ },
  { name: "Danny", jobCol: 62 /* BJ */, repCol: 68 /* BP */ },
];

function inspCfg_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("DASHBOARD_URL");
  var secret = props.getProperty("INGEST_SECRET");
  if (!url || !secret) {
    throw new Error("Set DASHBOARD_URL and INGEST_SECRET in Project Settings → Script Properties.");
  }
  return { url: url, secret: secret };
}

function inspSheetByName_(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
}

/** The Leaderboard tab, found by name or (if renamed) by its gid. */
function inspLeaderboardSheet_() {
  var sheet = inspSheetByName_(INSP_TAB);
  if (sheet) return sheet;
  var all = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < all.length; i++) if (all[i].getSheetId() === INSP_GID) return all[i];
  return null;
}

/** Normalise a booking-date cell (a Date object OR a string like
 * "Monday, June 29, 2026") to a yyyy-MM-dd key in Sydney time. "" if unparseable. */
function inspDayKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, INSP_TZ, "yyyy-MM-dd");
  var s = String(v == null ? "" : v).trim();
  if (!s) return "";
  var d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, INSP_TZ, "yyyy-MM-dd");
}

function pushInspections() {
  var t0 = new Date().getTime();
  var cfg = inspCfg_();

  // TODAY — read the Leaderboard block once (whatever's filled in there now).
  var board = inspLeaderboardSheet_();
  if (!board) throw new Error('Tab "' + INSP_TAB + '" not found.');
  var boardLastRow = board.getLastRow();
  var boardN = Math.min(INSP_MAXROWS, Math.max(0, boardLastRow - INSP_FIRST_ROW + 1));

  // MONTH — read the whole booking log once (date + inspector = cols D, H).
  var book = inspSheetByName_(INSP_BOOK_TAB);
  if (!book) throw new Error('Tab "' + INSP_BOOK_TAB + '" not found.');
  var now = new Date();
  var thisMonth = Utilities.formatDate(now, INSP_TZ, "yyyy-MM");
  var bookLastRow = book.getLastRow();
  var bookN = Math.max(0, bookLastRow - INSP_BOOK_FIRST_ROW + 1);
  var bookData =
    bookN > 0
      ? book.getRange(INSP_BOOK_FIRST_ROW, INSP_BOOK_DATE_COL, bookN, INSP_BOOK_INSP_COL - INSP_BOOK_DATE_COL + 1).getValues()
      : [];
  var bookInspIdx = INSP_BOOK_INSP_COL - INSP_BOOK_DATE_COL;

  var rows = INSP_PEOPLE.map(function (p) {
    // Today's entries: each row in the Leaderboard block with BOTH a job
    // number and a sales rep.
    var jobs = [];
    if (boardN > 0) {
      var jobVals = board.getRange(INSP_FIRST_ROW, p.jobCol, boardN, 1).getValues();
      var repVals = board.getRange(INSP_FIRST_ROW, p.repCol, boardN, 1).getValues();
      for (var i = 0; i < boardN; i++) {
        var code = String(jobVals[i][0] || "").trim();
        var forRep = String(repVals[i][0] || "").trim();
        if (!code || !forRep) continue;
        if (forRep.toLowerCase() === "sales rep") continue; // header guard
        jobs.push({ code: code, forRep: forRep });
      }
    }

    // Month total: every booking-log row this month for this inspector.
    var monthCount = 0;
    for (var j = 0; j < bookData.length; j++) {
      var inspector = String(bookData[j][bookInspIdx] || "").trim().toLowerCase();
      if (inspector !== p.name.toLowerCase()) continue;
      if (inspDayKey_(bookData[j][0]).slice(0, 7) !== thisMonth) continue;
      monthCount += 1;
    }

    return { name: p.name, jobs: jobs, monthCount: monthCount };
  });

  var summary = rows
    .map(function (x) {
      return x.name + " (today " + x.jobs.length + ", month " + x.monthCount + ")";
    })
    .join(", ");
  Logger.log(
    "Leaderboard today + '%s' month, scanned %s+%s rows in %sms — %s",
    book.getName(),
    boardN,
    bookN,
    new Date().getTime() - t0,
    summary,
  );

  var res = UrlFetchApp.fetch(cfg.url.replace(/\/$/, "") + "/api/ingest/inspectors", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + cfg.secret },
    payload: JSON.stringify({ rows: rows, asOfDate: Utilities.formatDate(now, INSP_TZ, "yyyy-MM-dd") }),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error("Ingest failed " + code + ": " + res.getContentText());
  return res.getContentText();
}

/** onEdit — push when the edit touches EITHER source: the Leaderboard
 * block (cols AU..BP, today's entries) or the Site Inspection Booked tab
 * (cols D..H, the month total). */
function onInspectionEdit(e) {
  if (!e || !e.range) return;
  var sheetName = e.range.getSheet().getName();
  if (sheetName === INSP_TAB) {
    if (e.range.getLastColumn() < 47 || e.range.getColumn() > 68) return;
    if (e.range.getLastRow() < INSP_FIRST_ROW) return;
    pushInspections();
    return;
  }
  if (sheetName === INSP_BOOK_TAB) {
    if (e.range.getLastColumn() < INSP_BOOK_DATE_COL || e.range.getColumn() > INSP_BOOK_INSP_COL) return;
    if (e.range.getLastRow() < INSP_BOOK_FIRST_ROW) return;
    pushInspections();
    return;
  }
}

/** Installs ONLY the inspection triggers (leaves the leaderboard/roster ones
 * alone). Safe to re-run. */
function installInspectorTriggers() {
  var mine = { onInspectionEdit: true, pushInspections: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (mine[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onInspectionEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushInspections").timeBased().everyMinutes(5).create();
}
