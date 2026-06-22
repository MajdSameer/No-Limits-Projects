/**
 * No Limits — Site Inspections → dashboard live push (Google Apps Script).
 *
 * Bound to the SITE-INSPECTION BOOKINGS spreadsheet (the one whose tab has a
 * "Site Inspector" column). Each row is one inspection: a Date, the Sales Person
 * whose customer it's for, a Job Number, and the Site Inspector (Martin, Danny…).
 *
 * It collects today's job-numbered inspections per inspector and POSTs them to
 * the dashboard's /api/ingest/inspectors, which drives the "Site Inspectors"
 * boxes on /live and the applause celebration. Runs on edit and on a 5-minute
 * timer; runs as you in Google, so there's no OAuth token to expire.
 *
 * SETUP — see scripts/sheets/README.md. In short:
 *   1. Open the bookings spreadsheet → Extensions → Apps Script, paste this in.
 *   2. Project Settings → Script Properties: add
 *        DASHBOARD_URL  = https://<your-dashboard>.vercel.app
 *        INGEST_SECRET  = <same value as the dashboard's INGEST_SECRET>
 *   3. Run installInspectorTriggers() once and authorize.
 *   4. Test: run pushInspections() and check the log, then open /live.
 */

var INSP_TZ = "Australia/Sydney"; // the floor's day, matches the dashboard
var INSP_GID = 1132462575; // the inspections tab (fallback: find by header)
var INSP_MAXROWS = 20000; // safety cap so a giant sheet can't time out

function inspCfg_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("DASHBOARD_URL");
  var secret = props.getProperty("INGEST_SECRET");
  if (!url || !secret) {
    throw new Error("Set DASHBOARD_URL and INGEST_SECRET in Project Settings → Script Properties.");
  }
  return { url: url, secret: secret };
}

/** "yyyy-MM-dd" in Sydney for a cell that may be a Date or a date string. */
function inspYmd_(v) {
  if (v === "" || v == null) return "";
  var d = Object.prototype.toString.call(v) === "[object Date]" ? v : new Date(v);
  if (!d || isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, INSP_TZ, "yyyy-MM-dd");
}

/** The inspections tab — by gid, else the tab whose header row has the column. */
function inspSheet_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  var sh = null;
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === INSP_GID) {
      sh = sheets[i];
      break;
    }
  }
  if (!sh) {
    for (var j = 0; j < sheets.length && !sh; j++) {
      var lc = sheets[j].getLastColumn();
      if (lc < 1) continue;
      var h = sheets[j].getRange(1, 1, 1, lc).getValues()[0];
      for (var k = 0; k < h.length; k++) {
        if (String(h[k]).trim().toLowerCase() === "site inspector") {
          sh = sheets[j];
          break;
        }
      }
    }
  }
  if (!sh) return null;
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) {
    return String(x).trim().toLowerCase();
  });
  return { sheet: sh, hdr: hdr };
}

function pushInspections() {
  var t0 = new Date().getTime();
  var cfg = inspCfg_();
  var found = inspSheet_();
  if (!found) throw new Error('No tab with a "Site Inspector" column was found.');
  var sheet = found.sheet;
  var hdr = found.hdr;
  function col(name) {
    return hdr.indexOf(name);
  }
  var ciDate = col("date");
  var ciSales = col("sales person");
  var ciJob = col("job number");
  var ciInsp = col("site inspector");
  if (ciInsp === -1) throw new Error('No "Site Inspector" column in the header row.');

  var today = Utilities.formatDate(new Date(), INSP_TZ, "yyyy-MM-dd");
  var byName = {};
  function ins(name) {
    var k = String(name).trim();
    if (!byName[k]) byName[k] = { name: k, jobs: [] };
    return byName[k];
  }

  var n = sheet.getLastRow() - 1; // data rows (excl. header)
  if (n > INSP_MAXROWS) n = INSP_MAXROWS;
  if (n > 0) {
    // Read ONLY the columns we need (one narrow block) — pulling the whole
    // 20-column range across the Apps Script bridge is what timed out.
    var present = [ciDate, ciSales, ciJob, ciInsp].filter(function (x) {
      return x >= 0;
    });
    var lo = Math.min.apply(null, present); // 0-based
    var hi = Math.max.apply(null, present);
    var block = sheet.getRange(2, lo + 1, n, hi - lo + 1).getValues();
    function cell(rowArr, ci) {
      return ci < 0 ? "" : rowArr[ci - lo];
    }
    for (var r = 0; r < block.length; r++) {
      var row = block[r];
      var inspector = String(cell(row, ciInsp) || "").trim();
      if (!inspector) continue;
      ins(inspector); // always list the inspector so its box shows (even at 0)
      if (ciDate === -1 || inspYmd_(cell(row, ciDate)) !== today) continue;
      var code = String(cell(row, ciJob) || "").trim();
      if (!code) continue; // only count inspections that have a job number
      var forRep = String(cell(row, ciSales) || "").trim();
      ins(inspector).jobs.push({ code: code, forRep: forRep || null });
    }
  }

  var rows = Object.keys(byName).map(function (k) {
    return byName[k];
  });
  Logger.log("read %s rows in %sms, %s inspectors", n, new Date().getTime() - t0, rows.length);

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

/** onEdit installable trigger target — pushes on any edit to the bookings sheet. */
function onInspectionEdit() {
  pushInspections();
}

/** Run once to (re)install the edit + 5-minute triggers. Safe to re-run.
 *
 * Clears ALL of this project's triggers first — Apps Script caps a project at 20
 * triggers, and leftover/duplicate ones from earlier runs hit that cap ("This
 * script has too many triggers"). This is a dedicated project for the
 * inspections push, so wiping its triggers is safe. */
function installInspectorTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onInspectionEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushInspections").timeBased().everyMinutes(5).create();
}
