/**
 * PROJECT-WISE WEEKLY DEFECT REPORT & COMPLIANCE LETTER AUTOMATION
 * Senior Engineer Production-Ready Version (Audited & Hardened)
 */

const CFG = {
  INDEX_SHEET: "Defect Index",
  PIU_SUMMARY_SHEET: "PIU-WISE DEFECT SUMMARY",
  PROJECT_PREFIX: "Defect -",
  ACTIVITY_SHEET: "Activity log",
  SURVEY_FORM_SHEET: "Survey Form",
  HEADER_SEARCH_ROWS: 10,
  // Keep batches small so the script has time left to rebuild summaries and letters.
  MAX_REPORT_LINKS_PER_RUN: 5,
  SAFE_RUNTIME_MS: 120000,
  RESUME_DELAY_MINUTES: 1,
  LETTER_TEMPLATE_ID: "1F13DpPHBu15Mw_xGEJ7Zy1YsA5EgehHmpQw93kbpGAo",
  LETTER_REFERENCE: "NHAI/RO-KOL/001/2026/3(A)-Dashcam/",
  SIGNATORY_NAME: "Debasish Das",
  SIGNATORY_DESIGNATION: "Dy. General Manager (Tech)",
  REGIONAL_OFFICE: "Kolkata",
  LETTER_DATE_FORMAT: "dd MMM yyyy",
  SURVEY_DATE_FORMAT: "dd MMM yyyy"
};

const PIU_ADDRESS_MAP = {
  "KOLKATA": [
    "PIU-Kolkata, NHAI",
    "Synthesis Business Park",
    "8th Floor, Block-C",
    "New Town, Kolkata – 700 156"
  ].join("\n"),
  "MALDA": [
    "PIU- Malda, NHAI",
    "1st Floor, New Setumore, Sahapur P.O. Nageswarpur, Malda, Pin-732142"
  ].join("\n"),
  "KRISHNAGAR": [
    "PIU – Krishnagar, NHAI",
    "P.O. & Vill.:- Bhatjangla,",
    "Dist - Nadia, Pin- 741102,",
    "West Bengal"
  ].join("\n"),
  "JALPAIGURI": [
    "PIU – Jalpaiguri, NHAI, 2 ½ Mile,",
    "Sevoke Road, Jyotinagar,",
    "Near Don Bosco School,",
    "Siliguri – 734 001"
  ].join("\n"),
  "KHARAGPUR": [
    "PIU-Kharagpur, NHAI,",
    "NHAI Complex near Chaurangi, P.O. Inda, Kharagpur – 721305"
  ].join("\n"),
  "BARDHAMAN": [
    "NHAI, PIU-Bardhaman,",
    "P.O. – Palla Road, P.S. Memari, Dist.- Purba Bardhaman-713151"
  ].join("\n"),
  "PURULIA": [
    "NHAI, PIU-Purulia",
    "Module-31, 3rd Floor, Webel IT Park, North Lake Road, Saheb Bandh, Purulia – 723 101"
  ].join("\n"),
  "DURGAPUR": [
    "NHAI, PIU – Durgapur",
    "NHAI Complex, Sector –2(A), Bidhannagar,",
    "Durgapur – 713 212"
  ].join("\n")
};

function getPiuAddress_(piuName) {
  const normalized = clean_(piuName).toUpperCase()
    .replace(/^PIU\s*[-–]?\s*/i, "")
    .replace(/,?\s*NHAI\s*$/i, "")
    .replace(/\s+/g, " ").trim();
  const aliases = {
    "BURDWAN": "BARDHAMAN",
    "PURBA BARDHAMAN": "BARDHAMAN",
    "KRISHNAGAR": "KRISHNAGAR",
    "JALPAIGURI": "JALPAIGURI",
    "KOLKATA": "KOLKATA",
    "MALDA": "MALDA",
    "KHARAGPUR": "KHARAGPUR",
    "PURULIA": "PURULIA",
    "DURGAPUR": "DURGAPUR"
  };
  const key = aliases[normalized] || normalized;
  return PIU_ADDRESS_MAP[key] || "";
}

const STANDARD_DEFECTS = [
  "POTHOLES", "CRACKING", "RUTTING", "SHOULDER - RAIN CUTS", "SHOULDER - EDGE DROP",
  "SHOULDER - UNEVENNESS", "SHOULDER - VEGETATION GROWTH", "DAMAGED KERB", "FADED KERB PAINTING",
  "REDUCED VISIBILITY DUE TO PLANTATION GROWTH", "MISSING PLANTS / IRREGULAR GAPS (MEDIAN)",
  "DETERIORATED OR DAMAGED PLANTS (MEDIAN)", "DAMAGED DRAIN COVER SLABS", "MISSING DRAIN COVER SLABS",
  "WATER STAGNATION", "DAMAGED FOOTPATH TILES / PAVER BLOCKS", "DAMAGED CRASH BARRIERS",
  "FADED PAINTING CONCRETE CRASH (CC) BARRIER", "DAMAGED (MBCB) METAL BEAM CRASH BARRIER",
  "MISSING ASSETS (GUARD RAILS)", "DAMAGED (PGR) PEDESTRIAN GUARD RAIL", "BARRIERS - FADED PAINTING GUARD RAILS",
  "DAMAGED SIGN BOARDS / SIGN STRUCTURES", "SIGNAGE - POOR VISIBILITY (DAY)", "SIGNAGE - POOR VISIBILITY (NIGHT)",
  "MISSING ASSETS (SIGNAGES)", "DAMAGED BLINKERS", "DAMAGED ATTENUATORS", "DAMAGED DELINEATORS",
  "DAMAGED ANTI-GLARE", "DAMAGED ROAD STUDS", "ROAD STUDS - POOR VISIBILITY (DAY)",
  "ROAD STUDS - POOR VISIBILITY (NIGHT)", "DAMAGED RUMBLE STRIPS", "DAMAGED HAZARD MARKERS",
  "FADED PAVEMENT MARKING", "PAVEMENT MARKING - POOR VISIBILITY (DAY)", "PAVEMENT MARKING - POOR VISIBILITY (NIGHT)",
  "BUS BAY - DAMAGED SHELTERS", "BUS BAY - FADED MARKINGS", "BUS BAY - DAMAGED SIGNAGES",
  "TRUCK LAY BY - DAMAGED SHELTERS", "TRUCK LAY BY - FADED MARKINGS", "TRUCK LAY BY - DAMAGED SIGNAGES",
  "DAMAGED HIGHWAY LIGHTS", "NON-FUNCTIONAL HIGHWAY LIGHTS", "MISSING ASSETS (STREET LIGHTS)",
  "WORK ZONE - INADEQUATE SIGNBOARD VISIBILITY", "WORK ZONE - INADEQUATE BARRICADING",
  "WORK ZONE - POOR DIVERSION ARRANGEMENT / CONDITION", "UNAUTHORIZED MEDIAN OPENINGS",
  "UNAUTHORIZED SIGNBOARDS", "UNAUTHORIZED HOARDINGS", "ILLEGAL PARKING",
  "GENERAL ENCROACHMENTS", "CLEANLINESS - LITTER", "CLEANLINESS - DEBRIS"
];

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 Defect Automation")
    .addItem("🔄 Run Full Reset (All Weeks Fresh)", "runFullReset")
    .addItem("⚡ Run Smart Update (Resume / New)", "runSmartUpdate")
    .addItem("🎯 Run Specific Week Update", "runSpecificWeekUpdate")
    .addToUi();
}

