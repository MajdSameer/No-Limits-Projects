/**
 * No Limits — Site Inspections → dashboard live push (Google Apps Script).
 *
 * Lives as an extra FILE in the Follow-Up spreadsheet's ONE Apps Script
 * project (alongside leaderboard.gs / roster.gs).
 *
 * SOURCE OF TRUTH — the form-fed **"Site Inspection Booked"** tab, one row
 * per booked inspection. Columns (1-based):
 *     D (4) date  ·  E (5) sales person  ·  F (6) job number  ·  H (8) inspector
 *
 * We used to read a hand-kept mirror in the Leaderboard tab (Martin AU/BA,
 * Danny BJ/BP, month total in a single displayed cell on row 194). That
 * mirror depends on someone manually re-typing every job number a second
 * time, and it silently stops being kept in sync — it happened to Martin
 * (showed 0 on the wall) and then to Danny (stuck on a stale old month
 * total while the real "Site Inspection Booked" tab had moved on). This
 * reads the booking tab directly instead, so there's nothing to fall out of
 * sync.
 *
 * TODAY's jobs (col F) drive the green "Site Inspectors" boxes' daily number
 * and the applause celebration. MONTH is every row with a non-blank job# cell
 * for that inspector this calendar month (today's jobs are a subset). Rows
 * are NOT deduped by job code (two rows can legitimately share a code), and
 * the job# cell's CONTENT is not validated as a MovePro code either — the
 * sheet's own reference count (a SUMPRODUCT over this same tab) doesn't
 * validate it, so neither do we; every logged row is one real inspection.
 *
 * SETUP — see scripts/sheets/README.md. In short:
 *   1. In the Follow-Up sheet's Apps Script project, add/replace this file.
 *   2. Run installInspectorTriggers() once — it installs ONLY its own triggers.
 *   3. Test: run pushInspections() and check the log, then open /live.
 */

var INSP_TZ = "Australia/Sydney";

// Booking log — the source of inspections.
var INSP_BOOK_TAB = "Site Inspection Booked";
var INSP_BOOK_FIRST_ROW = 3; // first data row (row 2 is the header)
var INSP_BOOK_DATE_COL = 4; // D — booking date
var INSP_BOOK_REP_COL = 5; // E — sales person the inspection is for
var INSP_BOOK_JOB_COL = 6; // F — MovePro job number
var INSP_BOOK_INSP_COL = 8; // H — which site inspector

// The site inspectors we track. Names match col H of the booking tab.
var INSP_PEOPLE = [{ name: "Martin" }, { name: "Danny" }];

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

/**
 * No format validation here on purpose — the sheet's own "Monthly" display
 * (a SUMPRODUCT over this same tab) counts every row where the inspector
 * matches, regardless of what's in the job# cell, and that's the number
 * that's treated as correct. So: any row with a real inspector and a
 * non-blank job# cell counts as one inspection, typo or not (e.g. a sales
 * rep once pasted an email address into the job# cell by mistake — that
 * still counted as a real site visit, so it counts here too). This only
 * strips surrounding junk (a stray leading "#", stray newlines) for display
 * — it's cosmetic, not a filter. Returns the cleaned string, or null only
 * if the cell is truly blank.
 */
function inspCleanJobCode_(raw) {
  var s = String(raw == null ? "" : raw)
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > 0 ? s : null;
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
  var book = inspSheetByName_(INSP_BOOK_TAB);
  if (!book) throw new Error('Tab "' + INSP_BOOK_TAB + '" not found.');

  var now = new Date();
  var today = Utilities.formatDate(now, INSP_TZ, "yyyy-MM-dd");
  var thisMonth = today.slice(0, 7);

  // Read the whole booking log once (date, rep, job, lead, inspector = cols D..H).
  var lastRow = book.getLastRow();
  var n = Math.max(0, lastRow - INSP_BOOK_FIRST_ROW + 1);
  var width = INSP_BOOK_INSP_COL - INSP_BOOK_DATE_COL + 1; // D..H
  var data = n > 0 ? book.getRange(INSP_BOOK_FIRST_ROW, INSP_BOOK_DATE_COL, n, width).getValues() : [];
  var dIdx = 0; // D
  var repIdx = INSP_BOOK_REP_COL - INSP_BOOK_DATE_COL; // E
  var jobIdx = INSP_BOOK_JOB_COL - INSP_BOOK_DATE_COL; // F
  var inspIdx = INSP_BOOK_INSP_COL - INSP_BOOK_DATE_COL; // H

  var rows = INSP_PEOPLE.map(function (p) {
    var wantInsp = p.name.toLowerCase();
    var jobs = []; // today's jobs (drives the daily number + celebration)
    var monthCount = 0;
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var inspector = String(row[inspIdx] || "").trim().toLowerCase();
      if (inspector !== wantInsp) continue;
      var dayKey = inspDayKey_(row[dIdx]);
      if (dayKey.slice(0, 7) !== thisMonth) continue; // this month only
      var code = inspCleanJobCode_(row[jobIdx]);
      if (!code) continue; // truly blank job# cell — no entry at all
      monthCount += 1;
      if (dayKey === today) jobs.push({ code: code, forRep: String(row[repIdx] || "").trim() });
    }
    return { name: p.name, jobs: jobs, monthCount: monthCount };
  });

  var summary = rows
    .map(function (x) {
      return x.name + " (today " + x.jobs.length + ", month " + x.monthCount + ")";
    })
    .join(", ");
  Logger.log("booking tab '%s', scanned %s rows in %sms — %s", book.getName(), n, new Date().getTime() - t0, summary);

  var res = UrlFetchApp.fetch(cfg.url.replace(/\/$/, "") + "/api/ingest/inspectors", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + cfg.secret },
    payload: JSON.stringify({ rows: rows, asOfDate: today }),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error("Ingest failed " + code + ": " + res.getContentText());
  return res.getContentText();
}

/** onEdit — push only when the edit touches the booking log's data columns
 * (D..H) of the "Site Inspection Booked" tab. */
function onInspectionEdit(e) {
  if (!e || !e.range) return;
  if (e.range.getSheet().getName() !== INSP_BOOK_TAB) return;
  if (e.range.getLastColumn() < INSP_BOOK_DATE_COL || e.range.getColumn() > INSP_BOOK_INSP_COL) return;
  if (e.range.getLastRow() < INSP_BOOK_FIRST_ROW) return;
  pushInspections();
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
