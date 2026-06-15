/**
 * No Limits — Live Roster → dashboard push (Google Apps Script).
 *
 * Lives in the SAME Apps Script project as leaderboard.gs (both bound to the
 * Follow-Up spreadsheet, sharing the DASHBOARD_URL / INGEST_SECRET script
 * properties). Reads the "Live Roster" tab's weekly grid (who works which day)
 * and POSTs it to /api/ingest/roster, which writes the shifts table behind the
 * dashboard's /roster + /manage views.
 *
 * After pasting, run installRosterTriggers() once (in addition to the
 * leaderboard's installTriggers()).
 */

var ROSTER_TAB = "Live Roster";
var ROSTER_HEADER_RANGE = "A4:J26"; // row 4 = day headers; names in col A/B; presence in day cols
var DAY_TO_WEEKDAY = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
var ROSTER_SKIP = { "team members": 1, morning: 1, afternoon: 1, day: 1, name: 1, "": 1 };

function pushRoster() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("DASHBOARD_URL");
  var secret = props.getProperty("INGEST_SECRET");
  if (!url || !secret) {
    throw new Error("Set DASHBOARD_URL and INGEST_SECRET in Project Settings → Script Properties.");
  }

  var sheet = SpreadsheetApp.getActive().getSheetByName(ROSTER_TAB);
  if (!sheet) throw new Error('Tab "' + ROSTER_TAB + '" not found.');
  var grid = sheet.getRange(ROSTER_HEADER_RANGE).getDisplayValues();

  // Map day columns from the header row (grid[0]).
  var dayCols = {}; // columnIndex -> weekday
  for (var c = 0; c < grid[0].length; c++) {
    var label = String(grid[0][c] || "").trim().toLowerCase();
    if (DAY_TO_WEEKDAY.hasOwnProperty(label)) dayCols[c] = DAY_TO_WEEKDAY[label];
  }

  var rows = [];
  for (var r = 1; r < grid.length; r++) {
    var name = String(grid[r][1] || grid[r][0] || "").trim(); // col B then col A
    if (ROSTER_SKIP[name.toLowerCase()]) continue;
    var weekdays = [];
    for (var col in dayCols) {
      if (String(grid[r][col] || "").trim() !== "") weekdays.push(dayCols[col]);
    }
    if (name) rows.push({ name: name, weekdays: weekdays });
  }

  var res = UrlFetchApp.fetch(url.replace(/\/$/, "") + "/api/ingest/roster", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret },
    payload: JSON.stringify({ rows: rows }),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code >= 300) throw new Error("Roster ingest failed " + code + ": " + res.getContentText());
  return res.getContentText();
}

function onRosterEdit(e) {
  if (e && e.range && e.range.getSheet().getName() !== ROSTER_TAB) return;
  pushRoster();
}

/** Run once to (re)install the roster edit + 15-minute triggers. Safe to re-run. */
function installRosterTriggers() {
  var ours = { onRosterEdit: true, pushRoster: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (ours[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onRosterEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushRoster").timeBased().everyMinutes(15).create();
}
