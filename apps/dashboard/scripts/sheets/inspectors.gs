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

/** The tab that holds the inspections (found by its "Site Inspector" header). */
function inspSheet_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var lastCol = sh.getLastColumn();
    if (lastCol < 1) continue;
    var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (x) {
      return String(x).trim().toLowerCase();
    });
    if (hdr.indexOf("site inspector") !== -1) return { sheet: sh, hdr: hdr };
  }
  return null;
}

function pushInspections() {
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

  var today = Utilities.formatDate(new Date(), INSP_TZ, "yyyy-MM-dd");
  var byName = {};
  function ins(name) {
    var k = String(name).trim();
    if (!byName[k]) byName[k] = { name: k, jobs: [] };
    return byName[k];
  }

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      var inspector = String(row[ciInsp] || "").trim();
      if (!inspector) continue;
      ins(inspector); // always list the inspector so its box shows (even at 0)
      if (ciDate === -1 || inspYmd_(row[ciDate]) !== today) continue;
      var code = ciJob === -1 ? "" : String(row[ciJob] || "").trim();
      if (!code) continue; // only count inspections that have a job number
      var forRep = ciSales === -1 ? "" : String(row[ciSales] || "").trim();
      ins(inspector).jobs.push({ code: code, forRep: forRep || null });
    }
  }

  var rows = Object.keys(byName).map(function (k) {
    return byName[k];
  });
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

/** Run once to (re)install the edit + 5-minute triggers. Safe to re-run. */
function installInspectorTriggers() {
  var ours = { onInspectionEdit: true, pushInspections: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (ours[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onInspectionEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushInspections").timeBased().everyMinutes(5).create();
}
