var SETTINGS = {
  SPREADSHEET_ID: "PASTE_GOOGLE_SHEET_ID_HERE",
  ROOT_FOLDER_ID: "PASTE_GOOGLE_DRIVE_FOLDER_ID_HERE",
  TEAM_EMAIL: "recruitment@meutimisoara.eu",
  SEND_EMAILS: true,
  RETENTION_NOTICE: "Recommended retention: 12 months after selection, unless the candidate is selected and data is required for event operations."
};

var APPLICATION_HEADERS = [
  "application_id", "timestamp", "status",
  "full_name", "first_name", "last_name", "email", "phone", "date_of_birth",
  "country_residence", "nationality", "city", "institution", "subject_study", "study_level",
  "application_track", "preferred_role", "secondary_role",
  "participant_primary_role", "participant_secondary_role", "previous_meu", "previous_meu_details",
  "participant_primary_essay", "participant_secondary_essay",
  "content_role", "content_role_essay", "content_contribution", "leadership_experience", "procedural_experience",
  "personal_profile", "motivation_text", "contribution_text", "english_level", "availability_full_event",
  "social_link", "languages", "financial_support", "dietary_restrictions", "accessibility_needs", "upload_notes",
  "gdpr_privacy_accept", "gdpr_truthfulness", "gdpr_contact_accept", "media_consent", "future_contact_consent",
  "candidate_folder_url", "cv_url", "photo_url", "video_url", "client_submitted_at", "user_agent", "source"
];

var REVIEW_HEADERS = [
  "application_id", "status", "decision", "full_name", "email", "application_track", "preferred_role",
  "secondary_role", "country_residence", "score_role_clarity", "score_motivation", "score_experience",
  "score_presence", "score_contribution", "score_communication", "weighted_score", "reviewer",
  "review_notes", "interview_slot", "final_notes"
];

var SHORTLIST_HEADERS = ["application_id", "full_name", "track", "primary_role", "secondary_role", "decision", "owner", "notes"];
var INTERVIEW_HEADERS = ["application_id", "full_name", "track", "interviewer", "slot", "result", "notes"];
var FINAL_HEADERS = ["application_id", "full_name", "track", "role", "final_status", "email_sent", "notes"];
var LOG_HEADERS = ["timestamp", "event", "application_id", "message"];

var STATUSES = ["Received", "Eligible", "Incomplete", "Duplicate", "In Review", "Shortlisted", "Interview", "Accepted", "Waitlisted", "Rejected", "Withdrawn"];
var DECISIONS = ["Pending", "Advance", "Hold", "Reject", "Accept", "Waitlist"];

var TRACK_CODES = {
  "Participants": "PAR",
  "Content": "CON"
};

var PARTICIPANT_ROLES = [
  "Member of the European Parliament",
  "Member of the EU Council",
  "Journalist"
];

var CONTENT_ROLES = [
  "President of the European Parliament",
  "Vice-President of the European Parliament",
  "President of the EU Council",
  "Vice-President of the EU Council",
  "Legal Advisor",
  "European Commissioner",
  "Academic / Procedural Support"
];

var COUNTRY_CODES = {
  "Albania": "AL", "Andorra": "AD", "Armenia": "AM", "Austria": "AT", "Azerbaijan": "AZ",
  "Belarus": "BY", "Belgium": "BE", "Bosnia and Herzegovina": "BA", "Bulgaria": "BG", "Croatia": "HR",
  "Cyprus": "CY", "Czechia": "CZ", "Denmark": "DK", "Estonia": "EE", "Finland": "FI",
  "France": "FR", "Georgia": "GE", "Germany": "DE", "Greece": "GR", "Hungary": "HU",
  "Iceland": "IS", "Ireland": "IE", "Italy": "IT", "Kosovo": "XK", "Latvia": "LV",
  "Liechtenstein": "LI", "Lithuania": "LT", "Luxembourg": "LU", "Malta": "MT", "Moldova": "MD",
  "Monaco": "MC", "Montenegro": "ME", "Netherlands": "NL", "North Macedonia": "MK", "Norway": "NO",
  "Poland": "PL", "Portugal": "PT", "Romania": "RO", "San Marino": "SM", "Serbia": "RS",
  "Slovakia": "SK", "Slovenia": "SI", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH",
  "Turkey": "TR", "Ukraine": "UA", "United Kingdom": "GB", "Vatican City": "VA", "Other / Non-European": "OT"
};

function doGet() {
  return jsonOutput({
    ok: true,
    service: "MEU Timisoara 2027 Recruitment Hub",
    status: "ready"
  });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var payload = JSON.parse(raw);
    return jsonOutput(handleApplication_(payload));
  } catch (error) {
    logEvent_("ERROR", "", error.stack || error.message);
    return jsonOutput({ ok: false, error: error.message });
  }
}