function runFullReset() {
  rememberMasterSheet_();
  cancelResumeTriggers_();
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    "Full Reset Confirmation",
    "⚠️ This will delete all existing Defect project sheets and reset progress. Make sure you have a backup! Do you want to proceed?",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(sh => {
    if (sh.getName().startsWith(CFG.PROJECT_PREFIX)) {
      ss.deleteSheet(sh);
    }
  });

  const props = PropertiesService.getDocumentProperties();
  props.deleteProperty("LAST_PROCESSED_ROW");
  props.deleteProperty("LAST_COMPLETED_ROW");
  props.deleteProperty("SPECIFIC_WEEK");
  processDefects_(null, false);
}

function runSmartUpdate() {
  rememberMasterSheet_();
  PropertiesService.getDocumentProperties().deleteProperty("SPECIFIC_WEEK");
  processDefects_(null, true);
}

function resumeDefectProcessing() {
  const props = PropertiesService.getDocumentProperties();
  const week = Number(props.getProperty("SPECIFIC_WEEK") || 0) || null;
  processDefects_(week, true);
}

function rememberMasterSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const active = ss.getActiveSheet();
  if (active.getName() === CFG.INDEX_SHEET ||
      active.getName() === CFG.PIU_SUMMARY_SHEET ||
      active.getName().startsWith(CFG.PROJECT_PREFIX)) {
    throw new Error("Select the original Master Sheet first.");
  }
  PropertiesService.getDocumentProperties()
    .setProperty("MASTER_SHEET_NAME", active.getName());
}

function scheduleResume_() {
  cancelResumeTriggers_();
  ScriptApp.newTrigger("resumeDefectProcessing")
    .timeBased()
    .after(CFG.RESUME_DELAY_MINUTES * 60 * 1000)
    .create();
}

function cancelResumeTriggers_() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === "resumeDefectProcessing") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function safeAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    console.log(message);
  }
}

function runSpecificWeekUpdate() {
  rememberMasterSheet_();
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Specific Week Filter",
    "Enter the Survey Week number you want to update (e.g., 10):",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;
  const weekNum = Number(clean_(response.getResponseText()));
  
  if (!weekNum || weekNum < 1) {
    ui.alert("Please enter a valid week number.");
    return;
  }

  PropertiesService.getDocumentProperties()
    .setProperty("SPECIFIC_WEEK", String(weekNum));
  PropertiesService.getDocumentProperties()
    .deleteProperty("LAST_PROCESSED_ROW");
  processDefects_(weekNum, true);
}

