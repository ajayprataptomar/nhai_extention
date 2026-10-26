/**
 * Location Verification Engine for NHAI Defect Validation
 * 1:1 Port of LocationVerification.gs from Google Apps Script to Chrome Extension (Google Sheets API v4)
 */

async function getLocationVerificationData(spreadsheetId, sheetName = 'Defects Log') {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName);
  if (sheetId === null) throw new Error(`Sheet '${sheetName}' not found.`);

  const headerGrid = await getValues(spreadsheetId, `'${sheetName}'!1:10`);
  if (!headerGrid || headerGrid.length === 0) return { items: [], summary: {} };

  let headerRow = 0;
  for (let r = 0; r < headerGrid.length; r++) {
    const rowStr = headerGrid[r].map(v => String(v || '').toUpperCase().replace(/[\s%\u00A0\r\n\t]/g, ''));
    const hasID = rowStr.some(h => /^DEFECTID(#|NO\.?|NUMBER|CODE)?$/.test(h));
    const hasType = rowStr.some(h => /^DEFECTTYPE(NAME|CATEGORY|CODE)?$/.test(h));
    if (hasID && hasType) {
      headerRow = r + 1;
      break;
    }
  }

  if (!headerRow) throw new Error("Header row containing 'Defect ID' and 'Defect Type' not found.");

  const headers = (await getValues(spreadsheetId, `'${sheetName}'!${headerRow}:${headerRow}`))[0] || [];

  const findCol = (patterns) => findHeaderColumn_(headers, patterns);

  const colSNo = findCol(['S. No.', 'S.No.', 'S No', 'SNO', 'SL.NO']) || 1;
  const colID = findCol([/^DEFECTID(#|NO\.?|NUMBER|CODE)?$/]) || 2;
  const colCategory = findCol(['Category', 'Defect Category']) || 3;
  const colType = findCol([/^DEFECTTYPE(NAME|CATEGORY|CODE)?$/]) || 4;
  const colRoadType = findCol(['MCW/SR/IR', 'Road Type', 'RoadType', 'MCW / SR / IR']) || 5;
  const colDirection = findCol(['LHS/RHS', 'Direction', 'Side', 'LHS / RHS']) || 6;
  const colLane = findCol(['Lane', 'Lane No', 'Lane Number']) || 7;

  const colStartLat = findCol(['Start Latitude', 'Latitude', 'Start Lat', 'Start_Lat', 'Lat']) || 9;
  const colStartLon = findCol(['Start Longitude', 'Longitude', 'Start Long', 'Start_Long', 'Long', 'Lng']) || 10;
  const colEndLat = findCol(['End Latitude', 'End Lat', 'End_Lat']);
  const colEndLon = findCol(['End Longitude', 'End Long', 'End_Long']);

  const colStartChainage = findCol(['Start Chainage', 'Start Km', 'Start chainage (Km)', 'Start Chainage (km)']) || 13;
  const colEndChainage = findCol(['End Chainage', 'End Km', 'End chainage (Km)', 'End Chainage (km)']) || 14;

  const colSeverity = findCol(['Severity Level', 'Severity']) || 15;
  const colLocationCorrect = findCol(['Location Correct?', 'Location Correct', 'Location Verified']);
  const colImage = findCol(['Defect image name', 'Image Name', 'Image', 'Defect Image Name']) || 18;
  const colSelect = findCol([
    'Selected for Precision Validation',
    'Selected for Precision',
    'Selected',
    /^SELECTEDFORPRECISION/
  ]);

  if (!colSelect) {
    throw new Error("Column 'Selected for Precision Validation' not found. Please run '1. Select Precision Sample' first.");
  }

  const maxCol = Math.max(
    colSNo, colID, colCategory, colType, colRoadType, colDirection, colLane,
    colStartLat, colStartLon, colEndLat || 0, colEndLon || 0,
    colStartChainage, colEndChainage || 0, colSeverity, colLocationCorrect || 0, colImage,
    colSelect, headers.length
  );

  const allRows = await getValues(spreadsheetId, `'${sheetName}'!A${headerRow + 1}:${columnLetter_(maxCol)}`);
  if (!allRows || allRows.length === 0) return { items: [], summary: {} };

  // Fetch link info for images
  const linkInfos = colImage > 0
    ? await getColumnLinkInfo(spreadsheetId, sheetId, sheetName, colImage - 1, headerRow + 1, allRows.length)
    : [];

  const items = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const selectVal = colSelect > 0 ? String(row[colSelect - 1] || '').trim().toUpperCase() : '';
    if (selectVal !== 'YES') continue;

    const sheetRow = headerRow + 1 + i;
    const defectId = colID > 0 ? String(row[colID - 1] || '').trim() : '';
    if (!defectId) continue;

    const sNo = colSNo > 0 ? (row[colSNo - 1] || (i + 1)) : (i + 1);
    const category = colCategory > 0 ? String(row[colCategory - 1] || 'General').trim() : 'General';
    const defectType = colType > 0 ? String(row[colType - 1] || 'Road Defect').trim() : 'Road Defect';
    const roadType = colRoadType > 0 ? String(row[colRoadType - 1] || 'MCW').trim().toUpperCase() : 'MCW';
    const direction = colDirection > 0 ? String(row[colDirection - 1] || 'LHS').trim().toUpperCase() : 'LHS';
    const lane = colLane > 0 ? String(row[colLane - 1] || 'Lane 1').trim() : 'Lane 1';

    const startLat = colStartLat > 0 ? parseFloat(String(row[colStartLat - 1]).replace(/[^0-9.-]/g, '')) : NaN;
    const startLon = colStartLon > 0 ? parseFloat(String(row[colStartLon - 1]).replace(/[^0-9.-]/g, '')) : NaN;
    const endLat = colEndLat > 0 ? parseFloat(String(row[colEndLat - 1]).replace(/[^0-9.-]/g, '')) : NaN;
    const endLon = colEndLon > 0 ? parseFloat(String(row[colEndLon - 1]).replace(/[^0-9.-]/g, '')) : NaN;

    const parsedStartCh = colStartChainage > 0 ? parseChainageValue_(row[colStartChainage - 1]) : { raw: '—', km: 0, meters: 0 };
    const parsedEndCh = colEndChainage > 0 ? parseChainageValue_(row[colEndChainage - 1]) : { raw: '—', km: 0, meters: 0 };

    const severity = colSeverity > 0 && row[colSeverity - 1] ? String(row[colSeverity - 1]).trim() : 'Medium';

    const rawLoc = colLocationCorrect > 0 ? String(row[colLocationCorrect - 1] || '').trim().toUpperCase() : '';
    const locationCorrect = rawLoc === 'YES' ? 'Yes' : (rawLoc === 'NO' ? 'No' : '');

    let imageUrl = '';
    if (colImage > 0 && linkInfos[i]) {
      imageUrl = extractUrlFast_(linkInfos[i]);
    }

    const gmapsUrl = (!isNaN(startLat) && !isNaN(startLon))
      ? `https://www.google.com/maps/search/?api=1&query=${startLat},${startLon}`
      : '';

    const hasValidCoords = (!isNaN(startLat) && !isNaN(startLon) && startLat !== 0 && startLon !== 0);

    items.push({
      sheetRow: sheetRow,
      sNo: sNo,
      defectId: defectId,
      defectType: defectType,
      category: category,
      roadType: roadType || 'MCW',
      direction: direction,
      lane: lane,
      startLat: hasValidCoords ? startLat : null,
      startLon: hasValidCoords ? startLon : null,
      endLat: (!isNaN(endLat) && endLat !== 0) ? endLat : null,
      endLon: (!isNaN(endLon) && endLon !== 0) ? endLon : null,
      isLength: (hasValidCoords && !isNaN(endLat) && !isNaN(endLon) && endLat !== 0 && (startLat !== endLat || startLon !== endLon)),
      startChainage: parsedStartCh.km,
      startChainageRaw: parsedStartCh.raw,
      endChainage: parsedEndCh.km,
      endChainageRaw: parsedEndCh.raw,
      chainageMeters: parsedStartCh.meters,
      severity: severity,
      locationCorrect: locationCorrect,
      imageUrl: imageUrl,
      gmapsUrl: gmapsUrl,
      suspStatus: 'Normal',
      suspReason: 'Coordinates consistent with highway corridor.'
    });
  }

  evaluateSuspicionHeuristics_(items);

  const summary = {
    total: items.length,
    mcw: items.filter(d => !d.roadType.includes('SR') && !d.roadType.includes('IR')).length,
    sr: items.filter(d => d.roadType.includes('SR') || d.roadType.includes('SERVICE')).length,
    ir: items.filter(d => d.roadType.includes('IR') || d.roadType.includes('INTERCHANGE')).length,
    lhs: items.filter(d => d.direction === 'LHS').length,
    rhs: items.filter(d => d.direction === 'RHS').length,
    high: items.filter(d => d.severity.toUpperCase().includes('HIGH')).length,
    medium: items.filter(d => d.severity.toUpperCase().includes('MED')).length,
    low: items.filter(d => d.severity.toUpperCase().includes('LOW')).length,
    normal: items.filter(d => d.suspStatus === 'Normal').length,
    review: items.filter(d => d.suspStatus === 'Review').length,
    suspicious: items.filter(d => d.suspStatus === 'Suspicious').length
  };

  return { items, summary };
}

function evaluateSuspicionHeuristics_(items) {
  const validChainageItems = items
    .filter(d => d.startLat && d.startLon && d.chainageMeters > 0)
    .sort((a, b) => a.chainageMeters - b.chainageMeters);

  items.forEach(d => {
    if (!d.startLat || !d.startLon) {
      d.suspStatus = 'Suspicious';
      d.suspReason = 'GPS coordinates are missing or zero.';
      return;
    }

    if (d.startLat < 6 || d.startLat > 38 || d.startLon < 68 || d.startLon > 98) {
      d.suspStatus = 'Suspicious';
      d.suspReason = 'GPS point is outside regional boundary.';
      return;
    }

    if (d.isLength && d.endLat && d.endLon) {
      const geoDistKm = getHaversineDistanceKm_(d.startLat, d.startLon, d.endLat, d.endLon);
      const chainageSpanKm = Math.abs(d.endChainage - d.startChainage);

      if (geoDistKm > 3.0 && chainageSpanKm < 0.5) {
        d.suspStatus = 'Review';
        d.suspReason = 'GPS segment distance (>3km) contradicts chainage span.';
        return;
      }
    }

    if (validChainageItems.length > 2 && d.chainageMeters > 0) {
      const idx = validChainageItems.findIndex(v => v.sheetRow === d.sheetRow);
      if (idx > 0) {
        const prev = validChainageItems[idx - 1];
        const chainageDeltaKm = Math.abs(d.chainageMeters - prev.chainageMeters) / 1000;
        const geoDistKm = getHaversineDistanceKm_(d.startLat, d.startLon, prev.startLat, prev.startLon);

        if (chainageDeltaKm < 0.3 && geoDistKm > 2.5) {
          d.suspStatus = 'Review';
          d.suspReason = 'GPS jump detected relative to sequential chainage.';
          return;
        }
      }
    }

    if (d.roadType.includes('SR') || d.roadType.includes('SERVICE')) {
      d.suspStatus = 'Review';
      d.suspReason = 'Service Road (SR): Verify point alignment with side corridor.';
    } else if (d.roadType.includes('IR') || d.roadType.includes('INTERCHANGE')) {
      d.suspStatus = 'Review';
      d.suspReason = 'Interchange (IR): Verify ramp or junction context.';
    } else {
      d.suspStatus = 'Normal';
      d.suspReason = 'Coordinates consistent with MCW sequence.';
    }
  });
}

async function updateLocationCorrectness(spreadsheetId, sheetRow, value, sheetName = 'Defects Log') {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName);
  if (sheetId === null) throw new Error(`Sheet '${sheetName}' not found.`);

  const info = await getSheetInfo(spreadsheetId, sheetName);
  const { headerRow } = info;
  let headers = [...info.headers];

  let col = findHeaderColumn_(headers, ['Location Correct?', 'Location Correct']);
  if (col === 0) {
    col = await ensureHeaderColumn(spreadsheetId, sheetId, sheetName, headerRow, headers, 'Location Correct?');
  }

  // Strict Title Case ('Yes' / 'No')
  const validDecision = String(value || '').trim().toUpperCase() === 'YES' ? 'Yes' : 'No';
  const cellRange = `'${sheetName}'!${columnLetter_(col)}${sheetRow}`;
  await updateValues(spreadsheetId, cellRange, [[validDecision]]);

  return { success: true, sheetRow, decision: validDecision };
}
