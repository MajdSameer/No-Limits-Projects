/**
 * No Limits — Site Inspections → dashboard live push (Google Apps Script).
 *
 * The inspection details are entered in a TAB INSIDE THE FOLLOW-UP SHEET (the
 * same spreadsheet that runs leaderboard.gs). A spreadsheet has only ONE Apps
 * Script project, so this lives as an extra FILE in that project alongside
 * leaderboard.gs / roster.gs — it does not get its own project.
 *
 * For each row of the inspections tab that has all three of Job Number + Sales
 * Rep + Site Inspector filled, it POSTs to /api/ingest/inspectors, driving the
 * "Site Inspectors" boxes on /live and the applause celebration (inspector name,
 * job number, and the sales rep the inspection is for). Runs on edit (only when
 * the inspections tab is touched) and on a 5-minute timer.
 *
 * SETUP — see scripts/sheets/README.md. In short:
 *   1. In the FOLLOW-UP sheet's Apps Script project, add this as a new file.
 *      (DASHBOARD_URL / INGEST_SECRET script properties are already set there
 *      for leaderboard.gs.)
 *   2. Run installInspectorTriggers() once — it installs ONLY its own triggers,
 *      leaving the leaderboard/roster triggers untouched.
 *   3. Test: run pushInspections() and check the log, then open /live.
 */

var INSP_TZ = "Australia/Sydney"; // the floor's day, matches the dashboard
var INSP_GID = 947259945; // the inspections tab (fallback: find it by header)
var INSP_HEADER_SCAN = 40; // header may not be row 1 — scan the top N rows
var INSP_MAXROWS = 20000; // safety cap so a giant sheet can't time out

// Header names we accept for each column (lower-cased, exact match, in order).
var INSP_COLS = {
  inspector: ["site inspector", "site inspector name", "inspector", "inspector name"],
  sales: ["sales person", "sales rep", "sales rep name", "salesperson", "sales", "rep", "rep name", "consultant"],
  job: ["job number", "job #", "job no", "job no.", "movepro", "move pro", "movepro number", "move pro number", "job"],
  date: ["date", "inspection date", "site inspection date"],
};

function inspCfg_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("DASHBOARD_URL");
  var secret = props.getProperty("INGEST_SECRET");
  if (!url || !secret) {
    throw new Error("Set DASHBOARD_URL and INGEST_SECRET in Project Settings → Script Properties.");
  }
  return { url: url, secret: secret };
}

/** First column whose header matches one of the candidates, or -1. */
function inspFindCol_(hdr, cands) {
  for (var i = 0; i < cands.length; i++) {
    var idx = hdr.indexOf(cands[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

/** "yyyy-MM-dd" in Sydney for a cell that may be a Date or a date string. */
function inspYmd_(v) {
  if (v === "" || v == null) return "";
  var d = Object.prototype.toString.call(v) === "[object Date]" ? v : new Date(v);
  if (!d || isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, INSP_TZ, "yyyy-MM-dd");
}

/** Find the real table header row (has an inspector col AND a corroborating
 * one), so a stray "Site Inspector" label/box above the table is skipped. */
function inspHeader_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return null;
  var rows = Math.min(INSP_HEADER_SCAN, lastRow);
  var top = sheet.getRange(1, 1, rows, lastCol).getValues();
  for (var r = 0; r < top.length; r++) {
    var lc = top[r].map(function (x) {
      // Collapse internal whitespace incl. NEWLINES, so a header typed as
      // "job\nnumber" still matches the candidate "job number".
      return String(x).trim().toLowerCase().replace(/\s+/g, " ");
    });
    if (inspFindCol_(lc, INSP_COLS.inspector) === -1) continue;
    var corroborated =
      inspFindCol_(lc, INSP_COLS.job) !== -1 ||
      inspFindCol_(lc, INSP_COLS.sales) !== -1 ||
      inspFindCol_(lc, INSP_COLS.date) !== -1;
    if (corroborated) return { headerRow: r + 1, hdr: lc };
  }
  return null;
}

/** The inspections tab + its header row — by gid, else by header. */
function inspSheet_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === INSP_GID) {
      var h = inspHeader_(sheets[i]);
      if (h) return { sheet: sheets[i], hdr: h.hdr, headerRow: h.headerRow };
      break; // gid matched but no header found — fall through and scan others
    }
  }
  for (var j = 0; j < sheets.length; j++) {
    var h2 = inspHeader_(sheets[j]);
    if (h2) return { sheet: sheets[j], hdr: h2.hdr, headerRow: h2.headerRow };
  }
  return null;
}

