/**
 * NHAI Defect Validation Suite
 * Weekly Defect Report & Compliance Letter Automation Engine
 * Supports:
 * - Direct Google Sheets API v4 batch reads & writes
 * - Multi-week defect tracking & delta calculations
 * - PIU-wise defect breakdowns & master Defect Index
 * - Google Docs API template duplication & compliance letter placeholder replacement
 */

const DEFECT_CFG = {
  INDEX_SHEET: "Defect Index",
  PIU_SUMMARY_SHEET: "PIU-WISE DEFECT SUMMARY",
  PROJECT_PREFIX: "Defect -",
  ACTIVITY_SHEET: "Activity log",
  SURVEY_FORM_SHEET: "Survey form",
  HEADER_SEARCH_ROWS: 20,
  LETTER_TEMPLATE_ID: "1F13DpPHBu15Mw_xGEJ7Zy1YsA5EgehHmpQw93kbpGAo",
  LETTER_REFERENCE: "NHAI/RO-KOL/001/2026/3(A)-Dashcam/",
  SIGNATORY_NAME: "Debasish Das",
  SIGNATORY_DESIGNATION: "Dy. General Manager (Tech)",
  REGIONAL_OFFICE: "Kolkata",
  LETTER_DATE_FORMAT: "dd MMM yyyy",
  SURVEY_DATE_FORMAT: "dd MMM yyyy"
};

