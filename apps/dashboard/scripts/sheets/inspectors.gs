/**
 * No Limits — Site Inspections → dashboard live push (Google Apps Script).
 *
 * Lives as an extra FILE in the Follow-Up spreadsheet's ONE Apps Script project
 * (alongside leaderboard.gs / roster.gs).
 *
 * SOURCE OF TRUTH — the form-fed **"Site Inspection Booked"** tab, one row per
 * booked inspection. Columns (1-based):
 *     D (4) date  ·  E (5) sales person  ·  F (6) job number  ·  H (8) inspector
 *
 * Each inspector's count = every row in the CURRENT MONTH that's theirs (col H)
 * and carries a real job number (col F), each tagged with the sales rep (col E).
 * We deliberately do NOT filter by "today": the wall just needs to celebrate
 * whenever an inspector enters a new job number — the day the inspection is
 * booked for doesn't matter. (We used to read a hand-kept daily mirror in the
 * Leaderboard tab; it stopped being filled, so Martin showed 0 on the wall.)
 *
 * Each push drives the green "Site Inspectors" boxes on /live and the applause
 * celebration (fires once per new job number, count-driven on the dashboard).
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

/** A MovePro job number is always exactly 5 alphanumeric chars (e.g. "AY3VA",
 * or all letters like "EDPAG", or lowercase like "b8z6p"). The length is what
 * guards against a stray value (a name, a loose number, or an email pasted into
 * the job# column) being counted as a phantom inspection. Don't require a digit
 * — real codes can be all letters. */
function inspIsJobCode_(code) {
  return /^[A-Za-z0-9]{5}$/.test(code);
}

/** Normalise a booking-date cell (a Date object OR a string like
 * "Monday, June 29, 2026") to a yyyy-MM key in Sydney time. "" if unparseable. */
function inspMonthKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, INSP_TZ, "yyyy-MM");
  var s = String(v == null ? "" : v).trim();
  if (!s) return "";
  var d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, INSP_TZ, "yyyy-MM");
}

function pushInspections() {
  var t0 = new Date().getTime();
  var cfg = inspCfg_();
  var book = inspSheetByName_(INSP_BOOK_TAB);
  if (!book) throw new Error('Tab "' + INSP_BOOK_TAB + '" not found.');

  var now = new Date();
  var today = Utilities.formatDate(now, INSP_TZ, "yyyy-MM-dd");
  var thisMonth = Utilities.formatDate(now, INSP_TZ, "yyyy-MM");

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
    var jobs = [];
    var seen = {};
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var inspector = String(row[inspIdx] || "").trim().toLowerCase();
      if (inspector !== wantInsp) continue;
      if (inspMonthKey_(row[dIdx]) !== thisMonth) continue; // this month's inspections
      var code = String(row[jobIdx] || "").trim();
      if (!inspIsJobCode_(code)) continue; // stray value (name/number/email) in the job# cell
      if (seen[code]) continue; // same job# twice → one inspection
      seen[code] = true;
      jobs.push({ code: code, forRep: String(row[repIdx] || "").trim() });
    }
    return { name: p.name, jobs: jobs, monthCount: jobs.length };
  });

  var summary = rows
    .map(function (x) {
      return x.name + " (" + x.jobs.length + ")";
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
