/**
 * No Limits — Leaderboard → dashboard push (Google Apps Script).
 *
 * Bound to the "Follow-Up" spreadsheet. Reads the "Leaderboard" tab and POSTs a
 * snapshot (roster, today's booking counts + job codes, clock) to the
 * dashboard's /api/ingest/leaderboard endpoint. Runs on edit and on a 5-minute
 * timer. Because it runs as you inside Google, there's no OAuth token to expire.
 *
 * SETUP — see scripts/sheets/README.md. In short:
 *   1. Extensions → Apps Script, paste this file.
 *   2. Project Settings → Script Properties: add
 *        DASHBOARD_URL  = https://<your-dashboard>.vercel.app
 *        INGEST_SECRET  = <same value as the dashboard's INGEST_SECRET>
 *   3. Run installTriggers() once and authorize.
 */

var TAB = "Leaderboard";
var ROSTER_RANGE = "A5:J25"; // weight,name,goal, … ,clockName,timeIn,breakStart,breakEnd,timeOut,hours
var COUNTS_RANGE = "A39:Z60"; // flag,name,count, then job codes across (D onward — wide enough for reps with 6+ today)

function pushLeaderboard() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("DASHBOARD_URL");
  var secret = props.getProperty("INGEST_SECRET");
  if (!url || !secret) {
    throw new Error("Set DASHBOARD_URL and INGEST_SECRET in Project Settings → Script Properties.");
  }

  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB);
  if (!sheet) throw new Error('Tab "' + TAB + '" not found.');

  var byName = {}; // keyed by lowercased name
  function row(name) {
    var key = String(name).trim().toLowerCase();
    if (!byName[key]) byName[key] = { name: String(name).trim() };
    return byName[key];
  }

  // Roster + clock (rows 5-20). Numbers from getValues, clock strings from display.
  var rv = sheet.getRange(ROSTER_RANGE).getValues();
  var rd = sheet.getRange(ROSTER_RANGE).getDisplayValues();
  for (var i = 0; i < rv.length; i++) {
    var name = String(rv[i][1] || "").trim(); // col B
    var weight = Number(rv[i][0]); // col A
    if (!name || !isFinite(weight) || weight <= 0) continue;
    var r = row(name);
    r.intakeWeight = weight;
    r.dailyTarget = Number(rv[i][2]) || 0; // col C
    r.timeIn = rd[i][5] || null; // col F
    r.breakStart = rd[i][6] || null; // col G
    r.breakEnd = rd[i][7] || null; // col H
    r.timeOut = rd[i][8] || null; // col I
    r.workingHours = rd[i][9] || null; // col J
  }

  // Booking counts + job codes (rows ~40-55).
  var cv = sheet.getRange(COUNTS_RANGE).getValues();
  for (var j = 0; j < cv.length; j++) {
    var cname = String(cv[j][1] || "").trim(); // col B
    var count = cv[j][2]; // col C
    if (!cname || count === "" || isNaN(Number(count))) continue;
    var rr = row(cname);
    rr.bookingsToday = Number(count);
    var codes = [];
    for (var c = 3; c < cv[j].length; c++) {
      var code = String(cv[j][c] || "").trim();
      if (code) codes.push(code);
    }
    rr.jobCodes = codes;
  }

  var rows = Object.keys(byName).map(function (k) {
    return byName[k];
  });

  var res = UrlFetchApp.fetch(url.replace(/\/$/, "") + "/api/ingest/leaderboard", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code >= 300) {
    throw new Error("Ingest failed " + code + ": " + res.getContentText());
  }
  return res.getContentText();
}

/** onEdit installable trigger target — only pushes for edits on the Leaderboard tab. */
function onLeaderboardEdit(e) {
  if (e && e.range && e.range.getSheet().getName() !== TAB) return;
  pushLeaderboard();
}

/** Run once to (re)install the edit + 5-minute triggers. Safe to re-run. */
function installTriggers() {
  var ours = { onLeaderboardEdit: true, pushLeaderboard: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (ours[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onLeaderboardEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushLeaderboard").timeBased().everyMinutes(5).create();
}