const DEFECT_PIU_ADDRESS_MAP = {
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

function getEnginePiuAddress_(piuName) {
  const normalized = cleanEngineStr_(piuName).toUpperCase()
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
  return DEFECT_PIU_ADDRESS_MAP[key] || "";
}

const DEFECT_STANDARD_LIST = [
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

function standardizeDefectCategory_(rawName) {
  let name = cleanEngineStr_(rawName).toUpperCase();
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

  let exact = DEFECT_STANDARD_LIST.find(d => d === name);
  if (exact) return exact;

  return name;
}

function cleanEngineStr_(val) {
  return String(val == null ? "" : val).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normEngine_(val) {
  return cleanEngineStr_(val).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseEngineWeek_(val) {
  if (val === null || val === undefined) return null;
  const text = cleanEngineStr_(val).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return (n > 0 && n <= 250) ? n : null;
  }
  // 1. Format: Week 11, W11, Wk-11, Cycle 11, Weekly 11, Cycle No. 11, etc.
  let m = text.match(/(?:weekly[\s_.-]*)?(?:cycle|week|wk|w|c)[\s_.:-]*(\d+)/i);
  if (m && m[1]) return Number(m[1]);
  // 2. Format: 11th Week, 11th Cycle, 11 Week, 11-Week, 11 Cycle
  m = text.match(/(\d+)(?:st|nd|rd|th)?[\s_.-]*(?:week|cycle|wk|w)\b/i);
  if (m && m[1]) return Number(m[1]);
  // 3. Any text containing week or cycle keyword followed or preceded by 1-3 digit number
  if (/(?:cycle|week|wk|w|c)/i.test(text)) {
    m = text.match(/(\d{1,3})/);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (n > 0 && n <= 250) return n;
    }
  }
  return null;
}

function extractUrlFromCell_(cell, formula, display) {
  if (cell) {
    if (cell.hyperlink) return cell.hyperlink;
    if (cell.textFormatRuns) {
      for (const run of cell.textFormatRuns) {
        if (run.format?.link?.uri) return run.format.link.uri;
      }
    }
    if (cell.userEnteredValue?.formulaValue) {
      const m = cell.userEnteredValue.formulaValue.match(/HYPERLINK\s*\(\s*["']([^"']+)["']/i);
      if (m) return m[1];
    }
    const fmt = cleanEngineStr_(cell.formattedValue);
    if (/^https?:\/\//i.test(fmt)) return fmt;
    if (/(?:drive|docs)\.google\.com\//i.test(fmt)) return "https://" + fmt.replace(/^https?:\/\//i, "");
  }
  if (formula) {
    const m = String(formula).match(/HYPERLINK\s*\(\s*["']([^"']+)["']/i);
    if (m) return m[1];
    const s = String(formula).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/(?:drive|docs)\.google\.com\//i.test(s)) return "https://" + s.replace(/^https?:\/\//i, "");
  }
  if (display) {
    const s = String(display).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/(?:drive|docs)\.google\.com\//i.test(s)) return "https://" + s.replace(/^https?:\/\//i, "");
  }
  return "";
}

function formatEngineDate_(val) {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return formatDateCustom_(val);
  }
  const text = cleanEngineStr_(val);
  if (!text) return "";

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return formatDateCustom_(d);
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime()) && /\d/.test(text)) {
    return formatDateCustom_(parsed);
  }
  return text;
}

function formatDateCustom_(d) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// Drive and Docs REST API helpers
async function driveApiFetch(path, options = {}) {
  const token = await getAuthToken(false);
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status}: ${errBody.slice(0, 300)}`);
  }
  return res.json();
}

async function docsApiFetch(path, options = {}) {
  const token = await getAuthToken(false);
  const res = await fetch(`https://docs.googleapis.com/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Docs API ${res.status}: ${errBody.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Main Execution Function for Weekly Defect Report & Compliance Letter Automation
 */
async function executeDefectReportAutomation(masterSpreadsheetId, options = {}, onProgress = () => {}) {
  const mode = options.mode || 'smart'; // 'smart' | 'week' | 'reset'
  const specificWeekNum = options.specificWeek ? Number(options.specificWeek) : null;
  const generateLetters = options.generateLetters !== false;
  const preserveOld = mode !== 'reset';

  if (typeof window !== 'undefined') {
    window.__onEngineProgress = (msg) => onProgress({ percent: 50, message: msg });
  }

  onProgress({ percent: 5, message: "Validating Master Spreadsheet and connecting..." });

  const meta = await getSpreadsheetMeta(masterSpreadsheetId);
  const sheets = meta.sheets || [];
  let masterSheet = null;

  const aliases = {
    upc: ["upc code", "upc", "project upc"],
    project: ["project name", "project"],
    piu: ["piu name", "piu"],
    week: ["survey week", "week", "cycle", "survey cycle", "week no", "week no.", "week number", "survey week no", "survey week no.", "cycle no", "cycle no.", "cycle number", "assessment week", "report week"],
    surveyId: ["survey id", "surveyid"],
    link: [
      "assessed report link",
      "assessed report link google sheet",
      "assessed report link google sheet / drive link",
      "report link",
      "assessed report",
      "google sheet link",
      "sheet link",
      "drive link",
      "assessed link",
      "link",
      "url",
      "sheet url",
      "survey link"
    ],
    actualSurveyDate: ["actual survey completion date", "completion date", "actual survey date", "survey completion date"]
  };

  function matchHeaderCol_(normRow, names) {
    // 1. Exact match
    let idx = normRow.findIndex(h => names.some(n => h === n));
    if (idx >= 0) return idx;
    // 2. Starts with / Ends with
    idx = normRow.findIndex(h => names.some(n => h.startsWith(n + " ") || h.endsWith(" " + n)));
    if (idx >= 0) return idx;
    // 3. Multi-word phrase contains
    idx = normRow.findIndex(h => names.some(n => n.includes(" ") && h.includes(n)));
    if (idx >= 0) return idx;
    return -1;
  }

  // Helper to test if a sheet tab contains master headers
  async function testSheetForMasterHeaders(title) {
    try {
      const hGrid = await getValues(masterSpreadsheetId, `'${title}'!1:${DEFECT_CFG.HEADER_SEARCH_ROWS}`, 'FORMATTED_VALUE');
      if (!hGrid || hGrid.length === 0) return null;
      for (let r = 0; r < hGrid.length; r++) {
        const normRow = hGrid[r].map(h => cleanEngineStr_(h).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
        const cols = {};
        for (const [key, names] of Object.entries(aliases)) {
          cols[key] = matchHeaderCol_(normRow, names);
        }
        if (cols.link < 0) {
          cols.link = normRow.findIndex(h => (h.includes("link") || h.includes("url") || h.includes("sheet")) && !h.includes("geo"));
        }
        if (cols.week < 0) {
          cols.week = normRow.findIndex(h => (h.includes("week") || h.includes("cycle")) && !h.includes("date") && !h.includes("day") && !h.includes("status"));
        }
        if (cols.upc >= 0 && cols.link >= 0) {
          return { headerRow: r, colIndices: cols };
        }
      }
    } catch (e) {
      console.warn(`Could not check headers in tab ${title}:`, e);
    }
    return null;
  }

  // 1. If user explicitly chose a tab (and it's not Auto-detect)
  let detectedInfo = null;
  if (options.masterSheetName && options.masterSheetName !== "(Auto-detect Master Tab)") {
    const candidate = sheets.find(s => s.properties.title === options.masterSheetName);
    if (candidate) {
      detectedInfo = await testSheetForMasterHeaders(candidate.properties.title);
      if (detectedInfo) masterSheet = candidate;
    }
  }

  // 2. If not found yet, scan all candidate tabs to find the genuine Master Sheet
  if (!masterSheet || !detectedInfo) {
    for (const sh of sheets) {
      const title = sh.properties.title;
      // Skip summary / index / generated sheets
      if (title === DEFECT_CFG.INDEX_SHEET ||
          title === DEFECT_CFG.PIU_SUMMARY_SHEET ||
          title.startsWith(DEFECT_CFG.PROJECT_PREFIX)) {
        continue;
      }
      const info = await testSheetForMasterHeaders(title);
      if (info) {
        masterSheet = sh;
        detectedInfo = info;
        break;
      }
    }
  }

  if (!masterSheet || !detectedInfo) {
    throw new Error(
      `Master Sheet headers not found! Please check that your Master Sheet contains columns: "UPC Code", "Survey Week", and "Assessed Report Link" (with Google Sheets URLs in the rows).`
    );
  }

  const masterTitle = masterSheet.properties.title;
  const { headerRow, colIndices } = detectedInfo;
  onProgress({ percent: 12, message: `Master Tab identified: "${masterTitle}" (Headers at row ${headerRow + 1})...` });

  // If Full Reset: delete any existing Defect - sheets
  if (mode === 'reset') {
    onProgress({ percent: 14, message: "Full Reset: Cleaning existing project defect sheets..." });
    const deleteRequests = [];
    for (const sh of sheets) {
      if (sh.properties.title.startsWith(DEFECT_CFG.PROJECT_PREFIX)) {
        deleteRequests.push({ deleteSheet: { sheetId: sh.properties.sheetId } });
      }
    }
    if (deleteRequests.length > 0) {
      await batchUpdateSpreadsheet(masterSpreadsheetId, deleteRequests);
    }
    await chrome.storage.local.remove(['DEFECT_LAST_COMPLETED_ROW', 'DEFECT_LAST_PROCESSED_ROW']);
  }

  onProgress({ percent: 18, message: `Fetching master rows and report hyperlinks from "${masterTitle}"...` });

  // Query only relevant columns instead of 702 columns (ZZ), preventing Google API 10MB payload limit truncation
  const maxNeededIdx = Math.max(
    ...Object.values(colIndices).filter(Number.isFinite),
    20
  );
  const endColLetter = columnLetter_(maxNeededIdx + 5);
  const fullRange = `'${masterTitle}'!A${headerRow + 2}:${endColLetter}`;

  // Fetch 2D values & formulas first to know exact rowCount and prevent open-ended truncation
  let formulaRows = [];
  try {
    formulaRows = await getValues(masterSpreadsheetId, fullRange, 'FORMULA');
  } catch (_) {}

  let displayRows = [];
  try {
    displayRows = await getValues(masterSpreadsheetId, fullRange, 'FORMATTED_VALUE');
  } catch (_) {}

  const rowCount = Math.max(formulaRows.length, displayRows.length);
  if (rowCount === 0) {
    throw new Error(`No data rows found below headers in Master Sheet '${masterTitle}'.`);
  }

  const exactEndRow = headerRow + 1 + rowCount;
  const boundedRange = `'${masterTitle}'!A${headerRow + 2}:${endColLetter}${exactEndRow}`;

  let rowDataList = [];
  try {
    const gridDataRes = await sheetsFetch(
      `${masterSpreadsheetId}?ranges=${encodeURIComponent(boundedRange)}&includeGridData=true&fields=sheets(properties(sheetId,title),data(rowData(values(formattedValue,hyperlink,userEnteredValue,textFormatRuns))))`
    );
    const targetSheetData = gridDataRes.sheets?.find(s =>
      s.properties?.title === masterTitle || (s.data?.[0]?.rowData && s.data[0].rowData.length > 0)
    ) || gridDataRes.sheets?.[0];
    rowDataList = targetSheetData?.data?.[0]?.rowData || [];
  } catch (gridErr) {
    console.warn("Could not fetch full gridData, will rely on formula/value grids:", gridErr);
  }

  // If rowDataList was partially returned, fetch remaining chunks of rows with exact bounded ranges
  while (rowDataList.length < rowCount) {
    const startR = headerRow + 2 + rowDataList.length;
    const endR = Math.min(startR + 70, exactEndRow);
    const chunkRange = `'${masterTitle}'!A${startR}:${endColLetter}${endR}`;
    try {
      const chunkRes = await sheetsFetch(
        `${masterSpreadsheetId}?ranges=${encodeURIComponent(chunkRange)}&includeGridData=true&fields=sheets(properties(sheetId,title),data(rowData(values(formattedValue,hyperlink,userEnteredValue,textFormatRuns))))`
      );
      const targetSheet = (chunkRes.sheets || []).find(s =>
        s.properties?.title === masterTitle || (s.data && s.data.some(d => d.rowData && d.rowData.length > 0))
      );
      const chunkRows = targetSheet?.data?.[0]?.rowData || [];
      if (chunkRows.length === 0) {
        const needed = endR - startR + 1;
        for (let k = 0; k < needed; k++) rowDataList.push({ values: [] });
      } else {
        rowDataList.push(...chunkRows);
      }
    } catch (chunkErr) {
      console.warn("Chunk fetch note:", chunkErr);
      const needed = endR - startR + 1;
      for (let k = 0; k < needed; k++) rowDataList.push({ values: [] });
    }
  }

  // Load existing project sheets if preserveOld is true
  const projects = new Map();
  const dirtyProjectKeys = new Set();

  if (preserveOld) {
    const refreshedMeta = await getSpreadsheetMeta(masterSpreadsheetId);
    for (const sh of (refreshedMeta.sheets || [])) {
      const title = sh.properties.title;
      if (!title.startsWith(DEFECT_CFG.PROJECT_PREFIX)) continue;
      const upcFromName = title.substring(DEFECT_CFG.PROJECT_PREFIX.length).trim();
      const existingProject = await readExistingProjectFromSheet_(masterSpreadsheetId, title, upcFromName);
      if (existingProject) {
        const key = normEngine_(existingProject.upc || upcFromName).toUpperCase();
        if (key) projects.set(key, existingProject);
      }
    }
  }

  const issues = [];
  let processedCount = 0;

  onProgress({ percent: 25, message: `Discovered ${rowCount} rows in Master Sheet. Processing reports...` });

  // Parse Master Rows
  for (let idx = 0; idx < rowCount; idx++) {
    const rowCells = rowDataList[idx]?.values || [];
    const formulaCells = formulaRows[idx] || [];
    const displayCells = displayRows[idx] || [];
    const masterRowNumber = headerRow + 2 + idx;

    // 1. Extract link from colIndices.link
    let url = "";
    if (colIndices.link >= 0) {
      url = extractUrlFromCell_(rowCells[colIndices.link], formulaCells[colIndices.link], displayCells[colIndices.link]);
    }

    const maxCol = Math.max(rowCells.length, formulaCells.length, displayCells.length);

    // 2. Powerful fallback: If link not at colIndices.link, scan ALL cells in this row!
    if (!url) {
      for (let c = 0; c < maxCol; c++) {
        const cand = extractUrlFromCell_(rowCells[c], formulaCells[c], displayCells[c]);
        if (cand && (
          /docs\.google\.com/i.test(cand) ||
          /drive\.google\.com/i.test(cand) ||
          (extractSpreadsheetId(cand) && extractSpreadsheetId(cand).length >= 20 && extractSpreadsheetId(cand) !== cand)
        )) {
          url = cand;
          break;
        }
      }
    }

    let masterUPC = cleanEngineStr_(colIndices.upc >= 0 ? (rowCells[colIndices.upc]?.formattedValue || displayCells[colIndices.upc]) : "");
    let masterProject = cleanEngineStr_(colIndices.project >= 0 ? (rowCells[colIndices.project]?.formattedValue || displayCells[colIndices.project]) : "");
    let masterPIU = cleanEngineStr_(colIndices.piu >= 0 ? (rowCells[colIndices.piu]?.formattedValue || displayCells[colIndices.piu]) : "");
    let masterWeek = parseEngineWeek_(colIndices.week >= 0 ? (rowCells[colIndices.week]?.formattedValue || displayCells[colIndices.week]) : "");
    const rawDateVal = colIndices.actualSurveyDate >= 0 ? (rowCells[colIndices.actualSurveyDate]?.formattedValue || displayCells[colIndices.actualSurveyDate]) : null;

    // Row-level fallback for masterWeek: scan all cells in row if not found at column
    if (!masterWeek) {
      for (let c = 0; c < maxCol; c++) {
        const cellText = cleanEngineStr_(rowCells[c]?.formattedValue || displayCells[c] || formulaCells[c]);
        const wCand = parseEngineWeek_(cellText);
        if (wCand && wCand >= 1 && wCand <= 200) {
          masterWeek = wCand;
          break;
        }
      }
    }

    // Row-level fallback for masterUPC: scan for standard NHAI UPC code pattern
    if (!masterUPC) {
      for (let c = 0; c < maxCol; c++) {
        const cellText = cleanEngineStr_(rowCells[c]?.formattedValue || displayCells[c] || formulaCells[c]);
        if (/^[A-Z]?\/?\d{4,5}\/\d{4,5}\/[A-Z0-9]+$/i.test(cellText) || /^[A-Z]\/\d{5}\/\d{5}/i.test(cellText)) {
          masterUPC = cellText;
          break;
        }
      }
    }

    // Row-level fallback for masterPIU: scan for known PIU names
    if (!masterPIU) {
      const knownPius = ["KOLKATA", "MALDA", "KRISHNAGAR", "JALPAIGURI", "KHARAGPUR", "BARDHAMAN", "PURULIA", "DURGAPUR", "BURDWAN"];
      for (let c = 0; c < maxCol; c++) {
        const cellText = cleanEngineStr_(rowCells[c]?.formattedValue || displayCells[c] || formulaCells[c]).toUpperCase();
        const hit = knownPius.find(k => cellText.includes(k));
        if (hit) {
          masterPIU = hit;
          break;
        }
      }
    }

    if (!masterUPC && !masterWeek && !url) {
      continue; // completely blank row
    }

    const reportSpreadsheetId = extractSpreadsheetId(url);
    const isGoogleSheetsUrl = /docs\.google\.com\/spreadsheets/i.test(url);
    const isGoogleDriveUrl = /drive\.google\.com/i.test(url) || /docs\.google\.com\/open\?id=/i.test(url);
    const hasValidDocId = Boolean(reportSpreadsheetId && reportSpreadsheetId !== url && /^[a-zA-Z0-9-_]{20,}$/.test(reportSpreadsheetId));

    if (!isGoogleSheetsUrl && !isGoogleDriveUrl && !hasValidDocId) {
      if (masterUPC || masterWeek) {
        issues.push([masterRowNumber, url || "(No URL)", masterUPC || "N/A", masterWeek || "N/A", "Row missing valid Google Sheets/Drive URL in Assessed Report Link column."]);
      }
      continue;
    }

    // In Smart Sync: If this project-week was already processed and has defect data, skip re-fetching to conserve quota
    const pKey = normEngine_(masterUPC).toUpperCase();
    const existingP = projects.get(pKey);
    if (preserveOld && masterWeek && existingP && existingP.cycles && existingP.cycles[masterWeek] && Object.keys(existingP.cycles[masterWeek].defects || {}).length > 0) {
      processedCount++;
      continue;
    }

    const pct = Math.min(80, Math.round(25 + ((idx / rowCount) * 55)));
    onProgress({ percent: pct, message: `Processing Row ${masterRowNumber}: [${masterUPC || 'Report'}] Week ${masterWeek || 'N/A'} (${idx + 1}/${rowCount})...` });

    // Pacing delay to avoid triggering Google Sheets 60 req/min rate limit
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      let reportMeta = null;
      let isOfficeFile = false;
      let fetchError = null;

      try {
        reportMeta = await getSpreadsheetMeta(reportSpreadsheetId);
      } catch (metaErr) {
        fetchError = metaErr;
        const msg = String(metaErr?.message || metaErr);
        if (
          msg.includes("The document must not be an Office file") ||
          msg.includes("Office file") ||
          msg.includes("FAILED_PRECONDITION") ||
          msg.includes("unsupported")
        ) {
          isOfficeFile = true;
        }
      }

      // If it's an Office file (.xlsx) or otherwise inaccessible, register the week with blank counts as requested
      if (isOfficeFile || !reportMeta) {
        const week = masterWeek;
        const upc = masterUPC;

        if (!upc || !week || week < 1) {
          issues.push([
            masterRowNumber, url, upc || "N/A", week || "N/A",
            isOfficeFile
              ? "Excel (.xlsx) file in Drive; skipped because UPC or Week was missing in Master row."
              : `Survey report inaccessible (${fetchError?.message || 'Access error'}); skipped because UPC or Week missing.`
          ]);
          continue;
        }

        if (specificWeekNum !== null && week !== specificWeekNum) {
          continue;
        }

        const key = normEngine_(upc).toUpperCase();
        if (!projects.has(key)) {
          projects.set(key, {
            upc: upc,
            name: masterProject || upc,
            nh: "",
            state: "",
            ro: "",
            piu: masterPIU || "",
            ae: "",
            contractor: "",
            das: "",
            cycles: {},
            duplicates: []
          });
        }

        const p = projects.get(key);
        p.upc = upc || p.upc;
        p.name = masterProject || p.name;
        p.piu = masterPIU || p.piu;
        if (!p.cycles) p.cycles = {};
        if (!p.duplicates) p.duplicates = [];

        if (p.cycles[week]) {
          p.duplicates.push(week);
        }

        p.cycles[week] = {
          defects: {},
          url: url,
          survey: {
            surveyCycle: `Week ${week}`,
            surveyId: masterSurveyId || "",
            projectName: p.name,
            upcCode: upc,
            piuName: p.piu
          },
          surveyDate: formatEngineDate_(rawDateVal) || "",
          masterRow: masterRowNumber,
          isExcelBlank: true
        };

        issues.push([
          masterRowNumber, url, upc, week,
          isOfficeFile
            ? "Excel (.xlsx) file in Drive: Defect data left blank as requested."
            : `External report inaccessible (${fetchError?.message || 'Access issue'}): Week registered with blank defect counts.`
        ]);

        dirtyProjectKeys.add(key);
        processedCount++;
        continue;
      }

      const reportSheets = reportMeta.sheets || [];

      // Resilient tab matching
      let surveySheetObj = reportSheets.find(s => {
        const n = normEngine_(s.properties.title);
        return n.includes("surveyform") || n === "surveyform" || n.includes("survey") || n.includes("form") || n.includes("projectinfo") || n.includes("details");
      });
      let activitySheetObj = reportSheets.find(s => {
        const n = normEngine_(s.properties.title);
        return n.includes("activitylog") || n === "activitylog" || n.includes("activity") || n.includes("defect") || n.includes("log") || n.includes("data");
      });

      // Positional fallbacks if named tabs differ
      if (!surveySheetObj && reportSheets.length >= 1) {
        surveySheetObj = reportSheets[0];
      }
      if (!activitySheetObj && reportSheets.length >= 2) {
        activitySheetObj = reportSheets.find(s => s !== surveySheetObj) || reportSheets[1];
      } else if (!activitySheetObj && reportSheets.length === 1) {
        activitySheetObj = reportSheets[0];
      }

      if (!surveySheetObj || !activitySheetObj) {
        throw new Error("Survey form ya Activity log sheet nahi mili.");
      }

      // Read Survey Form & Activity Log in a single batchGet request (halves API quota usage)
      let surveyGrid = [], activityGrid = [];
      try {
        const batchGrids = await batchGetValues(
          reportSpreadsheetId,
          [`'${surveySheetObj.properties.title}'!A1:Z60`, `'${activitySheetObj.properties.title}'!A1:Z500`],
          'FORMATTED_VALUE'
        );
        surveyGrid = batchGrids[0] || [];
        activityGrid = batchGrids[1] || [];
      } catch (batchErr) {
        surveyGrid = await getValues(reportSpreadsheetId, `'${surveySheetObj.properties.title}'!A1:Z60`, 'FORMATTED_VALUE');
        activityGrid = await getValues(reportSpreadsheetId, `'${activitySheetObj.properties.title}'!A1:Z500`, 'FORMATTED_VALUE');
      }
      const survey = parseSurveyFormGrid_(surveyGrid);

      const week = masterWeek || parseEngineWeek_(survey.surveyCycle);
      const upc = masterUPC || survey.upcCode;

      if (!week || week < 1) {
        throw new Error("Survey week identify nahi hua.");
      }
      if (!upc) {
        throw new Error("UPC Code missing hai.");
      }

      if (specificWeekNum !== null && week !== specificWeekNum) {
        continue;
      }

      if (survey.surveyCycle && masterWeek && parseEngineWeek_(survey.surveyCycle) !== masterWeek) {
        issues.push([
          masterRowNumber, url, upc, week,
          "Master week aur Survey Cycle alag hain."
        ]);
      }

      if (masterUPC && survey.upcCode && normEngine_(masterUPC) !== normEngine_(survey.upcCode)) {
        issues.push([
          masterRowNumber, url, masterUPC, week,
          "UPC mismatch: Survey form mein " + survey.upcCode
        ]);
      }

      const key = normEngine_(upc).toUpperCase();
      if (!projects.has(key)) {
        projects.set(key, {
          upc: upc,
          name: survey.projectName || masterProject || upc,
          nh: survey.nhNumber || "",
          state: survey.stateName || "",
          ro: survey.roName || "",
          piu: survey.piuName || masterPIU || "",
          ae: survey.aeIeScName || "",
          contractor: survey.contractorName || "",
          das: survey.dasAgency || "",
          cycles: {},
          duplicates: []
        });
      }

      const p = projects.get(key);
      p.upc = upc || p.upc;
      p.name = survey.projectName || p.name || masterProject;
      p.nh = survey.nhNumber || p.nh || "";
      p.state = survey.stateName || p.state || "";
      p.ro = survey.roName || p.ro || "";
      p.piu = survey.piuName || p.piu || masterPIU;
      p.ae = survey.aeIeScName || p.ae || "";
      p.contractor = survey.contractorName || p.contractor || "";
      p.das = survey.dasAgency || p.das || "";
      if (!p.cycles) p.cycles = {};
      if (!p.duplicates) p.duplicates = [];

      const defects = parseActivityGrid_(activityGrid);

      if (p.cycles[week]) {
        p.duplicates.push(week);
        issues.push([
          masterRowNumber, url, upc, week,
          "Duplicate project-week link; last valid report used."
        ]);
      }

      const actualDateFormatted = formatEngineDate_(rawDateVal) || survey.surveyEndDate || "";
      p.cycles[week] = {
        defects: defects,
        url: url,
        survey: survey,
        surveyDate: actualDateFormatted,
        masterRow: masterRowNumber
      };

      dirtyProjectKeys.add(key);
      processedCount++;
    } catch (err) {
      console.error(`[Defect Engine] Row ${masterRowNumber} error:`, err);
      issues.push([masterRowNumber, url, masterUPC || "N/A", masterWeek || "", err.message || String(err)]);
      // Self-healing recovery: If UPC and Week are identified, register the week as blank so the project table includes this week
      if (masterUPC && masterWeek && masterWeek >= 1) {
        const key = normEngine_(masterUPC).toUpperCase();
        if (!projects.has(key)) {
          projects.set(key, {
            upc: masterUPC,
            name: masterProject || masterUPC,
            nh: "",
            state: "",
            ro: "",
            piu: masterPIU || "",
            ae: "",
            contractor: "",
            das: "",
            cycles: {},
            duplicates: []
          });
        }
        const p = projects.get(key);
        if (!p.cycles) p.cycles = {};
        if (!p.cycles[masterWeek]) {
          p.cycles[masterWeek] = {
            defects: {},
            url: url,
            survey: { surveyCycle: `Week ${masterWeek}`, projectName: p.name, upcCode: masterUPC, piuName: p.piu },
            surveyDate: formatEngineDate_(rawDateVal) || "",
            masterRow: masterRowNumber,
            isExcelBlank: true
          };
          dirtyProjectKeys.add(key);
          processedCount++;
        }
      }
    }
  }

  if (processedCount === 0 && (!projects || projects.size === 0)) {
    const issueSummary = issues.slice(0, 3).map(i => `Row ${i[0]}: ${i[4]}`).join("\n");
    throw new Error(
      `Zero reports were processed from Master Sheet tab "${masterTitle}"!\n\n` +
      `Reason: No valid Google Sheets survey links were found in the "Assessed Report Link" column.\n\n` +
      (issueSummary ? `Sample Issues Found:\n${issueSummary}\n\n` : '') +
      `Please ensure that:\n` +
      `1. You connected the Master Spreadsheet (not an individual survey sheet).\n` +
      `2. The "Assessed Report Link" column contains Google Sheets URLs (e.g. https://docs.google.com/spreadsheets/d/...).`
    );
  }

  onProgress({ percent: 82, message: `Read ${processedCount} report(s). Generating project defect summary sheets...` });

  // Generate / Update Project Sheets (Defect - <UPC>)
  const indexRows = [];
  // Calculate globalMaxWeek across all projects so all sheets have complete columns (e.g. up to Week 16)
  const projectEntries = Array.from(projects.values());
  let globalMaxWeek = 0;
  for (const project of projectEntries) {
    const ws = Object.keys(project.cycles || {}).map(Number).filter(n => Number.isFinite(n));
    if (ws.length > 0) {
      const m = Math.max(...ws);
      if (m > globalMaxWeek) globalMaxWeek = m;
    }
  }

  let projIdx = 0;
  for (const project of projectEntries) {
    projIdx++;
    if (!project.cycles || Object.keys(project.cycles).length === 0) continue;

    const sheetName = (DEFECT_CFG.PROJECT_PREFIX + " " + project.upc).trim().substring(0, 99);
    const existingId = await getSheetIdByName(masterSpreadsheetId, sheetName);
    const isNewSheet = existingId === null;
    const projectKey = normEngine_(project.upc).toUpperCase();

    // Rebuild/write the project sheet whenever it has data or is marked dirty
    if (dirtyProjectKeys.has(projectKey) || isNewSheet || mode === 'reset' || Object.keys(project.cycles).length > 0) {
      onProgress({
        percent: Math.round(82 + (projIdx / projectEntries.length) * 8),
        message: `Building sheet: "${sheetName}" (${projIdx}/${projectEntries.length})...`
      });
      await writeProjectSheetToSpreadsheet_(masterSpreadsheetId, sheetName, project, globalMaxWeek);
    }

    const weeks = Object.keys(project.cycles).map(Number).sort((a, b) => a - b);
    const maxWeek = weeks.length ? Math.max(...weeks) : 0;
    const latestWeekNum = specificWeekNum !== null ? specificWeekNum : maxWeek;
    const latestWeek = "Week " + (latestWeekNum || 1);
    const missing = [];
    for (let w = 1; w <= maxWeek; w++) {
      if (!project.cycles[w]) missing.push(w);
    }

    const outSheetId = await getSheetIdByName(masterSpreadsheetId, sheetName);
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${masterSpreadsheetId}/edit#gid=${outSheetId}`;
    const selectedCycle = project.cycles[latestWeekNum] || project.cycles[maxWeek] || {};
    let docUrl = "";

    // Generate Google Docs Compliance Letter if enabled
    if (generateLetters && selectedCycle.survey) {
      try {
        onProgress({
          percent: 91,
          message: `Generating Compliance Letter for [${project.upc}] ${latestWeek}...`
        });
        docUrl = await createComplianceLetterGoogleDoc_(project, latestWeek, sheetUrl, selectedCycle);
      } catch (docErr) {
        console.warn(`[Compliance Letter] Failed for ${project.upc}:`, docErr);
        issues.push(["", "", project.upc, latestWeekNum, `Letter generation note: ${docErr.message}`]);
      }
    }

    const totalDefects = calculateProjectTotal_(project);
    indexRows.push({
      name: project.name,
      upc: project.upc,
      piu: project.piu,
      found: weeks,
      missing: missing,
      total: totalDefects,
      sheet: sheetName,
      sheetUrl: sheetUrl,
      docUrl: docUrl,
      latestWeek: latestWeek
    });
  }

  // Write PIU-Wise Defect Summary Sheet
  onProgress({ percent: 94, message: "Writing 'PIU-WISE DEFECT SUMMARY' sheet..." });
  await writePiuWiseSummarySheet_(masterSpreadsheetId, projects);

  // Write Master Defect Index Sheet
  onProgress({ percent: 97, message: "Writing 'Defect Index' dashboard..." });
  await writeDefectIndexSheet_(masterSpreadsheetId, indexRows, issues, masterTitle);

  onProgress({ percent: 100, message: "Defect Report & Compliance Automation completed successfully!" });

  // Convert projects Map to serializable list for storage and UI Letter Generator
  const projectsList = [];
  for (const [key, p] of projects.entries()) {
    projectsList.push({
      key,
      upc: p.upc || key,
      name: p.name || "",
      nh: p.nh || "",
      state: p.state || "",
      ro: p.ro || "",
      piu: p.piu || "",
      ae: p.ae || "",
      contractor: p.contractor || "",
      das: p.das || "",
      docUrl: p.docUrl || "",
      latestWeek: p.latestWeek || null,
      missingWeeks: p.missingWeeks || [],
      cycles: p.cycles || {}
    });
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ 'DEFECT_SAVED_PROJECTS': projectsList });
    }
  } catch (stErr) {
    console.warn("Could not cache projects in storage:", stErr);
  }

  return {
    success: true,
    processedReports: processedCount,
    projectsMapped: projects.size,
    issuesRecorded: issues.length,
    indexSheetName: DEFECT_CFG.INDEX_SHEET,
    piuSummarySheetName: DEFECT_CFG.PIU_SUMMARY_SHEET,
    indexRows: indexRows,
    issues: issues,
    projects: projects,
    projectsList: projectsList
  };
}

