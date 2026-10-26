/**
 * Validation Review Engine for NHAI Defect Validation
 * 1:1 Port of ValidationReview.gs from Google Apps Script to Chrome Extension (Google Sheets API v4)
 */

let _reviewColCache = null;

async function getValidationReviewData(spreadsheetId, sheetName = 'Defects Log') {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName);
  if (sheetId === null) throw new Error(`Sheet '${sheetName}' not found.`);

  const info = await getSheetInfo(spreadsheetId, sheetName);
  const { headerRow } = info;
  const headers = info.headers;

  const findCol = (patterns) => findHeaderColumn_(headers, patterns);

  const colSNo = findCol(['S. No.', 'S.No.', 'S No', 'SNO', 'SL.NO']) || 1;
  const colID = findCol([/^DEFECTID(#|NO\.?|NUMBER|CODE)?$/]) || 2;
  const colCategory = findCol(['Category', 'Defect Category']) || 3;
  const colType = findCol([/^DEFECTTYPE(NAME|CATEGORY|CODE)?$/]) || 4;
  const colRoadType = findCol(['MCW/SR/IR', 'Road Type', 'RoadType', 'MCW / SR / IR']) || 5;
  const colDirection = findCol(['LHS/RHS', 'Direction', 'Side', 'LHS / RHS']) || 6;
  const colLane = findCol(['Lane', 'Lane No', 'Lane Number']) || 7;
  const colStartChainage = findCol(['Start Chainage', 'Start Km', 'Start chainage (Km)', 'Start Chainage (km)']) || 13;
  const colEndChainage = findCol(['End Chainage', 'End Km', 'End chainage (Km)', 'End Chainage (km)']) || 14;
  const colSeverity = findCol(['Severity Level', 'Severity']) || 15;
  const colImage = findCol(['Defect image name', 'Image Name', 'Image', 'Defect Image Name']) || 18;
  const colSelect = findCol(['Selected for Precision Validation', 'Selected for Precision', 'Selected']);

  if (!colSelect) {
    throw new Error("Column 'Selected for Precision Validation' not found. Please run '1. Select Precision Sample' first.");
  }

  // Proactively ensure all 12 Precision & Recall tracking columns exist in sheet
  const ALL_PRECISION_RECALL_COLUMNS = [
    'Selected for Precision Validation',
    'Visible ?',
    'Defect Type Correct ?',
    'Location',
    'Location Correct?',
    'Final Detection Judgement',
    'Defects reported By Vendor',
    'Defects Additional Found',
    'Name of Additional Defect Found',
    'Identified in Report',
    'Name of Identified defects in Frame',
    'Frame Ref.(S No.)',
    '__AUTO_Recall_Reviewed'
  ];
  await ensureHeaderColumns(spreadsheetId, sheetId, sheetName, headerRow, headers, ALL_PRECISION_RECALL_COLUMNS);

  // Refresh column indexes after ensuring headers
  const colStartLat = findCol(['Start Latitude', 'Latitude', 'Start Lat', 'Start_Lat', 'Lat']) || 9;
  const colStartLon = findCol(['Start Longitude', 'Longitude', 'Start Long', 'Start_Long', 'Long', 'Lng']) || 10;
  const colEndLat = findCol(['End Latitude', 'End Lat', 'End_Lat']);
  const colEndLon = findCol(['End Longitude', 'End Long', 'End_Long']);
  const colLocation = findCol(['Location', 'Location Formula']);
  const colVisible = findCol(['Visible ?', 'Visible?']);
  const colTypeCorrect = findCol(['Defect Type Correct ?', 'Defect Type Correct?']);
  const colLocCorrect = findCol(['Location Correct?', 'Location Correct']);
  const colFinalDetection = findCol(['Final Detection', 'Final Detection Judgement', 'Final Ground Truth', /^FINAL\s*DETECTION/i]);
  const colReported = findCol(['Defects reported By Vendor', 'Defects Reported By Vendor']);
  const colAddCount = findCol(['Defects Additional Found']);
  const colAddNames = findCol(['Name of Additional Defect Found']);
  const colIdentCount = findCol(['Identified in Report']);
  const colIdentNames = findCol(['Name of Identified defects in Frame', 'Name of Identified Defects in Frame']);
  const colFrameRef = findCol(['Frame Ref.(S No.)', 'Frame Ref.(S.No.)', 'Frame Ref (S No)', 'Frame Ref', 'Frame Ref.']);
  const colAutoRecallRev = findCol(['__AUTO_Recall_Reviewed']);

  if (colAutoRecallRev > 0) {
    hideColumns(spreadsheetId, sheetId, colAutoRecallRev - 1, colAutoRecallRev).catch(() => {});
  }

  // Cache resolved column positions to eliminate Read requests on every single row save
  _reviewColCache = {
    spreadsheetId,
    sheetName,
    sheetId,
    headerRow,
    colVisible,
    colTypeCorrect,
    colLocCorrect,
    colFinalDetection,
    colReported,
    colAddCount,
    colAddNames,
    colIdentCount,
    colIdentNames,
    colFrameRef,
    colAutoRecallRev
  };

  const maxCol = Math.max(
    colSNo, colID, colCategory, colType, colRoadType, colDirection, colLane,
    colStartLat || 0, colStartLon || 0, colEndLat || 0, colEndLon || 0,
    colStartChainage, colEndChainage || 0, colSeverity, colImage,
    colSelect, colVisible || 0, colTypeCorrect || 0, colLocCorrect || 0,
    colLocation || 0, colFinalDetection || 0, colReported || 0, colAddCount || 0,
    colAddNames || 0, colIdentCount || 0, colIdentNames || 0, colFrameRef || 0,
    colAutoRecallRev || 0,
    headers.length
  );

  const allRows = await getValues(spreadsheetId, `'${sheetName}'!A${headerRow + 1}:${columnLetter_(maxCol)}`);
  if (!allRows || allRows.length === 0) {
    return { items: [], issuesList: [], urlMap: {}, progress: { total: 0, reviewed: 0, pending: 0 } };
  }

  const linkInfos = colImage > 0
    ? await getColumnLinkInfo(spreadsheetId, sheetId, sheetName, colImage - 1, headerRow + 1, allRows.length)
    : [];

  const items = [];
  const allUniqueIssues = new Set();
  const urlMap = {};

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const sheetRow = headerRow + 1 + i;

    const isSelected = String(row[colSelect - 1] || '').trim().toUpperCase() === 'YES';
    if (!isSelected) continue;

    const sNo = colSNo > 0 ? (row[colSNo - 1] || (i + 1)) : (i + 1);
    const defectId = colID > 0 ? String(row[colID - 1] || '').trim() : '';
    const category = colCategory > 0 ? String(row[colCategory - 1] || 'General').trim() : 'General';
    const defectType = colType > 0 ? String(row[colType - 1] || 'Road Defect').trim() : 'Road Defect';
    const roadType = colRoadType > 0 ? String(row[colRoadType - 1] || 'MCW').trim() : 'MCW';
    const direction = colDirection > 0 ? String(row[colDirection - 1] || 'LHS').trim() : 'LHS';
    const lane = colLane > 0 ? String(row[colLane - 1] || 'Lane 1').trim() : 'Lane 1';
    const startCh = colStartChainage > 0 ? String(row[colStartChainage - 1] || '—').trim() : '—';
    const endCh = colEndChainage > 0 ? String(row[colEndChainage - 1] || '—').trim() : '—';
    const severity = colSeverity > 0 ? String(row[colSeverity - 1] || 'Medium').trim() : 'Medium';

    const startLat = colStartLat > 0 ? (parseFloat(row[colStartLat - 1]) || 0) : 0;
    const startLon = colStartLon > 0 ? (parseFloat(row[colStartLon - 1]) || 0) : 0;
    const endLat = colEndLat > 0 ? (parseFloat(row[colEndLat - 1]) || 0) : 0;
    const endLon = colEndLon > 0 ? (parseFloat(row[colEndLon - 1]) || 0) : 0;
    let locationStr = colLocation > 0 ? String(row[colLocation - 1] || '').trim() : '';
    if (!locationStr && startLat && startLon) {
      locationStr = `${startLat.toFixed(5)}, ${startLon.toFixed(5)}`;
    }

    if (defectType) allUniqueIssues.add(defectType);

    let viewerUrl = '';
    if (colImage > 0 && linkInfos[i]) {
      viewerUrl = extractUrlFast_(linkInfos[i]);
    }
    if (!viewerUrl && colImage > 0 && row[colImage - 1]) {
      const cellVal = String(row[colImage - 1] || '');
      const match = cellVal.match(/https?:\/\/[^\s"]+\/viewer[^\s"]*/i);
      if (match) viewerUrl = match[0];
    }
    if (viewerUrl) {
      urlMap[sheetRow] = viewerUrl;
      urlMap[sNo] = viewerUrl;
      urlMap[String(sNo)] = viewerUrl;
    }

    const rawVis = colVisible > 0 ? String(row[colVisible - 1] || '').trim().toUpperCase() : '';
    const rawType = colTypeCorrect > 0 ? String(row[colTypeCorrect - 1] || '').trim().toUpperCase() : '';
    const rawLoc = colLocCorrect > 0 ? String(row[colLocCorrect - 1] || '').trim().toUpperCase() : '';

    const visibleVal = rawVis === 'YES' ? 'Yes' : (rawVis === 'NO' ? 'No' : '');
    const typeCorrectVal = rawType === 'YES' ? 'Yes' : (rawType === 'NO' ? 'No' : '');
    const locCorrectVal = rawLoc === 'YES' ? 'Yes' : (rawLoc === 'NO' ? 'No' : '');
    const finalDetectionVal = colFinalDetection > 0 ? String(row[colFinalDetection - 1] || '').trim() : '';

    const isPrecisionReviewed = (visibleVal !== '' && typeCorrectVal !== '' && locCorrectVal !== '');

    const reportedCountVal = colReported > 0 ? (parseInt(row[colReported - 1], 10) || 0) : 0;
    const rawAddCount = colAddCount > 0 ? String(row[colAddCount - 1] || '').trim() : '';
    const addCountVal = colAddCount > 0 ? (parseInt(row[colAddCount - 1], 10) || 0) : 0;
    const addNamesVal = colAddNames > 0 ? String(row[colAddNames - 1] || '').trim() : '';
    const identCountVal = colIdentCount > 0 ? (parseInt(row[colIdentCount - 1], 10) || 0) : 0;
    const identNamesVal = colIdentNames > 0 ? String(row[colIdentNames - 1] || '').trim() : '';
    const frameRefVal = colFrameRef > 0 ? String(row[colFrameRef - 1] || '').trim() : '';

    const linkedIdentifiedRefs = parseSequentialFrameRefs_(identNamesVal, frameRefVal);
    
    // Recall is considered reviewed if the auditor has reviewed and saved it (persisted in __AUTO_Recall_Reviewed helper column)
    const rawRecallRev = colAutoRecallRev > 0 ? String(row[colAutoRecallRev - 1] || '').trim().toUpperCase() : '';
    const isRecallReviewed = (rawRecallRev === 'YES');
    const isFullyReviewed = (isPrecisionReviewed && isRecallReviewed);

    items.push({
      sheetRow,
      sNo,
      defectId,
      defectType,
      category,
      roadType,
      direction,
      lane,
      chainage: `${startCh} - ${endCh}`,
      startLat,
      startLon,
      endLat,
      endLon,
      locationStr,
      severity,
      viewerUrl,
      visible: visibleVal || 'Yes',
      typeCorrect: typeCorrectVal || 'Yes',
      locCorrect: locCorrectVal || 'Yes',
      rawVisible: visibleVal,
      rawTypeCorrect: typeCorrectVal,
      rawLocCorrect: locCorrectVal,
      finalDetection: finalDetectionVal,
      isPrecisionReviewed,
      isRecallReviewed,
      isFullyReviewed,
      reportedCount: reportedCountVal,
      additionalCount: addCountVal,
      additionalNames: addNamesVal,
      identCount: identCountVal,
      identNames: identNamesVal,
      frameRef: frameRefVal,
      linkedIdentifiedRefs
    });
  }

  // Collect all unique defect types present in the entire Defects Log sheet
  const sheetDefectTypes = new Set();
  for (let i = 0; i < allRows.length; i++) {
    const dt = colType > 0 ? String(allRows[i][colType - 1] || '').trim() : '';
    if (dt) sheetDefectTypes.add(dt);
  }

  // Complete Standard 52 Defect Taxonomy from "Defect Definitions with Nomenclature.xlsx" (Final Nomenclature column)
  const standardNHAI52Taxonomy = [
    'Pavement _Pothole',
    'Pavement _Cracking',
    'Pavement_Alligator Cracking',
    'Pavement _Rutting',
    'Shoulders_Rain Cuts',
    'Shoulders_Edge Drop',
    'Shoulders_Unevenness',
    'Shoulders_Vegetation Growth',
    'Kerb_Damaged',
    'Kerb_Faded Painting',
    'Plantation_Excessive Plantation/ Vegetation/Reduced Visibility',
    'Plantation_Missing / Irregular Gap',
    'Plantation_Damaged/Dead Plants',
    'Drainage_Damaged Cover Slab',
    'Drainage_Missing Cover Slab',
    'Drainage_Water Stagnation',
    'Footpath_Damaged',
    'CC Barrier_Damaged',
    'CC Barrier_Faded Painting',
    'MBCB_Damaged',
    'Guard Rails _Damaged',
    'Guard Rails_Faded Painting',
    'Signboards_Damaged',
    'Signboards_Non Visible',
    'Overhead Sign Structures_Damaged',
    'Overhead Sign Structures _Non Visible',
    'Solar Blinkers _Damaged',
    'Solar Blinkers_Non Operational',
    'Attenuators_Damaged',
    'Delineators _Damaged',
    'Anti Glare_Damaged',
    'Road Studs_Damaged',
    'Road Studs_Non Visible',
    'Rumble Strips_Damaged',
    'Rumble Strips_Non Visible',
    'Hazard Markers_Damaged',
    'Hazard Markers_Non Visible',
    'Pavement Marking_Faded/Non Visible',
    'Bus Bay_Damaged Shelter',
    'Bus Bay_Faded Marking',
    'Truck Lay Bye _Damaged',
    'Truck Lay Bye _Faded Marking',
    'Highway Lighting _Damaged',
    'Highway Lighting _Non Functional',
    'Highway Lighting _Missing',
    'Work Zone Safety_Missing/ Inapproprite',
    'Encroachment _Unauthorized Median Opening',
    'Encroachment _Unauthorized Signboards/Hoardings',
    'Encroachment _Unauthorized Construction',
    'Encroachment_Illegal Parking',
    'Cleanliness _Garbage/Debris/Others clealiness issues',
    'Missing_(Assets Name)'
  ];

  // Authoritative standard 52 taxonomy from "Defect Definitions with Nomenclature.xlsx"
  // This ensures all additional defects added during review strictly follow the standard nomenclature.
  const finalTaxonomy = [...standardNHAI52Taxonomy];
  const seenNormalized = new Set(standardNHAI52Taxonomy.map(s => normalizeDefectType_(s)));

  // If the sheet contains any custom/novel defect not covered by the standard 52, append it
  sheetDefectTypes.forEach(t => {
    const norm = normalizeDefectType_(t);
    if (norm && !seenNormalized.has(norm)) {
      seenNormalized.add(norm);
      finalTaxonomy.push(t);
    }
  });

  finalTaxonomy.sort((a, b) => a.localeCompare(b));

  const total = items.length;
  const reviewed = items.filter(i => i.isPrecisionReviewed).length;
  const pending = total - reviewed;

  const sNoToRowMap = {};
  for (let i = 0; i < allRows.length; i++) {
    const sNo = colSNo > 0 ? (allRows[i][colSNo - 1] || (i + 1)) : (i + 1);
    sNoToRowMap[String(sNo).trim()] = headerRow + 1 + i;
  }

  return {
    items,
    issuesList: finalTaxonomy,
    urlMap,
    sNoToRowMap,
    meta: {
      headerRow,
      colImage,
      sheetId
    },
    progress: { total, reviewed, pending }
  };
}

function parseSequentialFrameRefs_(identNamesStr, frameRefStr) {
  const result = {};
  if (!identNamesStr || !frameRefStr) return result;

  const rawRefs = frameRefStr.split(',').map(s => s.trim()).filter(Boolean);
  const regex = /([^,]+?)\s*\(\s*(\d+)\s*\)/g;
  let match;
  let refIdx = 0;

  while ((match = regex.exec(identNamesStr)) !== null) {
    const rawName = match[1].trim();
    const name = toStandardDefectName_(rawName);
    const count = parseInt(match[2], 10) || 0;
    if (!result[name]) result[name] = [];

    for (let k = 0; k < count; k++) {
      if (refIdx < rawRefs.length) {
        result[name].push(rawRefs[refIdx]);
        refIdx++;
      }
    }
  }
  return result;
}

async function fetchNativeViewerHTML(viewerUrl) {
  if (!viewerUrl) return { success: false, error: 'No URL provided' };

  let html = '';
  try {
    const response = await fetch(viewerUrl, { redirect: 'follow' });
    if (response.ok) {
      html = await response.text();
    }
  } catch (e) {
    // Direct fetch blocked by CORS / Mixed Content - Try background proxy
  }

  let resolvedUrl = viewerUrl;
  if (!html && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_VIEWER_HTML', url: viewerUrl }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, error: 'Empty background response' });
          }
        });
      });
      if (res.success && res.html) {
        html = res.html;
        if (res.finalUrl) resolvedUrl = res.finalUrl;
      }
    } catch (err) {}
  }

  if (!html) {
    return { success: false, error: 'Failed to fetch native viewer HTML' };
  }

  // Set base href to the viewer directory path so relative assets resolve properly
  const cleanUrl = (resolvedUrl || viewerUrl).split('?')[0].split('#')[0];
  const baseDir = cleanUrl.endsWith('/') ? cleanUrl : cleanUrl.substring(0, cleanUrl.lastIndexOf('/') + 1);

  if (baseDir) {
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head><base href="${baseDir}">`);
    } else {
      html = `<base href="${baseDir}">` + html;
    }
  }

  return {
    success: true,
    htmlContent: html,
    viewerUrl
  };
}

async function saveValidationReview(spreadsheetId, payload, sheetName = 'Defects Log') {
  let cols = _reviewColCache;
  if (!cols || cols.spreadsheetId !== spreadsheetId || cols.sheetName !== sheetName) {
    const sheetId = await getSheetIdByName(spreadsheetId, sheetName);
    if (sheetId === null) throw new Error(`Sheet '${sheetName}' not found.`);

    const info = await getSheetInfo(spreadsheetId, sheetName);
    const { headerRow } = info;
    const headers = [...info.headers];
    const findCol = (patterns) => findHeaderColumn_(headers, patterns);

    cols = {
      spreadsheetId,
      sheetName,
      sheetId,
      headerRow,
      colVisible: findCol(['Visible ?', 'Visible?']),
      colTypeCorrect: findCol(['Defect Type Correct ?', 'Defect Type Correct?']),
      colLocCorrect: findCol(['Location Correct?', 'Location Correct']),
      colFinalDetection: findCol(['Final Detection', 'Final Detection Judgement', 'Final Ground Truth', /^FINAL\s*DETECTION/i]),
      colReported: findCol(['Defects reported By Vendor', 'Defects Reported By Vendor']),
      colAddCount: findCol(['Defects Additional Found']),
      colAddNames: findCol(['Name of Additional Defect Found']),
      colIdentCount: findCol(['Identified in Report']),
      colIdentNames: findCol(['Name of Identified defects in Frame', 'Name of Identified Defects in Frame']),
      colFrameRef: findCol(['Frame Ref.(S No.)', 'Frame Ref.(S.No.)', 'Frame Ref (S No)', 'Frame Ref', 'Frame Ref.']),
      colAutoRecallRev: findCol(['__AUTO_Recall_Reviewed'])
    };
    _reviewColCache = cols;
  }

  const {
    colVisible,
    colTypeCorrect,
    colLocCorrect,
    colFinalDetection,
    colReported,
    colAddCount,
    colAddNames,
    colIdentCount,
    colIdentNames,
    colFrameRef,
    colAutoRecallRev
  } = cols;

  const row = payload.sheetRow;
  const saveMode = payload.saveMode || 'ALL';

  const visible = String(payload.visible).trim().toUpperCase() === 'NO' ? 'No' : 'Yes';
  const typeCorrect = String(payload.typeCorrect).trim().toUpperCase() === 'NO' ? 'No' : 'Yes';
  const locCorrect = String(payload.locCorrect).trim().toUpperCase() === 'NO' ? 'No' : 'Yes';

  const isAllYes = (visible === 'Yes' && typeCorrect === 'Yes' && locCorrect === 'Yes');
  const finalDetectionText = isAllYes ? 'Correct' : 'Incorrect';

  const batchUpdates = [];

  // Precision updates: only executed in 'PRECISION' or 'ALL' mode
  if (saveMode === 'PRECISION' || saveMode === 'ALL') {
    if (colVisible > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colVisible)}${row}`, values: [[visible]] });
    }
    if (colTypeCorrect > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colTypeCorrect)}${row}`, values: [[typeCorrect]] });
    }
    if (colLocCorrect > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colLocCorrect)}${row}`, values: [[locCorrect]] });
    }
    if (colFinalDetection > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colFinalDetection)}${row}`, values: [[finalDetectionText]] });
    }
    if (colReported > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colReported)}${row}`, values: [[isAllYes ? 1 : 0]] });
    }
  }

  // Recall updates: only executed in 'RECALL' or 'ALL' mode
  if (saveMode === 'RECALL' || saveMode === 'ALL') {
    // Auditor scope (Additional defects count and names)
    if (colAddCount > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colAddCount)}${row}`, values: [[parseInt(payload.additionalCount, 10) || 0]] });
    }
    if (colAddNames > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colAddNames)}${row}`, values: [[String(payload.additionalNames || '').trim()]] });
    }

    // Vendor identified & mapped frame refs
    if (payload.updatedIdentCount !== undefined && colIdentCount > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colIdentCount)}${row}`, values: [[parseInt(payload.updatedIdentCount, 10) || 0]] });
    }
    if (payload.updatedIdentNames !== undefined && colIdentNames > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colIdentNames)}${row}`, values: [[String(payload.updatedIdentNames || '').trim()]] });
    }
    if (payload.updatedFrameRef !== undefined && colFrameRef > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colFrameRef)}${row}`, values: [[String(payload.updatedFrameRef || '').trim()]] });
    }

    // Persist Recall reviewed flag in hidden column
    if (colAutoRecallRev > 0) {
      batchUpdates.push({ range: `'${sheetName}'!${columnLetter_(colAutoRecallRev)}${row}`, values: [['Yes']] });
    }
  }

  if (batchUpdates.length > 0) {
    await batchUpdateValues(spreadsheetId, batchUpdates);
  }

  return {
    success: true,
    sheetRow: row,
    visible,
    typeCorrect,
    locCorrect,
    finalDetection: finalDetectionText,
    isPrecisionReviewed: true
  };
}