function standardizeDefectName_(rawName) {
  let name = clean_(rawName).toUpperCase();
  
  if (name.includes("POTHOLE")) return "POTHOLES";
  if (name.includes("CRACKING") || name.includes("ALLIGATOR CRACKING")) return "CRACKING";
  if (name.includes("RUTTING")) return "RUTTING";
  if (name.includes("RAIN CUT")) return "SHOULDER - RAIN CUTS";
  if (name.includes("EDGE DROP")) return "SHOULDER - EDGE DROP";
  if (name.includes("UNEVEN")) return "SHOULDER - UNEVENNESS";
  if (name.includes("VEGETATION") || name.includes("PLANTATION/ VEGETATION")) return "SHOULDER - VEGETATION GROWTH";
  if (name.includes("KERB") && !name.includes("PAINT")) return "DAMAGED KERB";
  if (name.includes("KERB") && name.includes("PAINT")) return "FADED KERB PAINTING";
  if (name.includes("WATER STAGNATION") || name.includes("DRAINAGE WATER")) return "WATER STAGNATION";
  if (name.includes("DRAIN COVER") && name.includes("MISSING")) return "MISSING DRAIN COVER SLABS";
  if (name.includes("DRAIN COVER") && name.includes("DAMAGED")) return "DAMAGED DRAIN COVER SLABS";
  if (name.includes("CC BARRIER") && name.includes("FADED")) return "FADED PAINTING CONCRETE CRASH (CC) BARRIER";
  if (name.includes("CC BARRIER") && name.includes("DAMAGED")) return "DAMAGED CRASH BARRIERS";
  if (name.includes("MBCB") || name.includes("METAL BEAM")) return "DAMAGED (MBCB) METAL BEAM CRASH BARRIER";
  if (name.includes("PEDESTRIAN GUARD RAIL") || name.includes("PGR")) return "DAMAGED (PGR) PEDESTRIAN GUARD RAIL";
  if ((name.includes("UNAUTHORIZED") || name.includes("ILLEGAL")) &&
      (name.includes("SIGN BOARD") || name.includes("SIGNBOARD"))) return "UNAUTHORIZED SIGNBOARDS";
  if (name.includes("SIGN BOARD") || name.includes("SIGNBOARDS")) return "DAMAGED SIGN BOARDS / SIGN STRUCTURES";
  
  if (name === "SIGNAGE - POOR VISIBILITY (DAY)") return "SIGNAGE - POOR VISIBILITY (DAY)";
  if (name === "SIGNAGE - POOR VISIBILITY (NIGHT)") return "SIGNAGE - POOR VISIBILITY (NIGHT)";
  if (name.includes("SIGNAGE") && name.includes("DAY")) return "SIGNAGE - POOR VISIBILITY (DAY)";
  
  if (name === "FADED PAVEMENT MARKING") return "FADED PAVEMENT MARKING";
  if (name.includes("PAVEMENT MARKING") && name.includes("DAY")) return "PAVEMENT MARKING - POOR VISIBILITY (DAY)";
  if (name.includes("PAVEMENT MARKING") && name.includes("NIGHT")) return "PAVEMENT MARKING - POOR VISIBILITY (NIGHT)";
  if (name.includes("PAVEMENT MARKING") || name.includes("MARKING FADED")) return "FADED PAVEMENT MARKING";

  if (name.includes("HIGHWAY LIGHT") && name.includes("NON FUNCTIONAL")) return "NON-FUNCTIONAL HIGHWAY LIGHTS";
  if (name.includes("GARBAGE") || name.includes("DEBRIS") || name.includes("CLEALINESS ISSUES")) return "CLEANLINESS - DEBRIS";
  if (name.includes("LITTER")) return "CLEANLINESS - LITTER";
  if (name.includes("ILLEGAL PARKING")) return "ILLEGAL PARKING";
  if (name.includes("ENCROACHMENT") && name.includes("SIGN")) return "UNAUTHORIZED HOARDINGS";
  if (name.includes("ENCROACHMENT")) return "GENERAL ENCROACHMENTS";

  let exact = STANDARD_DEFECTS.find(d => d === name);
  if (exact) return exact;

  return name;
}

