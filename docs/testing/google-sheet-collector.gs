/**
 * ============================================================================
 *  YAPPR - TEST SESSION COLLECTOR - TEMPORARY, USER TESTING PHASE ONLY
 * ============================================================================
 *
 * Google Apps Script that receives one finished Yappr call session and appends
 * it as a row. Paste this into a new Google Sheet's Apps Script editor and
 * deploy it as a Web App; the deployment URL becomes TEST_LOG_WEBHOOK_URL.
 *
 * Setup is in docs/testing/README.md. Removal is in TESTING-ONLY.md.
 *
 * WHAT LANDS HERE IS PERSONAL DATA: names a booking is made under, what
 * someone wants, where they are, occasionally health details. Keep the Sheet
 * private. Do not publish it to the web, and do not share the link onward.
 */

/** Columns, in order. Add to the end only, so existing rows stay aligned. */
var HEADERS = [
  'loggedAt',
  'commit',
  'branch',
  'environment',
  'startedAt',
  'durationSeconds',
  'travelerLanguage',
  'localLanguage',
  'businessType',
  'place',
  'goal',
  'extraNotes',
  'turns',
  'outcome',
  'headline',
  'agreed',
  'unresolved',
  'nextSteps',
  'transcript',
  'commitMessage',
  'deploymentUrl',
  'raw',
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // First run: write the header row and freeze it.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
    }

    var summary = data.summary || {};

    // The transcript is flattened to one readable cell. The full structured
    // payload also goes in `raw`, so nothing is lost if this shape changes.
    var transcript = (data.transcript || [])
      .map(function (line) {
        var translation = line.translation ? '\n    ' + line.translation : '';
        return '[' + line.speaker + '] ' + line.original + translation;
      })
      .join('\n');

    sheet.appendRow([
      data.loggedAt || new Date().toISOString(),
      data.commit || '',
      data.branch || '',
      data.environment || '',
      data.startedAt || '',
      data.durationSeconds === null || data.durationSeconds === undefined
        ? ''
        : data.durationSeconds,
      data.travelerLanguage || '',
      data.localLanguage || '',
      data.businessType || '',
      data.place || '',
      data.goal || '',
      data.extraNotes || '',
      data.turns === null || data.turns === undefined ? '' : data.turns,
      summary.outcome || '',
      summary.headline || '',
      (summary.agreed || []).join('\n'),
      (summary.unresolved || []).join('\n'),
      (summary.nextSteps || []).join('\n'),
      transcript,
      data.commitMessage || '',
      data.deploymentUrl || '',
      JSON.stringify(data),
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // Never fail loudly: a broken collector must not affect the app.
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(error) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/** Lets you confirm the deployment is alive by opening the URL in a browser. */
function doGet() {
  return ContentService.createTextOutput(
    'Yappr test-session collector is running. POST sessions here.'
  );
}