function calculateProjectTotal_(project) {
  let sum = 0;
  for (const c of Object.values(project.cycles || {})) {
    for (const v of Object.values(c.defects || {})) {
      const n = Number(v);
      if (Number.isFinite(n)) sum += n;
    }
  }
  return sum;
}

// Parse Survey Form Matrix
function parseSurveyFormGrid_(values) {
  const result = {
    surveyCycle: "", surveyId: "", surveyStartDate: "", surveyEndDate: "",
    projectName: "", nhNumber: "", upcCode: "", stateName: "", roName: "",
    piuName: "", aeIeScName: "", contractorName: "", dasAgency: ""
  };
  if (!values || values.length === 0) return result;

  const labelMap = [
    { keys: ["survey cycle", "survey week", "cycle", "week", "cycle no", "cycle no.", "cycle number", "week no", "week no.", "week number", "assessment week"], field: "surveyCycle" },
    { keys: ["survey id", "surveyid", "id"], field: "surveyId" },
    { keys: ["survey start date", "start date"], field: "surveyStartDate" },
    { keys: ["survey end date", "end date", "completion date"], field: "surveyEndDate" },
    { keys: ["project name", "project"], field: "projectName" },
    { keys: ["nh number", "national highway number", "nh", "nh no", "nh no."], field: "nhNumber" },
    { keys: ["upc code", "upc", "project upc", "upc no", "upc number"], field: "upcCode" },
    { keys: ["name of state", "state name", "state"], field: "stateName" },
    { keys: ["ro name", "regional office", "ro"], field: "roName" },
    { keys: ["piu name", "piu"], field: "piuName" },
    { keys: ["ae/ie/sc name", "ae ie sc name", "ae/ie/sc", "authority engineer", "independent engineer"], field: "aeIeScName" },
    { keys: ["contractor/ o&m agency", "contractor/o&m agency", "contractor / o&m agency", "contractor", "o&m agency", "concessionaire"], field: "contractorName" },
    { keys: ["das agency", "das"], field: "dasAgency" }
  ];

  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const cellText = cleanEngineStr_(values[r][c]);
      const normalized = cellText.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!normalized) continue;

      for (const item of labelMap) {
        const matchingKey = item.keys.find(k => {
          const nk = k.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          return normalized === nk || normalized.startsWith(nk + " ");
        });
        if (!matchingKey || result[item.field]) continue;

        // Check if inline (e.g. "Survey Cycle: Week 3")
        const labelRegex = new RegExp("^\\s*" + matchingKey.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\s*:?\\s*", "i");
        let inlineVal = cellText.replace(labelRegex, "").trim();
        if (inlineVal && inlineVal !== cellText) {
          result[item.field] = inlineVal;
          continue;
        }

        // Neighbor cell to right
        let found = "";
        for (let cc = c + 1; cc < values[r].length; cc++) {
          const cand = cleanEngineStr_(values[r][cc]);
          if (cand && cand.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() !== normalized) {
            found = cand;
            break;
          }
        }
        // Neighbor cell in below row (for merged vertical labels)
        if (!found) {
          for (let rr = r + 1; rr < Math.min(values.length, r + 3) && !found; rr++) {
            for (let cc = c; cc < values[rr].length; cc++) {
              const cand = cleanEngineStr_(values[rr][cc]);
              const cNorm = cand.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
              if (cand && !labelMap.some(x => x.keys.some(k => cNorm === k.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()))) {
                found = cand;
                break;
              }
            }
          }
        }

        if (found) {
          if (item.field === "surveyStartDate" || item.field === "surveyEndDate") {
            result[item.field] = formatEngineDate_(found) || found;
          } else {
            result[item.field] = found;
          }
        }
      }
    }
  }

  return result;
}