function processDefects_(specificWeekNum, preserveOld) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) {
    safeAlert_("Another defect automation run is currently in progress. Please try again shortly.");
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const props = PropertiesService.getDocumentProperties();
    const rememberedMasterName = props.getProperty("MASTER_SHEET_NAME");
    const master = rememberedMasterName
      ? ss.getSheetByName(rememberedMasterName)
      : ss.getActiveSheet();

    if (!master) {
      throw new Error("The saved Master Sheet could not be found. Select it and run Smart Update again.");
    }

    if (master.getName() === CFG.INDEX_SHEET ||
        master.getName() === CFG.PIU_SUMMARY_SHEET ||
        master.getName().startsWith(CFG.PROJECT_PREFIX)) {
      throw new Error("Please select your original Master Sheet before running.");
    }

    const range = master.getDataRange();
    const values = range.getDisplayValues();
    const rawValues = range.getValues();
    const formulas = range.getFormulas();
    const rich = range.getRichTextValues();

    const headerInfo = findMasterHeaders_(values);
    if (!headerInfo) {
      throw new Error("Could not find mandatory headers: UPC Code, Survey Week and Assessed Report Link.");
    }

    const { headerRow, columns } = headerInfo;
    const scriptProps = PropertiesService.getDocumentProperties();
    let startRow = headerRow + 2;
    if (preserveOld) {
      const savedRow = Number(scriptProps.getProperty("LAST_PROCESSED_ROW") || 0);
      if (savedRow >= startRow) {
        startRow = savedRow;
      } else if (specificWeekNum === null) {
        const lastCompletedRow = Number(scriptProps.getProperty("LAST_COMPLETED_ROW") || 0);
        if (lastCompletedRow >= startRow) startRow = lastCompletedRow + 1;
      }
    }

    const projects = new Map();
    const dirtyProjectKeys = new Set();
    if (preserveOld) {
      ss.getSheets().forEach(sh => {
        if (!sh.getName().startsWith(CFG.PROJECT_PREFIX)) return;
        const upcFromName = sh.getName().substring(CFG.PROJECT_PREFIX.length).trim();
        const existing = readExistingProjectSheet_(sh);
        if (existing) projects.set(normalizeUPC_(upcFromName), existing);
      });
    }

    const issues = [];
    let processedReports = 0;
    let maxProcessedRow = startRow - 1;
    let shouldResume = false;
    let linkRowsAttempted = 0;
    const started = Date.now();
    const TIME_LIMIT_MS = CFG.SAFE_RUNTIME_MS;

    for (let r = startRow - 1; r < values.length; r++) {
      if (Date.now() - started > TIME_LIMIT_MS) {
        shouldResume = true;
        maxProcessedRow = r + 1;
        break;
      }

      const row = values[r];
      const url = getCellUrl_(
        columns.link >= 0 ? row[columns.link] : "",
        columns.link >= 0 ? formulas[r][columns.link] : "",
        columns.link >= 0 ? rich[r][columns.link] : null
      );

      if (!url || !/docs\.google\.com\/spreadsheets\/d\//i.test(url)) {
        maxProcessedRow = Math.max(maxProcessedRow, r + 2);
        continue;
      }

      if (linkRowsAttempted >= CFG.MAX_REPORT_LINKS_PER_RUN) {
        shouldResume = true;
        maxProcessedRow = r + 1;
        break;
      }

      linkRowsAttempted++;
      maxProcessedRow = Math.max(maxProcessedRow, r + 2);

      const masterUPC = clean_(columns.upc >= 0 ? row[columns.upc] : "");
      const masterProject = clean_(columns.project >= 0 ? row[columns.project] : "");
      const masterPIU = clean_(columns.piu >= 0 ? row[columns.piu] : "");
      const masterWeek = parseWeek_(columns.week >= 0 ? row[columns.week] : "");
      const actualSurveyDate = columns.actualSurveyDate >= 0 ? rawValues[r][columns.actualSurveyDate] : null;

      if (!masterUPC || !masterWeek || masterWeek < 1) {
        issues.push([r + 1, url, masterUPC, masterWeek || "", "Missing UPC Code or invalid Survey Week"]);
        continue;
      }
      if (specificWeekNum !== null && masterWeek !== specificWeekNum) continue;

      const key = normalizeUPC_(masterUPC);
      if (!projects.has(key)) {
        projects.set(key, {
          upc: masterUPC, name: masterProject || masterUPC, piu: masterPIU,
          cycles: {}, processedWeeksTracker: new Set()
        });
      }

      const project = projects.get(key);
      if (masterProject) project.name = masterProject;
      if (masterPIU) project.piu = masterPIU;

      if (specificWeekNum === null && preserveOld &&
          project.processedWeeksTracker && project.processedWeeksTracker.has(masterWeek)) {
        continue;
      }

      try {
        const reportId = extractSpreadsheetId_(url);
        const report = SpreadsheetApp.openById(reportId);
        const surveySheet = report.getSheets().find(sh =>
          clean_(sh.getName()).toLowerCase() === CFG.SURVEY_FORM_SHEET.toLowerCase()
        );
        const activitySheet = report.getSheets().find(sh =>
          clean_(sh.getName()).toLowerCase().replace(/[^a-z]/g, "").includes("activitylog")
        );

        if (!activitySheet) throw new Error("Activity Log sheet not found.");
        if (!surveySheet) throw new Error("Survey Form sheet not found.");

        const survey = readSurveyForm_(surveySheet);
        if (!survey.upcCode) throw new Error("UPC Code is missing from Survey Form.");
        if (normalizeUPC_(survey.upcCode) !== key) {
          throw new Error("UPC mismatch: Master=" + masterUPC + "; Survey Form=" + survey.upcCode);
        }

        const defects = readActivity_(activitySheet, issues, r + 1, url, masterUPC, masterWeek);
        if (!defects || Object.keys(defects).length === 0) {
          if (!survey.activityReadValid && survey.activityReadValid !== undefined) {
            throw new Error("Activity Log could not be validated; existing weekly data was preserved.");
          }
        }

        const surveyDate = formatDateValue_(actualSurveyDate) || survey.surveyEndDate || "";
        const cycleData = {
          defects: defects,
          url: url,
          survey: survey,
          surveyDate: surveyDate,
          masterRow: r + 1
        };

        project.cycles[masterWeek] = cycleData;
        if (!project.processedWeeksTracker) project.processedWeeksTracker = new Set();
        project.processedWeeksTracker.add(masterWeek);
        dirtyProjectKeys.add(key);
        processedReports++;
      } catch (err) {
        issues.push([r + 1, url, masterUPC, masterWeek, String(err.message || err)]);
      }
    }

    if (shouldResume) {
      scriptProps.setProperty("LAST_PROCESSED_ROW", String(maxProcessedRow));
    } else {
      scriptProps.setProperty("LAST_COMPLETED_ROW", String(values.length));
      scriptProps.deleteProperty("LAST_PROCESSED_ROW");
      scriptProps.deleteProperty("SPECIFIC_WEEK");
    }

    const indexRows = [];
    for (const project of projects.values()) {
      if (!project.cycles || !Object.keys(project.cycles).length) continue;

      const sheetName = projectSheetName_(project.upc);
      let out = ss.getSheetByName(sheetName);
      const sheetWasMissing = !out;
      if (!out) out = ss.insertSheet(sheetName);

      const projectKey = normalizeUPC_(project.upc);
      const result = (dirtyProjectKeys.has(projectKey) || sheetWasMissing)
        ? writeProjectSheet_(out, project)
        : { grandTotal: calculateProjectGrandTotal_(project) };

      const weeks = Object.keys(project.cycles).map(Number).sort((a, b) => a - b);
      const maxWeek = weeks.length ? Math.max(...weeks) : 0;
      const latestWeekNum = specificWeekNum !== null ? specificWeekNum : maxWeek;
      const latestWeek = "Week " + (latestWeekNum || 1);
      const missing = [];
      for (let w = 1; w <= maxWeek; w++) if (!project.cycles[w]) missing.push(w);

      const sheetUrl = ss.getUrl() + "#gid=" + out.getSheetId();
      const selectedCycle = project.cycles[latestWeekNum] || project.cycles[maxWeek] || {};
      let docUrl = "";
      try {
        if (selectedCycle.survey) {
          docUrl = createComplianceLetterDoc_(project, latestWeek, sheetUrl, selectedCycle);
        }
      } catch (err) {
        issues.push(["", "", project.upc, latestWeekNum, "Letter generation failed: " + String(err.message || err)]);
      }

      indexRows.push({
        name: project.name, upc: project.upc, piu: project.piu,
        found: weeks, missing: missing, total: result.grandTotal,
        sheet: sheetName, sheetUrl: sheetUrl, docUrl: docUrl, latestWeek: latestWeek
      });
    }

    writePiuWiseSummary_(ss, projects);
    writeIndex_(ss, indexRows, issues, master.getName(), maxProcessedRow);
    const indexSheet = ss.getSheetByName(CFG.INDEX_SHEET);
    if (indexSheet) ss.setActiveSheet(indexSheet);

    if (shouldResume) {
      scheduleResume_();
      safeAlert_(
        "Batch completed.\nReports processed this run: " + processedReports +
        "\nProgress saved at master row: " + maxProcessedRow +
        "\nThe next batch will start automatically."
      );
    } else {
      cancelResumeTriggers_();
      safeAlert_(
        "Processing finished.\nReports processed this run: " + processedReports +
        "\nProjects mapped: " + projects.size +
        "\nIssues recorded: " + issues.length
      );
    }
  } finally {
    lock.releaseLock();
  }
}

function calculateProjectGrandTotal_(project) {
  let total = 0;
  Object.values(project.cycles || {}).forEach(cycle => {
    Object.values((cycle && cycle.defects) || {}).forEach(value => {
      const n = Number(value);
      if (Number.isFinite(n)) total += n;
    });
  });
  return total;
}

