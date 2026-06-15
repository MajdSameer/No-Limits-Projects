/**
 * No Limits — Quote Leads → dashboard push (Google Apps Script).
 *
 * Bound to the "Quote Leads Auto Process" spreadsheet (its own Apps Script
 * project; needs its own DASHBOARD_URL + INGEST_SECRET script properties). Reads
 * the recent rows of the "Auto" tab and POSTs them to /api/ingest/leads, which
 * dedupes on the lead id and auto-allocates each new lead to the next-up rep.
 *
 * After pasting, run installLeadTriggers() once.
 */

var LEADS_TAB = "Auto";
var WINDOW_ROWS = 1000; // only the most recent rows; dedup makes overlap harmless
var BATCH = 300;

// 0-based column indexes (col A = 0) on the Auto tab.
var COL = { date: 1, details: 3, source: 7, name: 8, phone: 9, email: 12, id: 13 };

function pushLeads() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("DASHBOARD_URL");
  var secret = props.getProperty("INGEST_SECRET");
  if (!url || !secret) {
    throw new Error("Set DASHBOARD_URL and INGEST_SECRET in Project Settings → Script Properties.");
  }
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(LEADS_TAB);
  if (!sheet) throw new Error('Tab "' + LEADS_TAB + '" not found.');
  var tz = ss.getSpreadsheetTimeZone() || "Australia/Sydney";

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "no rows";
  var firstRow = Math.max(2, lastRow - WINDOW_ROWS + 1);
  var values = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, 14).getValues();

  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    var id = String(v[COL.id] || "").trim();
    if (!id) continue;
    var date = v[COL.date];
    rows.push({
      sheetId: id,
      receivedAt: date instanceof Date ? Utilities.formatDate(date, tz, "yyyy-MM-dd'T'HH:mm:ssXXX") : null,
      source: String(v[COL.source] || "").trim(),
      contactName: String(v[COL.name] || "").trim(),
      phone: String(v[COL.phone] || "").trim(),
      email: String(v[COL.email] || "").trim(),
      details: String(v[COL.details] || "").trim(),
    });
  }

  var endpoint = url.replace(/\/$/, "") + "/api/ingest/leads";
  var sent = 0;
  for (var b = 0; b < rows.length; b += BATCH) {
    var batch = rows.slice(b, b + BATCH);
    var res = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + secret },
      payload: JSON.stringify({ rows: batch }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) {
      throw new Error("Leads ingest failed " + res.getResponseCode() + ": " + res.getContentText());
    }
    sent += batch.length;
  }
  return "sent " + sent + " lead rows";
}

function onLeadEdit(e) {
  if (e && e.range && e.range.getSheet().getName() !== LEADS_TAB) return;
  pushLeads();
}

/** Run once to (re)install the lead edit + 5-minute triggers. */
function installLeadTriggers() {
  var ours = { onLeadEdit: true, pushLeads: true };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (ours[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("onLeadEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("pushLeads").timeBased().everyMinutes(5).create();
}