// Parse Activity Log Grid
function parseActivityGrid_(values) {
  if (!values || values.length === 0) return {};
  let headerRow = -1, defectCol = -1, countCol = -1;

  for (let r = 0; r < values.length; r++) {
    const rowNorm = values[r].map(h => cleanEngineStr_(h).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
    defectCol = rowNorm.findIndex(h => h.includes("defect type") || h.includes("defect") || h.includes("description") || h.includes("item") || h.includes("name"));
    countCol = rowNorm.findIndex((h, idx) =>
      idx !== defectCol &&
      (h.includes("total defects") || h.includes("total") || h.includes("count") || h.includes("nos") || h.includes("no of") || h.includes("qty") || h.includes("quantity") || h.includes("number"))
    );

    if (defectCol >= 0 && countCol >= 0 && defectCol !== countCol) {
      headerRow = r;
      break;
    }
  }

  // Fallback hunter: find any row where a cell mentions defect/damage and an adjacent cell contains counts
  if (headerRow < 0) {
    for (let r = 0; r < Math.min(values.length, 15); r++) {
      const rowNorm = values[r].map(h => cleanEngineStr_(h).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
      const d = rowNorm.findIndex(h => h.includes("defect") || h.includes("item") || h.includes("particulars"));
      if (d >= 0) {
        defectCol = d;
        countCol = rowNorm.findIndex((_, idx) => idx !== d);
        if (countCol >= 0) {
          headerRow = r;
          break;
        }
      }
    }
  }

  if (headerRow < 0) {
    console.warn("Activity Log sheet missing standard header row; returning empty defect counts.");
    return {};
  }

  const defects = {};
  for (let r = headerRow + 1; r < values.length; r++) {
    const rawName = cleanEngineStr_(values[r][defectCol]);
    const rawCount = cleanEngineStr_(values[r][countCol]).replace(/,/g, "");

    if (!rawName || /^total$/i.test(rawName)) continue;
    if (!/^-?\d+(?:\.\d+)?$/.test(rawCount)) continue;

    const stdName = standardizeDefectCategory_(rawName);
    defects[stdName] = (defects[stdName] || 0) + Number(rawCount);
  }
  return defects;
}

// Read existing Defect - <UPC> sheet
async function readExistingProjectFromSheet_(spreadsheetId, sheetName, fallbackUpc = "") {
  try {
    const data = await getValues(spreadsheetId, `'${sheetName}'!A1:ZZ100`, 'FORMATTED_VALUE');
    if (!data || data.length < 7) return null;

    let headerRow = -1;
    for (let r = 4; r < Math.min(data.length, 15); r++) {
      if ((data[r] || []).some(c => cleanEngineStr_(c).toLowerCase().includes("defect type"))) {
        headerRow = r;
        break;
      }
    }
    if (headerRow < 0) return null;

    let projectName = "", upcCode = "", piuName = "";
    let nhNumber = "", stateName = "", roName = "", aeName = "", contractorName = "", dasName = "";
    for (let r = 1; r < headerRow; r++) {
      const label = cleanEngineStr_(data[r]?.[0]).toLowerCase();
      const val = cleanEngineStr_(data[r]?.[1] || data[r]?.[2]);
      if (label.includes("project name")) projectName = val;
      else if (label.includes("upc")) upcCode = val;
      else if (label.includes("nh")) nhNumber = val;
      else if (label.includes("state")) stateName = val;
      else if (label.includes("ro name") || label.includes("regional")) roName = val;
      else if (label.includes("piu")) piuName = val;
      else if (label.includes("ae") || label.includes("ie") || label.includes("sc")) aeName = val;
      else if (label.includes("contractor") || label.includes("o&m")) contractorName = val;
      else if (label.includes("das")) dasName = val;
    }

    if (!upcCode) upcCode = fallbackUpc;
    if (!upcCode) return null;

    const headers = data[headerRow] || [];
    const weekIndices = [];

    for (let c = 2; c < headers.length; c++) {
      const h = cleanEngineStr_(headers[c]);
      const match = h.match(/^(?:week|w|cycle|c)\s*(\d+)$/i);
      if (match) weekIndices.push({ week: Number(match[1]), colIdx: c });
    }

    const cycles = {};
    const processedWeeksTracker = new Set();
    const defectRows = [];

    for (let r = headerRow + 1; r < data.length; r++) {
      const defectName = cleanEngineStr_(data[r]?.[1]);
      if (!defectName || defectName.toUpperCase() === "TOTAL DEFECTS") continue;
      defectRows.push({ row: data[r], name: defectName });
    }

    weekIndices.forEach(wi => {
      const hasData = defectRows.some(item => cleanEngineStr_(item.row[wi.colIdx]) !== "");
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
      nh: nhNumber,
      state: stateName,
      ro: roName,
      piu: piuName,
      ae: aeName,
      contractor: contractorName,
      das: dasName,
      cycles: cycles,
      duplicates: [],
      processedWeeksTracker: processedWeeksTracker
    };
  } catch (e) {
    console.warn(`Could not read existing sheet ${sheetName}:`, e);
    return null;
  }
}

// Write individual Defect - <UPC> sheet
async function writeProjectSheetToSpreadsheet_(spreadsheetId, sheetName, project, globalMaxWeek = 0) {
  const sheetId = await ensureSheetExists(spreadsheetId, sheetName);

  const weekNumbers = Object.keys(project.cycles).map(Number).filter(n => Number.isFinite(n));
  const projectMaxWeek = weekNumbers.length ? Math.max(...weekNumbers) : 0;
  const maxWeek = Math.max(projectMaxWeek, globalMaxWeek || 0);

  // Collect all defects found for this project
  const defectSet = new Set();
  Object.values(project.cycles).forEach(c => {
    Object.keys((c && c.defects) || {}).forEach(d => { if (d) defectSet.add(d); });
  });
  let defectNames = [...defectSet].sort((a, b) => a.localeCompare(b));
  if (defectNames.length === 0) {
    defectNames = [...DEFECT_STANDARD_LIST];
  }

  const sortedWeeks = weekNumbers
    .filter(w => !!project.cycles[w] && !project.cycles[w].isExcelBlank)
    .sort((a, b) => a - b);

  let deltaHeader = "Previous Week - Current Week";
  let canCompareWeeks = false;
  let prevW = null;
  let currW = null;

  if (sortedWeeks.length >= 2) {
    currW = sortedWeeks[sortedWeeks.length - 1];
    prevW = sortedWeeks[sortedWeeks.length - 2];
    deltaHeader = `Week ${prevW} - Week ${currW}`;
    canCompareWeeks = true;
  }

  const headers = [
    "S. No.", "Defect Type",
    ...Array.from({ length: maxWeek }, (_, i) => "Week " + (i + 1)),
    "Grand Total",
    deltaHeader
  ];
  const totalCols = headers.length;

  const rows = [];
  const weekTotals = Array(maxWeek).fill(0);
  let grandTotal = 0;

  defectNames.forEach((name, i) => {
    const row = [i + 1, name];
    let defectTotal = 0;

    for (let w = 1; w <= maxWeek; w++) {
      const cycle = project.cycles[w];
      const hasCycle = !!cycle;
      const isBlank = cycle && cycle.isExcelBlank;
      const rawCount = cycle && cycle.defects ? cycle.defects[name] : undefined;
      const count = hasCycle ? (isBlank ? "" : (rawCount === undefined || rawCount === "" ? 0 : Number(rawCount) || 0)) : "";
      row.push(count);

      if (hasCycle && count !== "" && !isBlank) {
        defectTotal += Number(count) || 0;
        weekTotals[w - 1] += Number(count) || 0;
      }
    }

    row.push(defectTotal);
    const outputRowNumber = 12 + i; // 1-indexed row in sheet
    if (canCompareWeeks) {
      const prevCol = columnLetter_(prevW + 2);
      const currCol = columnLetter_(currW + 2);
      row.push(`=N(${prevCol}${outputRowNumber})-N(${currCol}${outputRowNumber})`);
    } else {
      row.push("");
    }

    grandTotal += defectTotal;
    rows.push(row);
  });

  const totalRowNumber = 12 + rows.length;
  const totalRow = [
    "", "TOTAL DEFECTS",
    ...weekTotals.map((n, i) => {
      const cycle = project.cycles[i + 1];
      if (!cycle || cycle.isExcelBlank) return "";
      return n;
    }),
    grandTotal,
    canCompareWeeks
      ? `=N(${columnLetter_(prevW + 2)}${totalRowNumber})-N(${columnLetter_(currW + 2)}${totalRowNumber})`
      : ""
  ];

  // Grid sizing
  await ensureGridDimensions(spreadsheetId, sheetId, totalRowNumber + 5, totalCols + 2);

  // Clear sheet
  await batchUpdateSpreadsheet(spreadsheetId, [
    {
      updateCells: {
        range: { sheetId: sheetId },
        fields: "userEnteredValue,userEnteredFormat"
      }
    },
    {
      unmergeCells: {
        range: { sheetId: sheetId }
      }
    }
  ]);

  // Set values: Title at Row 1, Meta at Rows 2-10
  const metaValues = [
    ["WEEKLY DEFECT SUMMARY REPORT"],
    ["Project Name", project.name || ""],
    ["UPC Code", project.upc || ""],
    ["NH Number", project.nh || ""],
    ["State", project.state || ""],
    ["RO Name", project.ro || ""],
    ["PIU Name", project.piu || ""],
    ["AE/IE/SC Name", project.ae || ""],
    ["Contractor / O&M Agency", project.contractor || ""],
    ["DAS Agency", project.das || ""]
  ];

  await updateValues(spreadsheetId, `'${sheetName}'!A1:B10`, metaValues, 'USER_ENTERED');
  await updateValues(spreadsheetId, `'${sheetName}'!A11:${columnLetter_(totalCols)}11`, [headers], 'USER_ENTERED');
  if (rows.length > 0) {
    await updateValues(spreadsheetId, `'${sheetName}'!A12:${columnLetter_(totalCols)}${11 + rows.length}`, rows, 'USER_ENTERED');
  }
  await updateValues(spreadsheetId, `'${sheetName}'!A${totalRowNumber}:${columnLetter_(totalCols)}${totalRowNumber}`, [totalRow], 'USER_ENTERED');

  // Format styling batch
  const formatRequests = [
    // Merge title row A1:B1
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
        mergeType: "MERGE_ALL"
      }
    },
    // Style Title Banner
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            backgroundColor: { red: 0.08, green: 0.2, blue: 0.38 }
          }
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment,backgroundColor)"
      }
    },
    // Style Meta Labels (A2:A10 bold, light subtle background)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 10 },
            verticalAlignment: "MIDDLE",
            backgroundColor: { red: 0.96, green: 0.97, blue: 0.99 }
          }
        },
        fields: "userEnteredFormat(textFormat,verticalAlignment,backgroundColor)"
      }
    },
    // Style Meta Values (B2:B10 with WRAP so long names never clip)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 10, startColumnIndex: 1, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP"
          }
        },
        fields: "userEnteredFormat(verticalAlignment,wrapStrategy)"
      }
    },
    // Meta Card Borders (A1:B10)
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 2 },
        top: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        bottom: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        left: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        right: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        innerHorizontal: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } },
        innerVertical: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } }
      }
    },
    // Style Table Headers (Row 11)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 0, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            backgroundColor: { red: 0.08, green: 0.2, blue: 0.38 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)"
      }
    },
    // Align Defect Type header (B11) to Left
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 1, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "LEFT"
          }
        },
        fields: "userEnteredFormat.horizontalAlignment"
      }
    },
    // Style Total Defects Row
    {
      repeatCell: {
        range: { sheetId, startRowIndex: totalRowNumber - 1, endRowIndex: totalRowNumber, startColumnIndex: 0, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.93, green: 0.94, blue: 0.96 },
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,verticalAlignment)"
      }
    },
    // Center numbers across all week columns
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 11, endRowIndex: totalRowNumber, startColumnIndex: 2, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)"
      }
    },
    // Center S.No column
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 11, endRowIndex: totalRowNumber, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)"
      }
    },
    // Left-align Defect Type descriptions
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 11, endRowIndex: totalRowNumber - 1, startColumnIndex: 1, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "LEFT",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)"
      }
    },
    // Borders on Table
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 10, endRowIndex: totalRowNumber, startColumnIndex: 0, endColumnIndex: totalCols },
        top: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        bottom: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        left: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        right: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        innerHorizontal: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } },
        innerVertical: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } }
      }
    },
    // Freeze Row 11 and Column 2
    {
      updateSheetProperties: {
        properties: {
          sheetId: sheetId,
          gridProperties: {
            frozenRowCount: 11,
            frozenColumnCount: 2
          }
        },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount"
      }
    },
    // Row Heights (Title, Metadata, Table Header)
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 42 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 10 },
        properties: { pixelSize: 28 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 10, endIndex: 11 },
        properties: { pixelSize: 38 },
        fields: "pixelSize"
      }
    },
    // Set Column Dimensions (210px for Column A, 340px for Column B)
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 210 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 340 },
        fields: "pixelSize"
      }
    }
  ];

  if (maxWeek > 0) {
    formatRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 2 + maxWeek },
        properties: { pixelSize: 76 },
        fields: "pixelSize"
      }
    });
  }
  formatRequests.push(
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: maxWeek + 2, endIndex: maxWeek + 3 },
        properties: { pixelSize: 110 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: maxWeek + 3, endIndex: maxWeek + 4 },
        properties: { pixelSize: 165 },
        fields: "pixelSize"
      }
    }
  );

  try {
    await batchUpdateSpreadsheet(spreadsheetId, formatRequests);
  } catch (fmtErr) {
    console.warn(`[Styling Note] Partial formatting applied on ${sheetName}:`, fmtErr?.message || fmtErr);
  }
}

