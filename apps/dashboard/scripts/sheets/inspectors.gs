/**
 * No Limits — Site Inspections → dashboard live push (Google Apps Script).
 *
 * The site inspections are logged in a section of the "Leaderboard" tab (the
 * same Follow-Up spreadsheet that runs leaderboard.gs). A spreadsheet has only
 * ONE Apps Script project, so this lives as an extra FILE in that project
 * alongside leaderboard.gs / roster.gs.
 *
 * Layout (fixed cells):
 *   TODAY's entries grow DOWN from row 198 — a row counts once it has BOTH a
 *   job number and a sales rep:
 *     Martin   job# col AU,  sales rep col BA
 *     Danny    job# col BJ,  sales rep col BP
 *   The MONTH total is a displayed cell on row 194 (merged 194-195):
 *     Martin   col BA        Danny    col BP
 *
 * Each push drives the green "Site Inspectors" boxes on /live (today + month)
 * and the applause celebration (fires when a rep adds a today entry).
 *
 * SETUP — see scripts/sheets/README.md. In short:
 *   1. In the Follow-Up sheet's Apps Script project, add this as a new file.
 *   2. Run installInspectorTriggers() once — it installs ONLY its own triggers.
 *   3. Test: run pushInspections() and check the log, then open /live.
 */

var INSP_TZ = "Australia/Sydney";
var INSP_TAB = "Leaderboard"; // tab holding the site-inspection section
var INSP_GID = 1760907362; // fallback if the tab gets renamed
var INSP_FIRST_ROW = 198; // first row of today's entries
var INSP_MONTH_ROW = 194; // row with the displayed monthly total (194-195 merge)
var INSP_MAXROWS = 600; // how far down to scan for today's entries

// Per inspector: 1-based columns. job#/sales-rep grow down from row 198; the
// month total sits at (INSP_MONTH_ROW, monthCol).
var INSP_PEOPLE = [
  { name: "Martin", jobCol: 47 /* AU */, repCol: 53 /* BA */, monthCol: 53 /* BA */ },
  { name: "Danny", jobCol: 62 /* BJ */, repCol: 68 /* BP */, monthCol: 68 /* BP */ },
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

function inspSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(INSP_TAB);
  if (sheet) return sheet;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) if (all[i].getSheetId() === INSP_GID) return all[i];
  return null;
}

/** A MovePro job number is always exactly 5 alphanumeric chars with a mix of
 * letters AND digits (e.g. "AY3VA"). Guards against a stray name/number typed
 * into the job# column being counted as a phantom inspection. */
function inspIsJobCode_(code) {
  return /^[A-Za-z0-9]{5}$/.test(code) && /[A-Za-z]/.test(code) && /[0-9]/.test(code);
}

/** Parse a number from a cell (number, or "16" / "$16" text); blank → 0. */
function inspNum_(v) {
  if (v === "" || v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

function pushInspections() {
  var t0 = new Date().getTime();
  var cfg = inspCfg_();
  var sheet = inspSheet_();
  if (!sheet) throw new Error('Tab "' + INSP_TAB + '" not found.');
  var today = Utilities.formatDate(new Date(), INSP_TZ, "yyyy-MM-dd");
  var lastRow = sheet.getLastRow();
  var n = Math.min(INSP_MAXROWS, Math.max(0, lastRow - INSP_FIRST_ROW + 1));

  var rows = INSP_PEOPLE.map(function (p) {
    // Month total: the displayed cell (merged 194-195 → value on row 194).
    var month = inspNum_(sheet.getRange(INSP_MONTH_ROW, p.monthCol).getValue());
    if (!month) month = inspNum_(sheet.getRange(INSP_MONTH_ROW + 1, p.monthCol).getValue());

    // Today's entries: each row with BOTH a job number and a sales rep.
    var jobs = [];
    if (n > 0) {
      var jobVals = sheet.getRange(INSP_FIRST_ROW, p.jobCol, n, 1).getValues();
      var repVals = sheet.getRange(INSP_FIRST_ROW, p.repCol, n, 1).getValues();
      for (var i = 0; i < n; i++) {
        var code = String(jobVals[i][0] || "").trim();
        var forRep = String(repVals[i][0] || "").trim();
        if (!code || !forRep) continue;
        if (!inspIsJobCode_(code)) continue; // stray name/number in the job# cell
        var lr = forRep.toLowerCase();
        if (lr === "sales rep") continue; // header guard
        jobs.push({ code: code, forRep: forRep });
      }
    }
    return { name: p.name, jobs: jobs, monthCount: Math.round(month) };
  });

  var summary = rows
    .map(function (x) {
      return x.name + " (today " + x.jobs.length + ", month " + x.monthCount + ")";
    })
    .join(", ");
  Logger.log("tab '%s', scanned %s rows in %sms — %s", sheet.getName(), n, new Date().getTime() - t0, summary);

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

/** onEdit — push only when the edit touches the inspection section (cols
 * AU..BP, row >= 194) of the Leaderboard tab. */
function onInspectionEdit(e) {
  if (!e || !e.range) return;
  if (e.range.getSheet().getName() !== INSP_TAB) return;
  if (e.range.getLastColumn() < 47 || e.range.getColumn() > 68) return;
  if (e.range.getLastRow() < INSP_MONTH_ROW) return;
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