function readExistingProjectSheet_(sheet) {
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length < 7) return null;

  let projectName = "";
  let upcCode = "";
  let piuName = "";

  for (let r = 1; r <= 4; r++) {
    const label = clean_(data[r][0]).toLowerCase();
    const val = clean_(data[r][2] || data[r][1]);
    if (label.includes("project name")) projectName = val;
    if (label.includes("upc")) upcCode = val;
    if (label.includes("piu")) piuName = val;
  }

  if (!upcCode) return null;

  const headerRow = 5;
  const headers = data[headerRow];
  const weekIndices = [];

  for (let c = 2; c < headers.length; c++) {
    const h = clean_(headers[c]);
    const match = h.match(/^week\s*(\d+)$/i);
    if (match) weekIndices.push({ week: Number(match[1]), colIdx: c });
  }

  const cycles = {};
  const processedWeeksTracker = new Set();
  const defectRows = [];

  for (let r = headerRow + 1; r < data.length; r++) {
    const defectName = clean_(data[r][1]);
    if (!defectName || defectName.toUpperCase() === "TOTAL DEFECTS") continue;
    defectRows.push({ row: data[r], name: defectName });
  }

  weekIndices.forEach(wi => {
    const hasData = defectRows.some(item => clean_(item.row[wi.colIdx]) !== "");
    if (!hasData) return;

    const defects = {};
    defectRows.forEach(item => {
      const valStr = String(item.row[wi.colIdx] || "").replace(/,/g, "").trim();
      defects[item.name] = valStr === "" ? 0 : Number(valStr) || 0;
    });

    cycles[wi.week] = { defects: defects };
    processedWeeksTracker.add(wi.week);
  });

  return {
    upc: upcCode,
    name: projectName || upcCode,
    piu: piuName,
    cycles: cycles,
    processedWeeksTracker: processedWeeksTracker
  };
}

function createComplianceLetterDoc_(p, weekStr, sheetUrl, cycle) {
  const survey = (cycle && cycle.survey) || {};
  const piu = survey.piuName || p.piu || "";
  const projectName = survey.projectName || p.name || "";
  const surveyDate = cycle.surveyDate || survey.surveyEndDate || "";
  const safePart = value => clean_(value).replace(/[\\/:*?"<>|#%{}~&]/g, "-").substring(0, 100);
  const docTitle = safePart(p.upc) + " - " + safePart(weekStr) + " - " + safePart(projectName) + " - Compliance Letter";

  const props = PropertiesService.getDocumentProperties();
  const key = "LETTER_DOC_" + normalizeUPC_(p.upc).replace(/[^A-Z0-9_-]/g, "_") + "_W" + String(weekStr).replace(/\D/g, "");
  let docId = props.getProperty(key);
  let docFile = null;

  if (docId) {
    try {
      docFile = DriveApp.getFileById(docId);
      if (docFile.isTrashed()) docFile = null;
    } catch (e) {
      docFile = null;
    }
  }

  if (!docFile) {
    const template = DriveApp.getFileById(CFG.LETTER_TEMPLATE_ID);
    docFile = template.makeCopy(docTitle);
    docId = docFile.getId();
    props.setProperty(key, docId);
  } else {
    docFile.setName(docTitle);
  }

  const doc = DocumentApp.openById(docId);
  const replacements = {
    "{{LETTER_REFERENCE}}": CFG.LETTER_REFERENCE,
    "{{LETTER_DATE}}": Utilities.formatDate(new Date(), Session.getScriptTimeZone(), CFG.LETTER_DATE_FORMAT),
    "{{PIU_NAME}}": piu,
    "{{PIU_ADDRESS}}": getPiuAddress_(piu),
    "{{PROJECT_NAME}}": projectName,
    "{{SURVEY_DATE}}": surveyDate,
    "{{NH_NUMBER}}": survey.nhNumber || "",
    "{{UPC_CODE}}": survey.upcCode || p.upc || "",
    "{{STATE_NAME}}": survey.stateName || "",
    "{{RO_NAME}}": survey.roName || "",
    "{{SURVEY_ID}}": survey.surveyId || "",
    "{{SURVEY_CYCLE}}": survey.surveyCycle || weekStr,
    "{{SURVEY_START_DATE}}": survey.surveyStartDate || "",
    "{{SURVEY_END_DATE}}": survey.surveyEndDate || "",
    "{{AE_IE_SC_NAME}}": survey.aeIeScName || "",
    "{{CONTRACTOR_NAME}}": survey.contractorName || "",
    "{{DAS_AGENCY}}": survey.dasAgency || "",
    "{{SIGNATORY_NAME}}": CFG.SIGNATORY_NAME,
    "{{SIGNATORY_DESIGNATION}}": CFG.SIGNATORY_DESIGNATION,
    "{{REGIONAL_OFFICE}}": survey.roName || CFG.REGIONAL_OFFICE,
    "{{SUMMARY_SHEET_URL}}": sheetUrl
  };

  const applyReplacements = (section) => {
    if (!section) return;
    Object.keys(replacements).forEach(placeholder => {
      const safeVal = String(replacements[placeholder] == null ? "" : replacements[placeholder]).replace(/\$/g, "$$$$");
      section.replaceText(escapeRegex_(placeholder), safeVal);
    });
  };

  applyReplacements(doc.getBody());
  applyReplacements(doc.getHeader());
  applyReplacements(doc.getFooter());

  doc.saveAndClose();
  return doc.getUrl();
}

function escapeRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDateValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), CFG.SURVEY_DATE_FORMAT);
  }
  const text = clean_(value);
  if (!text) return "";

  const dmyMatch = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone(), CFG.SURVEY_DATE_FORMAT);
    }
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime()) && /\d/.test(text)) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), CFG.SURVEY_DATE_FORMAT);
  }
  return text;
}