// Write PIU-WISE DEFECT SUMMARY Sheet
async function writePiuWiseSummarySheet_(spreadsheetId, projects) {
  const sheetName = DEFECT_CFG.PIU_SUMMARY_SHEET;
  const sheetId = await ensureSheetExists(spreadsheetId, sheetName);

  const projectList = Array.from(projects.values()).filter(p =>
    p && p.cycles && Object.keys(p.cycles).length > 0
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

  const rows = [];
  const sortedProjects = projectList.slice().sort((a, b) =>
    cleanEngineStr_(a.piu).localeCompare(cleanEngineStr_(b.piu)) ||
    cleanEngineStr_(a.name).localeCompare(cleanEngineStr_(b.name)) ||
    cleanEngineStr_(a.upc).localeCompare(cleanEngineStr_(b.upc))
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
        if (!p.cycles[w] || p.cycles[w].isExcelBlank) {
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

  await ensureGridDimensions(spreadsheetId, sheetId, rows.length + 10, lastCol + 2);

  // Clear sheet
  await batchUpdateSpreadsheet(spreadsheetId, [
    { updateCells: { range: { sheetId }, fields: "userEnteredValue,userEnteredFormat" } },
    { unmergeCells: { range: { sheetId } } }
  ]);

  const topRows = [
    ["PIU-WISE DEFECT SUMMARY — DEFECT TYPE & WEEK BREAKDOWN"],
    ["Counts are aggregated from validated Activity Log data. Blank week cells indicate no report was provided for that week."],
    [""]
  ];

  await updateValues(spreadsheetId, `'${sheetName}'!A1:${columnLetter_(lastCol)}3`, topRows, 'USER_ENTERED');
  await updateValues(spreadsheetId, `'${sheetName}'!A4:${columnLetter_(lastCol)}4`, [headers], 'USER_ENTERED');
  if (rows.length > 0) {
    await updateValues(spreadsheetId, `'${sheetName}'!A5:${columnLetter_(lastCol)}${4 + rows.length}`, rows, 'USER_ENTERED');
  }

  // Format styling
  const styleRequests = [
    // Merge Row 1
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
        mergeType: "MERGE_ALL"
      }
    },
    // Merge Row 2
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: lastCol },
        mergeType: "MERGE_ALL"
      }
    },
    // Style Title Row
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 0.08, green: 0.16, blue: 0.28 } },
            horizontalAlignment: "CENTER",
            backgroundColor: { red: 0.94, green: 0.96, blue: 0.98 }
          }
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)"
      }
    },
    // Style Headers (Row 4)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: lastCol },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            backgroundColor: { red: 0.08, green: 0.2, blue: 0.38 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)"
      }
    },
    // Freeze top 4 rows
    {
      updateSheetProperties: {
        properties: {
          sheetId: sheetId,
          gridProperties: { frozenRowCount: 4 }
        },
        fields: "gridProperties.frozenRowCount"
      }
    },
    // Table borders
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 3, endRowIndex: Math.max(4 + rows.length, 5), startColumnIndex: 0, endColumnIndex: lastCol },
        top: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        bottom: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        left: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        right: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        innerHorizontal: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } },
        innerVertical: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } }
      }
    },
    // Column widths
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 55 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 150 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 250 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 },
        properties: { pixelSize: 130 },
        fields: "pixelSize"
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 },
        properties: { pixelSize: 280 },
        fields: "pixelSize"
      }
    }
  ];

  if (maxWeek > 0) {
    styleRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 5 + maxWeek },
        properties: { pixelSize: 76 },
        fields: "pixelSize"
      }
    });
  }

  // Set filter on header row
  if (rows.length > 0) {
    styleRequests.push({
      setBasicFilter: {
        filter: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 4 + rows.length, startColumnIndex: 0, endColumnIndex: lastCol }
        }
      }
    });
  }

  try {
    await batchUpdateSpreadsheet(spreadsheetId, styleRequests);
  } catch (fmtErr) {
    console.warn("[Styling Note] Partial formatting applied on PIU Summary Sheet:", fmtErr?.message || fmtErr);
  }
}