function setupRecruitmentHub() {
  var ss = getSpreadsheet_();
  var applications = ensureSheet_(ss, "Applications", APPLICATION_HEADERS);
  var review = ensureSheet_(ss, "Review", REVIEW_HEADERS);
  var shortlist = ensureSheet_(ss, "Shortlist", SHORTLIST_HEADERS);
  var interview = ensureSheet_(ss, "Interview", INTERVIEW_HEADERS);
  var finalSelection = ensureSheet_(ss, "FinalSelection", FINAL_HEADERS);
  ensureSheet_(ss, "Logs", LOG_HEADERS);
  buildConfigSheet_(ss);

  applyValidation_(applications, "status", STATUSES);
  applyValidation_(applications, "application_track", Object.keys(TRACK_CODES));
  applyValidation_(review, "status", STATUSES);
  applyValidation_(review, "decision", DECISIONS);
  applyValidation_(shortlist, "decision", DECISIONS);
  applyValidation_(interview, "result", DECISIONS);
  applyValidation_(finalSelection, "final_status", STATUSES);

  logEvent_("SETUP", "", "Recruitment hub sheets configured.");
}

function handleApplication_(payload) {
  validateSettings_();

  var fields = payload.fields || {};
  assertRequired_(fields, ["full_name", "email", "country_residence", "application_track", "preferred_role"]);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var applicationId = nextApplicationId_(fields);
    var root = DriveApp.getFolderById(SETTINGS.ROOT_FOLDER_ID);
    var candidateFolder = root.createFolder(applicationId + "_" + safeName_(fields.full_name));
    var files = payload.files || {};

    var cvUrl = saveBase64File_(candidateFolder, files.cv, applicationId + "_CV");
    var photoUrl = saveBase64File_(candidateFolder, files.photo, applicationId + "_PHOTO");
    var videoUrl = saveBase64File_(candidateFolder, files.video, applicationId + "_VIDEO");

    appendApplication_(applicationId, fields, {
      candidate_folder_url: candidateFolder.getUrl(),
      cv_url: cvUrl,
      photo_url: photoUrl,
      video_url: videoUrl,
      client_submitted_at: payload.submitted_at_client || "",
      user_agent: payload.user_agent || "",
      source: payload.source || "MEU Timisoara 2027 Recruitment Hub"
    });

    appendReview_(applicationId, fields);
    logEvent_("APPLICATION_RECEIVED", applicationId, fields.email);

    if (SETTINGS.SEND_EMAILS) {
      sendCandidateEmail_(fields.email, fields.full_name, applicationId);
      sendTeamAlert_(fields, applicationId, candidateFolder.getUrl());
    }

    return { ok: true, application_id: applicationId, folder_url: candidateFolder.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

function appendApplication_(applicationId, fields, links) {
  var sheet = getSpreadsheet_().getSheetByName("Applications");
  var merged = {};

  APPLICATION_HEADERS.forEach(function (header) {
    merged[header] = "";
  });

  Object.keys(fields).forEach(function (key) {
    merged[key] = Array.isArray(fields[key]) ? fields[key].join(", ") : fields[key];
  });

  Object.keys(links).forEach(function (key) {
    merged[key] = links[key];
  });

  merged.application_id = applicationId;
  merged.timestamp = new Date();
  merged.status = "Received";
  sheet.appendRow(APPLICATION_HEADERS.map(function (header) { return merged[header]; }));
}

function appendReview_(applicationId, fields) {
  var sheet = getSpreadsheet_().getSheetByName("Review");
  var rowNumber = sheet.getLastRow() + 1;
  var values = {
    application_id: applicationId,
    status: "Received",
    decision: "Pending",
    full_name: fields.full_name || "",
    email: fields.email || "",
    application_track: fields.application_track || "",
    preferred_role: fields.preferred_role || "",
    secondary_role: fields.secondary_role || "",
    country_residence: fields.country_residence || "",
    weighted_score: '=IF(COUNTA(J' + rowNumber + ':O' + rowNumber + ')=0,"",ROUND(AVERAGE(J' + rowNumber + ':O' + rowNumber + '),2))'
  };

  sheet.appendRow(REVIEW_HEADERS.map(function (header) { return values[header] || ""; }));
}

function saveBase64File_(folder, filePayload, baseName) {
  if (!filePayload || !filePayload.data) {
    throw new Error("Missing file payload for " + baseName);
  }

  var type = filePayload.type || "application/octet-stream";
  var originalName = filePayload.name || baseName;
  var extension = originalName.indexOf(".") > -1 ? originalName.substring(originalName.lastIndexOf(".")) : "";
  var bytes = Utilities.base64Decode(filePayload.data);
  var blob = Utilities.newBlob(bytes, type, baseName + extension);
  var file = folder.createFile(blob);
  file.setDescription("Uploaded through MEU Timisoara 2027 Recruitment Hub.");
  return file.getUrl();
}

function nextApplicationId_(fields) {
  var props = PropertiesService.getScriptProperties();
  var next = Number(props.getProperty("NEXT_SEQUENCE") || "1");
  props.setProperty("NEXT_SEQUENCE", String(next + 1));

  var trackCode = TRACK_CODES[fields.application_track] || "APP";
  var countryCode = COUNTRY_CODES[fields.country_residence] || "XX";
  return "MEUTM27-" + trackCode + "-" + countryCode + "-" + Utilities.formatString("%04d", next);
}

function sendCandidateEmail_(email, name, applicationId) {
  if (!email) return;

  var subject = "MEU Timisoara 2027 application received - " + applicationId;
  var plain = [
    "Dear " + (name || "candidate") + ",",
    "",
    "Your application for MEU Timisoara 2027 has been received.",
    "Application ID: " + applicationId,
    "",
    SETTINGS.RETENTION_NOTICE,
    "",
    "MEU Timisoara Recruitment Team"
  ].join("\n");

  var html = [
    "<p>Dear " + escapeHtml_(name || "candidate") + ",</p>",
    "<p>Your application for <strong>MEU Timisoara 2027</strong> has been received.</p>",
    "<p><strong>Application ID:</strong> " + applicationId + "</p>",
    "<p>" + escapeHtml_(SETTINGS.RETENTION_NOTICE) + "</p>",
    "<p>MEU Timisoara Recruitment Team</p>"
  ].join("");

  MailApp.sendEmail({ to: email, subject: subject, body: plain, htmlBody: html });
}

function sendTeamAlert_(fields, applicationId, folderUrl) {
  if (!SETTINGS.TEAM_EMAIL) return;

  var subject = "New MEU TM 2027 application - " + applicationId;
  var body = [
    "New application received.",
    "",
    "Application ID: " + applicationId,
    "Name: " + (fields.full_name || ""),
    "Email: " + (fields.email || ""),
    "Track: " + (fields.application_track || ""),
    "Primary role: " + (fields.preferred_role || ""),
    "Secondary role: " + (fields.secondary_role || "Not applicable"),
    "Country: " + (fields.country_residence || ""),
    "Folder: " + folderUrl
  ].join("\n");

  MailApp.sendEmail(SETTINGS.TEAM_EMAIL, subject, body);
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    headers.forEach(function (header, index) {
      if (existing[index] !== header) sheet.getRange(1, index + 1).setValue(header);
    });
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#001040").setFontColor("#ffffff");
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function buildConfigSheet_(ss) {
  var sheet = ss.getSheetByName("Config") || ss.insertSheet("Config");
  var countries = Object.keys(COUNTRY_CODES).sort();
  var tracks = Object.keys(TRACK_CODES);
  var scoreLabels = ["Role clarity", "Motivation", "Experience", "Presence", "Contribution", "Communication"];
  var maxRows = Math.max(countries.length, tracks.length, PARTICIPANT_ROLES.length, CONTENT_ROLES.length, STATUSES.length, DECISIONS.length, scoreLabels.length) + 1;

  sheet.clear();
  sheet.getRange(1, 1, maxRows, 7).clearContent();
  sheet.getRange(1, 1, 1, 7).setValues([["Countries", "Tracks", "Participant roles", "Content roles", "Statuses", "Decisions", "Score labels"]]);

  countries.forEach(function (item, index) { sheet.getRange(index + 2, 1).setValue(item); });
  tracks.forEach(function (item, index) { sheet.getRange(index + 2, 2).setValue(item); });
  PARTICIPANT_ROLES.forEach(function (item, index) { sheet.getRange(index + 2, 3).setValue(item); });
  CONTENT_ROLES.forEach(function (item, index) { sheet.getRange(index + 2, 4).setValue(item); });
  STATUSES.forEach(function (item, index) { sheet.getRange(index + 2, 5).setValue(item); });
  DECISIONS.forEach(function (item, index) { sheet.getRange(index + 2, 6).setValue(item); });
  scoreLabels.forEach(function (item, index) { sheet.getRange(index + 2, 7).setValue(item); });

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#ffcc00").setFontColor("#001040");
  sheet.autoResizeColumns(1, 7);
}

function applyValidation_(sheet, headerName, values) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var column = headers.indexOf(headerName) + 1;
  if (column <= 0) return;

  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1)).setDataValidation(rule);
}

function getSpreadsheet_() {
  validateSettings_();
  return SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID);
}

function validateSettings_() {
  if (!SETTINGS.SPREADSHEET_ID || SETTINGS.SPREADSHEET_ID.indexOf("PASTE_") === 0) {
    throw new Error("Set SETTINGS.SPREADSHEET_ID in Apps Script.");
  }

  if (!SETTINGS.ROOT_FOLDER_ID || SETTINGS.ROOT_FOLDER_ID.indexOf("PASTE_") === 0) {
    throw new Error("Set SETTINGS.ROOT_FOLDER_ID in Apps Script.");
  }
}

function assertRequired_(fields, names) {
  var missing = names.filter(function (name) {
    return !fields[name];
  });

  if (missing.length) throw new Error("Missing required fields: " + missing.join(", "));
}

function logEvent_(eventName, applicationId, message) {
  try {
    var ss = SpreadsheetApp.openById(SETTINGS.SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Logs") || ensureSheet_(ss, "Logs", LOG_HEADERS);
    sheet.appendRow([new Date(), eventName, applicationId, message || ""]);
  } catch (error) {
    console.error(error);
  }
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeName_(value) {
  return String(value || "Candidate")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 80);
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
