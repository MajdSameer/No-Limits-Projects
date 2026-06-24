/**
 * No Limits — Subcontractor jobs → dashboard live push (Google Apps Script).
 *
 * The subcontractor's jobs are logged in a section of the "Leaderboard" tab (the
 * same Follow-Up spreadsheet that runs leaderboard.gs / inspectors.gs). A
 * spreadsheet has only ONE Apps Script project, so this lives as an extra FILE
 * in that project alongside the others.
 *
 * Layout (fixed cells), for "Domanic":
 *   Today's count : AE194   (the "Today's N / 12" cell — N)
 *   Monthly total : AK194   (the "Monthly" cell)
 *   Job list      : AE198 downward (free-text job refs; cosmetic only)
 * The "/ 12" daily target is fixed and lives in the dashboard, not pushed.
 *
 * Each push drives the orange "Subcontractor" box on /live (today / 12 + month)
 * and the orange celebration (fires when the today count ticks up).
 *
 * SETUP — see scripts/sheets/README.md. In short:
 *   1. In the Follow-Up sheet's Apps Script project, add this as a new file.
 *   2. Run installSubcontractorTriggers() once — it installs ONLY its own triggers.
 *   3. Test: run pushSubcontractors() and check the log, then open /live.
 */

var SUB_TZ = "Australia/Sydney";
var SUB_TAB = "Leaderboard"; // tab holding the subcontractor section
var SUB_GID = 1760907362; // fallback if the tab gets renamed
var SUB_FIRST_ROW = 198; // first row of today's job entries
var SUB_TODAY_ROW = 194; // row with the displayed "Today's N" count
var SUB_MONTH_ROW = 194; // row with the displayed "Monthly" total
var SUB_MAXROWS = 600; // how far down to scan for job entries

// Per subcontractor: 1-based columns. Today's count + monthly total are displayed
// cells; the job list grows down from SUB_FIRST_ROW in jobCol.
var SUB_PEOPLE = [
  { name: "Domanic", countCol: 31 /* AE */, monthCol: 37 /* AK */, jobCol: 31 /* AE */ },
];

function subCfg_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("DASHBOARD_URL");
  var secret = props.getProperty("INGEST_SECRET");
  if (!url || !secret) {
    throw new Error("Set DASHBOARD_URL and INGEST_SECRET in Project Settings → Script Properties.");
  }
  return { url: url, secret: secret };
}

function subSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SUB_TAB);
  if (sheet) return sheet;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) if (all[i].getSheetId() === SUB_GID) return all[i];
  return null;
}

/** Parse a number from a cell (number, or "16" / "$16" text); blank → 0. */
function subNum_(v) {
  if (v === "" || v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

function pushSubcontractors() {
  var t0 = new Date().getTime();
  var cfg = subCfg_();
  var sheet = subSheet_();
  if (!sheet) throw new Error('Tab "' + SUB_TAB + '" not found.');
  var today = Utilities.formatDate(new Date(), SUB_TZ, "yyyy-MM-dd");
  var lastRow = sheet.getLastRow();
  var n = Math.min(SUB_MAXROWS, Math.max(0, lastRow - SUB_FIRST_ROW + 1));

  var rows = SUB_PEOPLE.map(function (p) {
    var count = Math.round(subNum_(sheet.getRange(SUB_TODAY_ROW, p.countCol).getValue()));
    var month = Math.round(subNum_(sheet.getRange(SUB_MONTH_ROW, p.monthCol).getValue()));

    // Job list (cosmetic only — the box shows counts, not these). Each non-empty
    // cell below the header; dedupe and drop an accidental "Job number" header.
    var jobs = [];
    if (n > 0) {
      var vals = sheet.getRange(SUB_FIRST_ROW, p.jobCol, n, 1).getValues();
      var seen = {};
      for (var i = 0; i < n; i++) {
        var v = String(vals[i][0] || "").trim();
        if (!v) continue;
        var lv = v.toLowerCase();
        if (lv === "job number" || lv === "job") continue; // header guard
        if (seen[v]) continue;
        seen[v] = true;
        jobs.push(v);
      }
    }
    return { name: p.name, count: count, monthCount: month, jobs: jobs };
  });

  var summary = rows
    .map(function (x) {
      return x.name + " (today " + x.count + ", month " + x.monthCount + ", jobs " + x.jobs.length + ")";
    })
    .join(", ");
  Logger.log("tab '%s', scanned %s rows in %sms — %s", sheet.getName(), n, new Date().getTime() - t0, summary);

  var res = UrlFetchApp.fetch(cfg.url.replace(/\/$/, "") + "/api/ingest/subcontractors", {
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

/** onEdit — push only when the edit touches the subcontractor section (cols
 * AE..AK = 31..37, row >= 191) of the Leaderboard tab. */
function onSubcontractorEdit(e) {
  if (!e || !e.range) return;
  if (e.range.getSheet().getName() !== SUB_TAB) return;
  if (e.range.getLastColumn() < 31 || e.range.getColumn() > 37) return;
  if (e.range.getLastRow() < 191) return;
  pushSubcontractors();
}

/** Installs ONLY the subcontractor triggers (leaves the leaderboard / inspector
 * / roster ones alone). Safe to re-run. */
function installSubcontractorTriggers() {
  var mine = { onSubcontractorEdit: true, pushSubcontractors: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (mine[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onSubcontractorEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushSubcontractors").timeBased().everyMinutes(5).create();
}