// Write Defect Index Master Sheet
async function writeDefectIndexSheet_(spreadsheetId, indexRows, issues, sourceName) {
  const sheetName = DEFECT_CFG.INDEX_SHEET;
  const sheetId = await ensureSheetExists(spreadsheetId, sheetName);

  const headers = [
    "Project Name", "UPC Code", "PIU Name", "Weeks Found",
    "Missing Weeks", "Total Defects", "Report Sheet Link", "Compliance Letter", "Latest Week"
  ];

  const outputRows = indexRows.map(p => {
    const reportFormula = p.sheetUrl ? `=HYPERLINK("${p.sheetUrl}", "Open Report Sheet")` : "";
    const docFormula = p.docUrl ? `=HYPERLINK("${p.docUrl}", "Open Compliance Letter")` : (p.latestWeek ? "Pending / Direct" : "");
    return [
      p.name,
      p.upc,
      p.piu || "",
      p.found.map(w => "W" + w).join(", "),
      p.missing.map(w => "W" + w).join(", "),
      p.total,
      reportFormula,
      docFormula,
      p.latestWeek
    ];
  });

  const totalRequiredRows = outputRows.length + issues.length + 25;
  await ensureGridDimensions(spreadsheetId, sheetId, totalRequiredRows, 10);

  // Clear sheet
  await batchUpdateSpreadsheet(spreadsheetId, [
    { updateCells: { range: { sheetId }, fields: "userEnteredValue,userEnteredFormat" } },
    { unmergeCells: { range: { sheetId } } }
  ]);

  const topBlock = [
    ["PROJECT-WISE WEEKLY DEFECT INDEX & COMPLIANCE LETTERS"],
    ["Source Master Sheet", sourceName],
    ["Last Updated", new Date().toLocaleString()],
    ["Projects Analyzed", indexRows.length],
    [""]
  ];

  await updateValues(spreadsheetId, `'${sheetName}'!A1:B5`, topBlock, 'USER_ENTERED');
  await updateValues(spreadsheetId, `'${sheetName}'!A6:I6`, [headers], 'USER_ENTERED');
  if (outputRows.length > 0) {
    await updateValues(spreadsheetId, `'${sheetName}'!A7:I${6 + outputRows.length}`, outputRows, 'USER_ENTERED');
  }

  // Issue log section
  const issueStartRow = Math.max(7 + outputRows.length + 3, 11);
  const issueHeaders = [["SOURCE ISSUES LOG", "Source URL", "UPC Code", "Week", "Details / Issue Message"]];
  await updateValues(spreadsheetId, `'${sheetName}'!A${issueStartRow}:E${issueStartRow}`, issueHeaders, 'USER_ENTERED');

  if (issues.length > 0) {
    await updateValues(spreadsheetId, `'${sheetName}'!A${issueStartRow + 1}:E${issueStartRow + issues.length}`, issues, 'USER_ENTERED');
  }

  // Format styling
  const styleRequests = [
    // Merge Title A1:I1
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
        mergeType: "MERGE_ALL"
      }
    },
    // Title style
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 0.08, green: 0.16, blue: 0.28 } },
            horizontalAlignment: "CENTER",
            backgroundColor: { red: 0.94, green: 0.96, blue: 0.98 }
          }
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)"
      }
    },
    // Meta Labels Bold
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: { textFormat: { bold: true } }
        },
        fields: "userEnteredFormat.textFormat"
      }
    },
    // Table Header (Row 6)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            backgroundColor: { red: 0.08, green: 0.2, blue: 0.38 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP"
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)"
      }
    },
    // Table Borders
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 5, endRowIndex: Math.max(6 + outputRows.length, 7), startColumnIndex: 0, endColumnIndex: 9 },
        top: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        bottom: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        left: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        right: { style: "SOLID", width: 1, color: { red: 0.75, green: 0.75, blue: 0.75 } },
        innerHorizontal: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } },
        innerVertical: { style: "SOLID", width: 1, color: { red: 0.88, green: 0.88, blue: 0.88 } }
      }
    },
    // Issue Headers
    {
      repeatCell: {
        range: { sheetId, startRowIndex: issueStartRow - 1, endRowIndex: issueStartRow, startColumnIndex: 0, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, foregroundColor: { red: 0.7, green: 0.1, blue: 0.1 } },
            backgroundColor: { red: 0.98, green: 0.93, blue: 0.93 }
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor)"
      }
    },
    // Column Widths
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 240 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 150 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 }, properties: { pixelSize: 130 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 140 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 }, properties: { pixelSize: 140 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: 110 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 6, endIndex: 7 }, properties: { pixelSize: 160 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 7, endIndex: 8 }, properties: { pixelSize: 180 }, fields: "pixelSize" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 8, endIndex: 9 }, properties: { pixelSize: 100 }, fields: "pixelSize" } }
  ];

  try {
    await batchUpdateSpreadsheet(spreadsheetId, styleRequests);
  } catch (fmtErr) {
    console.warn("[Styling Note] Partial formatting applied on Defect Index Sheet:", fmtErr?.message || fmtErr);
  }
}