function pushInspections() {
  var t0 = new Date().getTime();
  var cfg = inspCfg_();
  var found = inspSheet_();
  if (!found) throw new Error('No tab with a "Site Inspector" table header was found.');
  var sheet = found.sheet;
  var hdr = found.hdr;
  var headerRow = found.headerRow;

  var ciDate = inspFindCol_(hdr, INSP_COLS.date);
  var ciSales = inspFindCol_(hdr, INSP_COLS.sales);
  var ciJob = inspFindCol_(hdr, INSP_COLS.job);
  var ciInsp = inspFindCol_(hdr, INSP_COLS.inspector);
  if (ciInsp === -1 || ciSales === -1 || ciJob === -1) {
    throw new Error(
      "Couldn't match inspector/sales/job columns. Headers seen on row " +
        headerRow +
        ": [" +
        hdr.join(" | ") +
        "]",
    );
  }

  var today = Utilities.formatDate(new Date(), INSP_TZ, "yyyy-MM-dd");
  var thisMonth = today.slice(0, 7); // "yyyy-MM"
  var byName = {};
  function ins(name) {
    var k = String(name).trim();
    if (!byName[k]) byName[k] = { name: k, jobs: [], monthCount: 0 };
    return byName[k];
  }

  var n = sheet.getLastRow() - headerRow; // data rows below the header
  if (n > INSP_MAXROWS) n = INSP_MAXROWS;
  if (n > 0) {
    var present = [ciDate, ciSales, ciJob, ciInsp].filter(function (x) {
      return x >= 0;
    });
    var lo = Math.min.apply(null, present); // 0-based
    var hi = Math.max.apply(null, present);
    var block = sheet.getRange(headerRow + 1, lo + 1, n, hi - lo + 1).getValues();
    function cell(rowArr, ci) {
      return ci < 0 ? "" : rowArr[ci - lo];
    }
    for (var r = 0; r < block.length; r++) {
      var row = block[r];
      var inspector = String(cell(row, ciInsp) || "").trim();
      if (!inspector) continue;
      var box = ins(inspector); // always list the inspector so its box shows (even at 0)
      // Counts (and celebrates) only with all three: job # + sales rep + inspector.
      var code = String(cell(row, ciJob) || "").trim();
      var forRep = String(cell(row, ciSales) || "").trim();
      if (!code || !forRep) continue;
      // An undated freshly-filled row counts as today (date optional for the rep).
      var ymd = ciDate === -1 ? "" : inspYmd_(cell(row, ciDate));
      var ym = ymd === "" ? thisMonth : ymd.slice(0, 7);
      // Monthly total: every row dated in (or undated within) the current month.
      if (ym === thisMonth) box.monthCount++;
      // Today's board / celebration: only today's (or undated) rows.
      if (ymd === "" || ymd === today) box.jobs.push({ code: code, forRep: forRep });
    }
  }

  var rows = Object.keys(byName).map(function (k) {
    return byName[k];
  });
  var summary = rows
    .map(function (x) {
      return x.name + " (today " + x.jobs.length + ", month " + x.monthCount + ")";
    })
    .join(", ");
  Logger.log(
    "tab '%s', header row %s, read %s rows in %sms — %s",
    sheet.getName(),
    headerRow,
    n,
    new Date().getTime() - t0,
    summary || "no inspectors",
  );

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

/** onEdit target — only pushes when the inspections tab itself is edited. */
function onInspectionEdit(e) {
  if (e && e.range && e.range.getSheet().getSheetId() !== INSP_GID) return;
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