function readSurveyForm_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  const result = {
    surveyCycle: "", surveyId: "", surveyStartDate: "", surveyEndDate: "",
    projectName: "", nhNumber: "", upcCode: "", stateName: "", roName: "",
    piuName: "", aeIeScName: "", contractorName: "", dasAgency: ""
  };

  const labelMap = [
    { keys: ["survey cycle"], field: "surveyCycle" },
    { keys: ["survey id"], field: "surveyId" },
    { keys: ["survey start date"], field: "surveyStartDate" },
    { keys: ["survey end date"], field: "surveyEndDate" },
    { keys: ["project name"], field: "projectName" },
    { keys: ["nh number", "national highway number"], field: "nhNumber" },
    { keys: ["upc code"], field: "upcCode" },
    { keys: ["name of state", "state name"], field: "stateName" },
    { keys: ["ro name", "regional office"], field: "roName" },
    { keys: ["piu name"], field: "piuName" },
    { keys: ["ae/ie/sc name", "ae ie sc name"], field: "aeIeScName" },
    { keys: ["contractor/ o&m agency", "contractor/o&m agency", "contractor / o&m agency"], field: "contractorName" },
    { keys: ["das agency"], field: "dasAgency" }
  ];

  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const cellText = clean_(values[r][c]);
      const normalized = normalizeHeader_(cellText);
      if (!normalized) continue;

      for (const item of labelMap) {
        const matchingKey = item.keys.find(k => {
          const nk = normalizeHeader_(k);
          return normalized === nk || normalized.startsWith(nk + " ");
        });
        if (!matchingKey || result[item.field]) continue;

        const labelPattern = new RegExp("^\\s*" + escapeRegex_(matchingKey) + "\\s*:?\\s*", "i");
        let inlineValue = cellText.replace(labelPattern, "").trim();
        if (inlineValue && inlineValue !== cellText) {
          result[item.field] = inlineValue;
          continue;
        }

        let found = "";
        for (let cc = c + 1; cc < values[r].length; cc++) {
          const candidate = clean_(values[r][cc]);
          if (candidate && normalizeHeader_(candidate) !== normalized) {
            found = candidate;
            break;
          }
        }
        if (!found) {
          for (let rr = r + 1; rr < Math.min(values.length, r + 3) && !found; rr++) {
            for (let cc = c; cc < values[rr].length; cc++) {
              const candidate = clean_(values[rr][cc]);
              const candidateNorm = normalizeHeader_(candidate);
              if (candidate && !labelMap.some(x => x.keys.some(k => candidateNorm === normalizeHeader_(k)))) {
                found = candidate;
                break;
              }
            }
          }
        }

        if (found) {
          if (item.field === "surveyStartDate" || item.field === "surveyEndDate") {
            result[item.field] = formatDateValue_(found) || found;
          } else {
            result[item.field] = found;
          }
        }
      }
    }
  }

  if (!result.upcCode) throw new Error("Survey Form: UPC Code not found.");
  return result;
}