// Generate Google Docs Compliance Letter via REST API
async function createComplianceLetterGoogleDoc_(project, weekStr, sheetUrl, cycle) {
  const survey = cycle.survey || {};
  const piu = survey.piuName || project.piu || "";
  const projectName = survey.projectName || project.name || "";
  const surveyDate = cycle.surveyDate || survey.surveyEndDate || "";

  const cleanPart = val => cleanEngineStr_(val).replace(/[\\/:*?"<>|#%{}~&]/g, "-").substring(0, 100);
  const docTitle = `${cleanPart(project.upc)} - ${cleanPart(weekStr)} - ${cleanPart(projectName)} - Compliance Letter`;

  // Check cached docId
  const storageKey = `DOC_LETTER_${cleanEngineStr_(project.upc).toUpperCase().replace(/[^A-Z0-9_-]/g, "_")}_W${String(weekStr).replace(/\D/g, "")}`;
  const stored = await chrome.storage.local.get([storageKey]);
  let docId = stored[storageKey];

  if (!docId) {
    // Copy Template via Drive API
    const copiedFile = await driveApiFetch(`files/${DEFECT_CFG.LETTER_TEMPLATE_ID}/copy`, {
      method: 'POST',
      body: JSON.stringify({ name: docTitle })
    });
    docId = copiedFile.id;
    await chrome.storage.local.set({ [storageKey]: docId });
  }

  // Replacements Map
  const replacements = {
    "{{LETTER_REFERENCE}}": DEFECT_CFG.LETTER_REFERENCE,
    "{{LETTER_DATE}}": formatDateCustom_(new Date()),
    "{{PIU_NAME}}": piu,
    "{{PIU_ADDRESS}}": getEnginePiuAddress_(piu),
    "{{PROJECT_NAME}}": projectName,
    "{{SURVEY_DATE}}": surveyDate,
    "{{NH_NUMBER}}": survey.nhNumber || "",
    "{{UPC_CODE}}": survey.upcCode || project.upc || "",
    "{{STATE_NAME}}": survey.stateName || "",
    "{{RO_NAME}}": survey.roName || "",
    "{{SURVEY_ID}}": survey.surveyId || "",
    "{{SURVEY_CYCLE}}": survey.surveyCycle || weekStr,
    "{{SURVEY_START_DATE}}": survey.surveyStartDate || "",
    "{{SURVEY_END_DATE}}": survey.surveyEndDate || "",
    "{{AE_IE_SC_NAME}}": survey.aeIeScName || "",
    "{{CONTRACTOR_NAME}}": survey.contractorName || "",
    "{{DAS_AGENCY}}": survey.dasAgency || "",
    "{{SIGNATORY_NAME}}": DEFECT_CFG.SIGNATORY_NAME,
    "{{SIGNATORY_DESIGNATION}}": DEFECT_CFG.SIGNATORY_DESIGNATION,
    "{{REGIONAL_OFFICE}}": survey.roName || DEFECT_CFG.REGIONAL_OFFICE,
    "{{SUMMARY_SHEET_URL}}": sheetUrl
  };

  const requests = Object.entries(replacements).map(([placeholder, textVal]) => ({
    replaceAllText: {
      containsText: {
        text: placeholder,
        matchCase: true
      },
      replaceText: String(textVal || "")
    }
  }));

  // Batch update Docs content
  await docsApiFetch(`documents/${docId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests })
  });

  return `https://docs.google.com/document/d/${docId}/edit`;
}

// Global exposure for Extension UI & Letter Generator
if (typeof window !== 'undefined') {
  window.DEFECT_PIU_ADDRESS_MAP = DEFECT_PIU_ADDRESS_MAP;
  window.DEFECT_CFG = DEFECT_CFG;
  window.DEFECT_STANDARD_LIST = DEFECT_STANDARD_LIST;
  window.getEnginePiuAddress_ = getEnginePiuAddress_;
}