function normalizeHeader_(value) {
  return clean_(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findMasterHeaders_(values) {
  const aliases = {
    upc: ["upc code"],
    project: ["project name"],
    piu: ["piu name"],
    week: ["survey week"],
    link: ["assessed report link"],
    actualSurveyDate: ["actual survey completion date"]
  };

  for (let r = 0; r < Math.min(values.length, CFG.HEADER_SEARCH_ROWS); r++) {
    const headers = values[r].map(normalizeHeader_);
    const columns = {};

    for (const [key, names] of Object.entries(aliases)) {
      columns[key] = headers.findIndex(h => names.some(n => h.includes(n)));
    }

    if (columns.upc >= 0 && columns.week >= 0 && columns.link >= 0) {
      return { headerRow: r, columns };
    }
  }
  return null;
}

function getCellUrl_(display, formula, richText) {
  if (richText) {
    const direct = richText.getLinkUrl();
    if (direct) return direct;
    for (const run of richText.getRuns()) {
      if (run.getLinkUrl()) return run.getLinkUrl();
    }
  }
  const f = String(formula || "");
  const match = f.match(/HYPERLINK\s*\(\s*["'](https?:\/\/[^"']+)["']/i);
  if (match) return match[1];

  const text = String(display || "").trim();
  if (/^https:\/\//i.test(text)) {
    return text;
  }
  return "";
}

function extractSpreadsheetId_(url) {
  const match = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("Invalid Google Sheets URL format.");
  return match[1];
}

function clean_(value) {
  return String(value == null ? "" : value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUPC_(value) {
  return clean_(value).toUpperCase();
}

function parseWeek_(value) {
  const text = clean_(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const match = text.match(/(?:weekly[\s_-]*)?cycle[\s_-]*(\d+)|week[\s_-]*(\d+)/i);
  if (match) return Number(match[1] || match[2]);
  return null;
}

function readActivity_(sheet, issues, rowNum, url, upc, week) {
  const data = sheet.getDataRange().getDisplayValues();
  let headerRow = -1, defectCol = -1, countCol = -1;

  for (let r = 0; r < data.length; r++) {
    const headers = data[r].map(normalizeHeader_);
    defectCol = headers.findIndex(h => h.includes("defect type") || h.includes("defect"));
    countCol = headers.findIndex(h => h.includes("total defects") || h.includes("total") || h.includes("count"));

    if (defectCol >= 0 && countCol >= 0 && defectCol !== countCol) {
      headerRow = r;
      break;
    }
  }

  if (headerRow < 0) {
    throw new Error("Activity Log missing expected Defect and Count/Total columns.");
  }

  const defects = {};
  for (let r = headerRow + 1; r < data.length; r++) {
    const rawName = clean_(data[r][defectCol]);
    const rawCount = clean_(data[r][countCol]).replace(/,/g, "");
    
    if (!rawName || /^total$/i.test(rawName)) continue;
    if (!/^-?\d+(?:\.\d+)?$/.test(rawCount)) continue;

    const stdName = standardizeDefectName_(rawName);
    defects[stdName] = (defects[stdName] || 0) + Number(rawCount);
  }
  return defects;
}

function projectSheetName_(upc) {
  return (CFG.PROJECT_PREFIX + " " + upc).replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().substring(0, 99);
}

function writeProjectSheet_(sheet, p) {
  sheet.getDataRange().getMergedRanges().forEach(r => r.breakApart());
  sheet.clear();

  const weekNumbers = Object.keys(p.cycles).map(Number);
  const maxWeek = weekNumbers.length ? Math.max(...weekNumbers) : 0;
  const totalCols = maxWeek + 4;

  const extraDefects = [...new Set(
    Object.values(p.cycles).flatMap(c => Object.keys((c && c.defects) || {}))
      .filter(name => name && !STANDARD_DEFECTS.includes(name))
  )].sort();
  const defectNames = [...STANDARD_DEFECTS, ...extraDefects];

  const title = sheet.getRange(1, 1, 1, totalCols);
  title.merge()
    .setValue("WEEKLY DEFECT SUMMARY REPORT")
    .setFontWeight("bold")
    .setFontSize(14)
    .setHorizontalAlignment("center");

  sheet.getRange("A2").setValue("Project Name");
  sheet.getRange("A3").setValue("UPC Code");
  sheet.getRange("A4").setValue("PIU Name");

  sheet.getRange(2, 3, 1, totalCols - 2).merge().setValue(p.name);
  sheet.getRange(3, 3, 1, totalCols - 2).merge().setValue(p.upc);
  sheet.getRange(4, 3, 1, totalCols - 2).merge().setValue(p.piu);

  sheet.getRange("A2:B2").merge();
  sheet.getRange("A3:B3").merge();
  sheet.getRange("A4:B4").merge();

  const sortedWeeks = Object.keys(p.cycles).map(Number).filter(n => Number.isFinite(n) && !!p.cycles[n]).sort((a, b) => a - b);
  let deltaHeader = "Previous Week - Current Week";
  let canCompareWeeks = false;
  let prevW = null;
  let currW = null;

  if (sortedWeeks.length >= 2) {
    currW = sortedWeeks[sortedWeeks.length - 1];
    prevW = sortedWeeks[sortedWeeks.length - 2];
    deltaHeader = "Week " + prevW + " - Week " + currW;
    canCompareWeeks = true;
  }

  const headers = [
    "S. No.", "Defect Type",
    ...Array.from({ length: maxWeek }, (_, i) => "Week " + (i + 1)),
    "Grand Total",
    deltaHeader
  ];
  sheet.getRange(6, 1, 1, headers.length).setValues([headers]);

  const rows = [];
  const weekTotals = Array(maxWeek).fill(0);
  let grandTotal = 0;

  defectNames.forEach((name, i) => {
    const row = [i + 1, name];
    let defectTotal = 0;

    for (let w = 1; w <= maxWeek; w++) {
      const cycle = p.cycles[w];
      const hasCycle = !!cycle;
      const rawCount = cycle && cycle.defects ? cycle.defects[name] : undefined;
      const count = hasCycle ? (rawCount === undefined || rawCount === "" ? 0 : Number(rawCount) || 0) : "";
      row.push(count);

      if (hasCycle && count !== "") {
        defectTotal += Number(count) || 0;
        weekTotals[w - 1] += Number(count) || 0;
      }
    }

    row.push(defectTotal);
    const outputRowNumber = 7 + i;
    if (canCompareWeeks) {
      const previousCol = columnToLetter_(prevW + 2);
      const latestCol = columnToLetter_(currW + 2);
      row.push("=N(" + previousCol + outputRowNumber + ")-N(" + latestCol + outputRowNumber + ")");
    } else {
      row.push("");
    }

    grandTotal += defectTotal;
    rows.push(row);
  });

  const totalRowNumber = 7 + rows.length;
  const totalRow = [
    "", "TOTAL DEFECTS",
    ...weekTotals.map((n, i) => p.cycles[i + 1] ? n : ""),
    grandTotal,
    canCompareWeeks
      ? "=N(" + columnToLetter_(prevW + 2) + totalRowNumber + ")-N(" +
        columnToLetter_(currW + 2) + totalRowNumber + ")"
      : ""
  ];

  if (rows.length) sheet.getRange(7, 1, rows.length, totalCols).setValues(rows);
  sheet.getRange(totalRowNumber, 1, 1, totalCols).setValues([totalRow]);

  sheet.getRange("A2:A4").setFontWeight("bold");
  sheet.getRange(6, 1, 1, totalCols).setFontWeight("bold").setWrap(true);
  sheet.getRange(totalRowNumber, 1, 1, totalCols).setFontWeight("bold");
  sheet.getDataRange().setVerticalAlignment("middle").setWrap(true);

  sheet.setColumnWidth(1, 48);
  sheet.setColumnWidth(2, 280);
  if (maxWeek > 0) sheet.setColumnWidths(3, maxWeek, 72);
  sheet.setColumnWidth(maxWeek + 3, 100);
  sheet.setColumnWidth(maxWeek + 4, 150);

  sheet.getRange(6, 1, rows.length + 2, totalCols).setBorder(true, true, true, true, true, true);
  if (maxWeek > 0) {
    sheet.getRange(7, 3, rows.length + 1, maxWeek + 1).setHorizontalAlignment("center");
  }
  sheet.getRange(7, maxWeek + 4, rows.length + 1, 1).setHorizontalAlignment("center");

  return {
    grandTotal: grandTotal,
    latestWeek: maxWeek,
    previousWeek: maxWeek - 1,
    latestMinusPrevious: canCompareWeeks ? weekTotals[maxWeek - 1] - weekTotals[maxWeek - 2] : null
  };
}

function columnToLetter_(column) {
  let n = Number(column);
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function writePiuWiseSummary_(ss, projects) {
  let sh = ss.getSheetByName(CFG.PIU_SUMMARY_SHEET);
  if (!sh) sh = ss.insertSheet(CFG.PIU_SUMMARY_SHEET);

  sh.getDataRange().getMergedRanges().forEach(r => r.breakApart());
  sh.clear();

  const projectList = Array.from(projects.values()).filter(p =>
    p && p.cycles && Object.keys(p.cycles).length
  );
  const maxWeek = projectList.reduce((max, p) =>
    Math.max(max, ...Object.keys(p.cycles).map(Number).filter(n => Number.isFinite(n))), 0
  );
  const headers = [
    "S. No.", "PIU Name", "Project Name", "UPC Code", "Defect Type",
    ...Array.from({ length: maxWeek }, (_, i) => "Week " + (i + 1)),
    "Grand Total"
  ];
  const lastCol = headers.length;
  sh.getRange(1, 1, 1, lastCol).merge()
    .setValue("PIU-WISE DEFECT SUMMARY — DEFECT TYPE & WEEK BREAKDOWN")
    .setFontWeight("bold").setFontSize(14).setHorizontalAlignment("center");
  sh.getRange(2, 1, 1, lastCol).merge()
    .setValue("Counts are taken from validated Activity Log data. Blank week cells mean no validated report data was available for that project/week.")
    .setWrap(true);
  sh.getRange(4, 1, 1, lastCol).setValues([headers]);

  const rows = [];
  const sortedProjects = projectList.slice().sort((a, b) =>
    clean_(a.piu).localeCompare(clean_(b.piu)) ||
    clean_(a.name).localeCompare(clean_(b.name)) ||
    clean_(a.upc).localeCompare(clean_(b.upc))
  );

  sortedProjects.forEach(p => {
    const defectSet = new Set();
    Object.values(p.cycles).forEach(c => {
      Object.keys((c && c.defects) || {}).forEach(d => { if (d) defectSet.add(d); });
    });
    const defectNames = Array.from(defectSet).sort((a, b) => a.localeCompare(b));
    defectNames.forEach(defectName => {
      const weekValues = [];
      let total = 0;
      for (let w = 1; w <= maxWeek; w++) {
        if (!p.cycles[w]) {
          weekValues.push("");
        } else {
          const value = Number((p.cycles[w].defects || {})[defectName] || 0);
          weekValues.push(value);
          total += value;
        }
      }
      rows.push([
        rows.length + 1, p.piu || "Unassigned PIU", p.name || "", p.upc || "",
        defectName, ...weekValues, total
      ]);
    });
  });

  if (rows.length) sh.getRange(5, 1, rows.length, lastCol).setValues(rows);
  sh.getRange(4, 1, 1, lastCol).setFontWeight("bold").setWrap(true);
  sh.setFrozenRows(4);
  sh.getDataRange().setVerticalAlignment("middle").setWrap(true);
  sh.setColumnWidth(1, 55);
  sh.setColumnWidth(2, 150);
  sh.setColumnWidth(3, 260);
  sh.setColumnWidth(4, 130);
  sh.setColumnWidth(5, 300);
  if (maxWeek > 0) sh.setColumnWidths(6, maxWeek, 78);
  sh.setColumnWidth(lastCol, 110);
  sh.getRange(4, 1, Math.max(rows.length + 1, 1), lastCol)
    .setBorder(true, true, true, true, true, true);
  if (rows.length && maxWeek > 0) {
    sh.getRange(5, 6, rows.length, maxWeek + 1).setHorizontalAlignment("center");
  }
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange(4, 1, Math.max(rows.length + 1, 1), lastCol).createFilter();
}

function writeIndex_(ss, indexRows, issues, sourceName, maxProcessedRow) {
  let sh = ss.getSheetByName(CFG.INDEX_SHEET);
  if (!sh) sh = ss.insertSheet(CFG.INDEX_SHEET);

  sh.getDataRange().getMergedRanges().forEach(r => r.breakApart());
  sh.clear();

  sh.getRange("A1:J1").merge().setValue("PROJECT-WISE WEEKLY DEFECT INDEX & COMPLIANCE LETTERS").setFontWeight("bold").setFontSize(14);
  sh.getRange("A2:B4").setValues([
    ["Source Master Sheet", sourceName],
    ["Last Updated", new Date()],
    ["Last Processed Master Row", maxProcessedRow]
  ]);

  const headers = [
    "Project Name", "UPC Code", "PIU Name", "Weeks Found",
    "Missing Weeks", "Total Defects", "Report Sheet Link", "Compliance Letter", "Latest Week"
  ];
  sh.getRange(6, 1, 1, headers.length).setValues([headers]);

  const output = indexRows.map(p => [
    p.name, p.upc, p.piu || "",
    p.found.map(w => "W" + w).join(", "),
    p.missing.map(w => "W" + w).join(", "),
    p.total,
    "Open Report Sheet",
    "Open Compliance Letter",
    p.latestWeek
  ]);

  if (output.length) {
    sh.getRange(7, 1, output.length, headers.length).setValues(output);
    indexRows.forEach((p, i) => {
      if (p.sheetUrl) {
        sh.getRange(7 + i, 7).setRichTextValue(
          SpreadsheetApp.newRichTextValue()
            .setText("Open Report Sheet")
            .setLinkUrl(p.sheetUrl)
            .build()
        );
      }
      if (p.docUrl) {
        sh.getRange(7 + i, 8).setRichTextValue(
          SpreadsheetApp.newRichTextValue()
            .setText("Open Compliance Letter")
            .setLinkUrl(p.docUrl)
            .build()
        );
      }
    });
  }

  const issueRow = Math.max(output.length + 10, 11);
  sh.getRange(issueRow, 1, 1, 5).setValues([["SOURCE ISSUES", "Source URL", "UPC Code", "Week", "Issue"]]);
  if (issues.length) {
    sh.getRange(issueRow + 1, 1, issues.length, 5).setValues(issues);
  }

  sh.getDataRange().setWrap(true).setVerticalAlignment("middle");

  sh.setColumnWidth(1, 240);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 120);
  sh.setColumnWidth(4, 160);
  sh.setColumnWidth(5, 160);
  sh.setColumnWidth(6, 110);
  sh.setColumnWidth(7, 160);
  sh.setColumnWidth(8, 180);
  sh.setColumnWidth(9, 90);
}
