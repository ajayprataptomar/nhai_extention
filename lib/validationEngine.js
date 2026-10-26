/**
 * Core Validation Engine for NHAI Defect Validation
 * Features:
 *   - Macro v3.2: Water-Fill Allocation (Cap-at-Common-Level + Bump-the-Largest)
 *   - Smart Exact-First Header Hunter
 *   - 5-Tier Quantile Binning across all quota sizes (including below 5)
 *   - Macro v3.2 Activity Log with Diagnostics block (Columns M:N)
 *   - Stage 2 Viewer Defect Analysis & Precision/Recall Summary Sheet
 */

let MAX_SAMPLE_SIZE = 100;
let TARGET_SAMPLE_SIZE = 100;


/* ============================================================================
   1. SELECT PRECISION SAMPLE - MACRO v3.2 WATER-FILL ALLOCATION
   ============================================================================ */

async function executePrecisionValidation(spreadsheetId, sheetName = 'Defects Log', onProgress = () => {}) {
  // Dynamically adopt Sample Quota configured in Cloud Admin Panel
  if (typeof getClusterConfig === 'function') {
    const dynSize = await getClusterConfig('sampleSize', 100);
    if (dynSize && parseInt(dynSize, 10) > 0) {
      MAX_SAMPLE_SIZE = parseInt(dynSize, 10);
      TARGET_SAMPLE_SIZE = parseInt(dynSize, 10);
    }
  }

  onProgress({ stage: 'init', message: 'Scanning sheet with Smart Exact-First Header Hunter...' });
  const info = await getSheetInfo(spreadsheetId, sheetName);
  const { sheetId, headerRow, colID, colType, colConf } = info;
  let headers = [...info.headers];

  // Ensure all 12 Precision & Recall tracking columns + 2 auto helper columns exist
  onProgress({ stage: 'columns', message: 'Verifying all 12 Precision & Recall tracking columns...' });
  const colLat = findHeaderColumn_(headers, ['Latitude', 'Start Latitude', 'Lat', 'Start Lat', 'Start_Lat']) || 9;
  const colLng = findHeaderColumn_(headers, ['Longitude', 'Start Longitude', 'Long', 'Start Long', 'Start_Long', 'Lng']) || 10;

  // Ordered list of all 14 precision/recall columns with their anchors.
  // Each column is inserted right after its anchor (the column appearing before it
  // in the Apps Script layout). This guarantees formula column-letter references
  // remain correct regardless of existing sheet layout.
  const ALL_PRECISION_RECALL_COLUMNS = [
    'Selected for Precision Validation',    // anchor: Last existing column (appended if missing)
    'Visible ?',                            // anchor: Selected for Precision Validation
    'Defect Type Correct ?',               // anchor: Visible ?
    'Location',                            // anchor: Defect Type Correct ?
    'Location Correct?',                   // anchor: Location
    'Final Detection Judgement',           // anchor: Location Correct?
    'Defects reported By Vendor',          // anchor: Final Detection Judgement
    'Defects Additional Found',            // anchor: Defects reported By Vendor
    'Name of Additional Defect Found',     // anchor: Defects Additional Found
    'Identified in Report',                // anchor: Name of Additional Defect Found
    'Name of Identified defects in Frame', // anchor: Identified in Report
    'Frame Ref.(S No.)',                   // anchor: Name of Identified defects in Frame
    '__AUTO_Name of Additional Defect Found',          // anchor: Frame Ref.(S No.) — hidden
    '__AUTO_Name of Identified defects in Frame',      // anchor: __AUTO_Name of Additional Defect Found — hidden
    '__AUTO_Recall_Reviewed'                           // anchor: __AUTO_Name of Identified defects in Frame — hidden
  ];
  const ALL_PRECISION_RECALL_ANCHORS = [
    null,                                          // Selected for Precision Validation — append at end if missing
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
    '__AUTO_Name of Additional Defect Found',
    '__AUTO_Name of Identified defects in Frame'
  ];

  const colMap = await ensureHeaderColumns(spreadsheetId, sheetId, sheetName, headerRow, headers, ALL_PRECISION_RECALL_COLUMNS, ALL_PRECISION_RECALL_ANCHORS);


  const colSelect = colMap['Selected for Precision Validation'];
  const colVisible = colMap['Visible ?'];
  const colTypeCorrect = colMap['Defect Type Correct ?'];
  const colLocation = colMap['Location'];
  const colLocationCorrect = colMap['Location Correct?'];
  const colFinalJudgement = colMap['Final Detection Judgement'];

  // Proactively hide internal tracking helper columns
  const autoAddCol = colMap['__AUTO_Name of Additional Defect Found'];
  const autoIdentCol = colMap['__AUTO_Name of Identified defects in Frame'];
  const autoRecallCol = colMap['__AUTO_Recall_Reviewed'];
  if (autoAddCol) await hideColumns(spreadsheetId, sheetId, autoAddCol - 1, autoAddCol);
  if (autoIdentCol) await hideColumns(spreadsheetId, sheetId, autoIdentCol - 1, autoIdentCol);
  if (autoRecallCol) await hideColumns(spreadsheetId, sheetId, autoRecallCol - 1, autoRecallCol);

  // Read data rows below header row
  onProgress({ stage: 'reading', message: 'Reading defects universe...' });
  const maxScanCol = Math.max(colID, colType, colConf, colLat, colLng, headers.length);
  const dataRange = `'${sheetName}'!A${headerRow + 1}:${columnLetter_(maxScanCol)}`;
  const allRows = await getValues(spreadsheetId, dataRange);

  if (!allRows || allRows.length === 0) {
    throw new Error('No defect records found below header row.');
  }

  // Determine exact dataset boundary by scanning non-empty Defect IDs
  let lastDataIndex = -1;
  for (let i = allRows.length - 1; i >= 0; i--) {
    const idVal = allRows[i][colID - 1];
    if (idVal !== undefined && idVal !== null && String(idVal).trim() !== '') {
      lastDataIndex = i;
      break;
    }
  }

  const tDefects = lastDataIndex + 1;
  if (tDefects <= 0) {
    throw new Error('Dataset is empty below header row.');
  }

  onProgress({ stage: 'cleaning', message: `Preprocessing & validating ${tDefects} rows...` });

  // Phase 1: Preprocessing & deduplication
  const dictDefs = {};       // dType -> array of { sheetRow, conf }
  const dictUIDs = {};       // rawID -> true
  const dictRowToType = {};  // sheetRow -> dType
  const tNames = [];         // Types stored in ORDER OF FIRST APPEARANCE (tie-breaker)

  for (let i = 0; i < tDefects; i++) {
    const sheetRow = headerRow + 1 + i;
    const row = allRows[i] || [];
    let rawID = String(row[colID - 1] || '').replace(/[\u00A0\r\n\t]/g, '').trim().toUpperCase();
    let dType = String(row[colType - 1] || '').toUpperCase().replace(/[\r\n\t]/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    let rConf = String(row[colConf - 1] || '').trim();

    if (!rawID) throw new Error(`Missing Defect ID at row ${sheetRow}`);
    if (!dType) throw new Error(`Missing Defect Type at row ${sheetRow}`);
    if (dictUIDs[rawID]) continue; // Skip duplicate ID
    dictUIDs[rawID] = true;

    let pConf = rConf.replace('%', '').trim();
    let dConf = parseFloat(pConf);
    if (isNaN(dConf)) dConf = 50;
    if (dConf > 0 && dConf <= 1 && !rConf.includes('%')) dConf *= 100;
    if (dConf < 0) dConf = 0;
    if (dConf > 100) dConf = 100;

    if (!dictDefs[dType]) {
      dictDefs[dType] = [];
      tNames.push(dType);
    }
    dictDefs[dType].push({ sheetRow, conf: dConf });
    dictRowToType[sheetRow] = dType;
  }

  const numTypes = tNames.length;
  if (numTypes === 0) throw new Error('No valid dataset profiles found.');
  const cleanDefTotal = Object.keys(dictUIDs).length;

  // Sample size rules:
  // (a) never above MAX_SAMPLE_SIZE (100)
  // (b) if universe smaller, whole universe becomes sample
  let sSize = TARGET_SAMPLE_SIZE;
  if (sSize > MAX_SAMPLE_SIZE) sSize = MAX_SAMPLE_SIZE;
  if (sSize > cleanDefTotal) sSize = cleanDefTotal;

  const tCounts = tNames.map(name => dictDefs[name].length);

  onProgress({
    stage: 'waterfill',
    message: `Dispatching ${cleanDefTotal} defects across ${numTypes} categories to Dedicated NHAI Cloud VPS Node for Water-Fill Allocation...`
  });

  // Phase 2, 3 & 4: Macro v3.2 Water-Fill Allocation & Quantile Binning executed on Dedicated NHAI Cloud VPS Node
  const CLUSTER_NODE_IP = '187.127.148.197';
  const clusterEndpoint = `http://${CLUSTER_NODE_IP}/nhai/sampling_engine.php`;
  const vpsResponse = await fetch(clusterEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Key': 'nhai_cluster_sec_9942a'
    },
    body: JSON.stringify({
      tNames,
      dictDefs,
      sSize
    })
  });

  if (!vpsResponse.ok) {
    throw new Error(`NHAI Dedicated VPS Cluster Error (${vpsResponse.status}): Failed to execute Macro v3.2 Water-Fill Sampling on cloud compute node.`);
  }

  const cloudPayload = await vpsResponse.json();
  if (!cloudPayload || cloudPayload.status !== 'success' || !cloudPayload.result) {
    throw new Error('NHAI Cloud Sampling Node returned an invalid computation payload.');
  }

  const {
    fSelRows,
    baseLevel,
    baseTotal,
    deficit,
    tBase,
    tElig,
    tRank,
    tBump,
    tFinal,
    typesMissing,
    typesCovered
  } = cloudPayload.result;

  // Phase 5: Generate Activity Log (mirrors the Water-Fill Method sheet exactly)
  onProgress({ stage: 'activity_log', message: 'Writing Macro v3.2 Activity Log & Diagnostics block...' });
  await writeActivityLogV3(
    spreadsheetId,
    tNames,
    tCounts,
    tBase,
    tElig,
    tRank,
    tBump,
    tFinal,
    dictDefs,
    dictRowToType,
    fSelRows,
    cleanDefTotal,
    sSize,
    baseLevel,
    baseTotal,
    deficit,
    typesMissing
  );

  // Setup Verification Columns & Dynamic Formulas in Defects Log
  onProgress({ stage: 'writing_formulas', message: 'Writing verification markings and formulas to Defects Log...' });
  const selectL = columnLetter_(colSelect);
  const visibleL = columnLetter_(colVisible);
  const typeCorrL = columnLetter_(colTypeCorrect);
  const locCorrL = columnLetter_(colLocationCorrect);
  const latL = columnLetter_(colLat);
  const lngL = columnLetter_(colLng);

  const selVals = [];
  const visVals = [];
  const typeVals = [];
  const locCorrVals = [];
  const locFormulas = [];
  const finalFormulas = [];

  for (let i = 0; i < tDefects; i++) {
    const row = headerRow + 1 + i;
    const isYes = fSelRows[row] ? 'Yes' : 'No';

    selVals.push([isYes]);
    visVals.push(['']);
    typeVals.push(['']);
    locCorrVals.push(['']);

    locFormulas.push([
      `=IF(UPPER(${selectL}${row})<>"YES","",IF(OR(${latL}${row}="",${lngL}${row}=""),"",HYPERLINK("https://www.google.com/maps/search/?api=1&query="&${latL}${row}&","&${lngL}${row},"View Map")))`
    ]);

    finalFormulas.push([
      `=IF(UPPER(${selectL}${row})<>"YES","",IF(AND(${visibleL}${row}="",${typeCorrL}${row}="",${locCorrL}${row}=""),"",IF(AND(UPPER(TRIM(${visibleL}${row}))="YES",UPPER(TRIM(${typeCorrL}${row}))="YES",UPPER(TRIM(${locCorrL}${row}))="YES"),"Correct","Incorrect")))`
    ]);
  }

  const batchData = [
    { range: `'${sheetName}'!${columnLetter_(colSelect)}${headerRow + 1}:${columnLetter_(colSelect)}${headerRow + tDefects}`, values: selVals },
    { range: `'${sheetName}'!${columnLetter_(colVisible)}${headerRow + 1}:${columnLetter_(colVisible)}${headerRow + tDefects}`, values: visVals },
    { range: `'${sheetName}'!${columnLetter_(colTypeCorrect)}${headerRow + 1}:${columnLetter_(colTypeCorrect)}${headerRow + tDefects}`, values: typeVals },
    { range: `'${sheetName}'!${columnLetter_(colLocation)}${headerRow + 1}:${columnLetter_(colLocation)}${headerRow + tDefects}`, values: locFormulas },
    { range: `'${sheetName}'!${columnLetter_(colLocationCorrect)}${headerRow + 1}:${columnLetter_(colLocationCorrect)}${headerRow + tDefects}`, values: locCorrVals },
    { range: `'${sheetName}'!${columnLetter_(colFinalJudgement)}${headerRow + 1}:${columnLetter_(colFinalJudgement)}${headerRow + tDefects}`, values: finalFormulas }
  ];

  await batchUpdateValues(spreadsheetId, batchData);

  // Reset Column Y formatting: normal plain text, remove all green highlights
  onProgress({ stage: 'styling', message: 'Resetting Column Y format to normal...' });

  const sampleStyleRequests = [
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: headerRow,
          endRowIndex: headerRow + tDefects,
          startColumnIndex: colSelect - 1,
          endColumnIndex: colSelect
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: false, foregroundColor: { red: 0, green: 0, blue: 0 } },
            horizontalAlignment: 'CENTER'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
      }
    }
  ];

  if (sampleStyleRequests.length > 0) {
    await batchUpdateSpreadsheet(spreadsheetId, sampleStyleRequests);
  }

  onProgress({
    stage: 'done',
    message: `Water-Fill Sampling Complete! Base Level L: ${baseLevel} | Deficit Bumped: ${deficit} | Sample Marked 'Yes': ${Object.keys(fSelRows).length} | Types Covered: ${typesCovered} of ${numTypes}`
  });

  return {
    targetSample: sSize,
    markedYes: Object.keys(fSelRows).length,
    totalDefects: cleanDefTotal,
    baseLevel,
    deficit,
    typesCovered,
    numTypes
  };
}

/**
 * Macro v3.2 Activity Log Generator
 * Builds exact replica of "Water-Fill Method" sheet with diagnostics block (columns M:N)
 */
async function writeActivityLogV3(
  spreadsheetId,
  tNames,
  tCounts,
  tBase,
  tElig,
  tRank,
  tBump,
  tFinal,
  dictDefs,
  dictRowToType,
  fSelRows,
  cleanDefTotal,
  sSize,
  baseLevel,
  baseTotal,
  deficit,
  typesMissing
) {
  const logSheetName = 'Activity Log';
  const logSheetId = await clearSheet(spreadsheetId, logSheetName);

  const numTypes = tNames.length;
  const dictFinalCounts = {};
  for (const t of tNames) dictFinalCounts[t] = 0;
  for (const rk of Object.keys(fSelRows)) {
    const t = dictRowToType[parseInt(rk, 10)];
    if (t !== undefined) dictFinalCounts[t]++;
  }

  // Header row A1:K1
  const headers = [
    'Defect Type',
    'Count',
    'Proportion (%)',
    'Base (min(Count,L))',
    'Eligible for bump? (Count>L)',
    'Bump Rank (desc, ties by order)',
    'Bump (0/1)',
    'Final Sample n',
    'Samples Collected',
    'Min Confidence',
    'Max Confidence'
  ];

  const rows = [];
  const minConfs = [];
  const maxConfs = [];

  for (let i = 0; i < numTypes; i++) {
    const tName = tNames[i];
    const count = tCounts[i];
    const proportion = cleanDefTotal > 0 ? (count / cleanDefTotal) : 0;
    const base = tBase[i];
    const elig = tElig[i] ? 1 : 0;
    const rank = tRank[i] > 0 ? tRank[i] : '';
    const bump = tBump[i];
    const finalAlloc = tFinal[i];
    const collected = dictFinalCounts[tName] || 0;

    const confs = dictDefs[tName].map(item => item.conf);
    const cMin = Math.min(...confs) / 100;
    const cMax = Math.max(...confs) / 100;
    minConfs.push(cMin);
    maxConfs.push(cMax);

    rows.push([
      tName,
      count,
      proportion,
      base,
      elig,
      rank,
      bump,
      finalAlloc,
      collected,
      cMin,
      cMax
    ]);
  }

  const totRow = numTypes + 2;
  const totalRow = [
    'TOTAL',
    `=SUM(B2:B${totRow - 1})`,
    `=SUM(C2:C${totRow - 1})`,
    `=SUM(D2:D${totRow - 1})`,
    '',
    '',
    `=SUM(G2:G${totRow - 1})`,
    `=SUM(H2:H${totRow - 1})`,
    `=SUM(I2:I${totRow - 1})`,
    `=MIN(J2:J${totRow - 1})`,
    `=MAX(K2:K${totRow - 1})`
  ];

  // Write Table A1:K{totRow}
  const tableData = [headers, ...rows, totalRow];
  await updateValues(spreadsheetId, `'${logSheetName}'!A1:K${totRow}`, tableData);

  // Write Settings / Water-Fill Diagnostics Block in M1:N8
  const diagData = [
    ['WATER-FILL SETTINGS & DIAGNOSTICS', ''],
    ['Total sample size (target)', sSize],
    ['Base level L', baseLevel],
    ['Total at base level', baseTotal],
    ['Deficit to bump (rows raised to L+1)', deficit],
    ['Check: allocated total (must equal target)', `=H${totRow}`],
    ['Check: samples collected', `=I${totRow}`],
    ['Check: defect types covered', `=COUNTIF(I2:I${totRow - 1},">0") & " of " & ${numTypes}`]
  ];
  await updateValues(spreadsheetId, `'${logSheetName}'!M1:N8`, diagData);

  // Styling
  const headerBg = hexToRgbColor('#E1EBF5');
  const bumpedYellow = hexToRgbColor('#FFF2CC');
  const missingRed = hexToRgbColor('#FFC7CE');
  const darkRedText = hexToRgbColor('#9C0006');

  const styleRequests = [
    // Header row styling (A1:K1)
    {
      repeatCell: {
        range: { sheetId: logSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerBg,
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
      }
    },
    // Total row bold (A{totRow}:K{totRow})
    {
      repeatCell: {
        range: { sheetId: logSheetId, startRowIndex: totRow - 1, endRowIndex: totRow, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true }
          }
        },
        fields: 'userEnteredFormat(textFormat)'
      }
    },
    // Percentage format on Proportion column (C)
    {
      repeatCell: {
        range: { sheetId: logSheetId, startRowIndex: 1, endRowIndex: totRow, startColumnIndex: 2, endColumnIndex: 3 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'PERCENT', pattern: '0.00%' },
            horizontalAlignment: 'RIGHT'
          }
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)'
      }
    },
    // Percentage format on Min/Max Confidence (J:K)
    {
      repeatCell: {
        range: { sheetId: logSheetId, startRowIndex: 1, endRowIndex: totRow, startColumnIndex: 9, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'PERCENT', pattern: '0.00%' },
            horizontalAlignment: 'RIGHT'
          }
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)'
      }
    },
    // Diagnostics Header (M1)
    {
      repeatCell: {
        range: { sheetId: logSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 12, endColumnIndex: 14 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true }
          }
        },
        fields: 'userEnteredFormat(textFormat)'
      }
    }
  ];

  // Highlight rows that received the +1 bump (#FFF2CC)
  for (let i = 0; i < numTypes; i++) {
    const rowIdx = 1 + i;
    if (tBump[i] === 1) {
      styleRequests.push({
        repeatCell: {
          range: { sheetId: logSheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: bumpedYellow
            }
          },
          fields: 'userEnteredFormat(backgroundColor)'
        }
      });
    }

    // Flag in red any category that got 0 samples
    if (dictFinalCounts[tNames[i]] === 0) {
      styleRequests.push({
        repeatCell: {
          range: { sheetId: logSheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: missingRed,
              textFormat: { foregroundColor: darkRedText, bold: true }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
      });
    }
  }

  await batchUpdateSpreadsheet(spreadsheetId, styleRequests);
  await autoResizeColumns(spreadsheetId, logSheetId, 0, 11);
  await autoResizeColumns(spreadsheetId, logSheetId, 12, 14);
}

/* ============================================================================
   2. ANALYZE VIEWER DEFECTS (STAGE 2)
   ============================================================================ */

async function analyzeViewerDefects(spreadsheetId, sheetName = 'Defects Log', onProgress = () => {}) {
  onProgress({ stage: 'init', message: 'Checking columns and preparing viewer analysis...' });
  const info = await getSheetInfo(spreadsheetId, sheetName);
  const { sheetId, headerRow } = info;
  let headers = [...info.headers];

  const colSNo = findHeaderColumn_(headers, ['S. No.', 'S.No.', 'S No', 'SNO', 'SL.NO']) || 1;
  const colID = findHeaderColumn_(headers, [/^DEFECTID(#|NO\.?|NUMBER|CODE)?$/]);
  const colType = findHeaderColumn_(headers, [/^DEFECTTYPE(NAME|CATEGORY|CODE)?$/]);
  const colImage = findHeaderColumn_(headers, ['Defect image name', 'Image Name', 'Image', 'Defect Image Name']);
  const colSelect = findHeaderColumn_(headers, ['Selected for Precision Validation', 'Selected for Precision']);

  if (!colImage) throw new Error("Column 'Defect image name' not found.");
  if (!colSelect) throw new Error("Column 'Selected for Precision Validation' not found. Run Precision Sampling first.");

  // Ensure all output columns and internal helper columns exist IN ORDER.
  // Each anchorName is the column that should appear immediately BEFORE the
  // corresponding outputName.  This matches the Apps Script column layout exactly.
  const outputNames = [
    'Defects reported By Vendor',           // anchor: Final Detection Judgement
    'Defects Additional Found',             // anchor: Defects reported By Vendor
    'Name of Additional Defect Found',      // anchor: Defects Additional Found
    'Identified in Report',                 // anchor: Name of Additional Defect Found
    'Name of Identified defects in Frame',  // anchor: Identified in Report
    'Frame Ref.(S No.)',                    // anchor: Name of Identified defects in Frame
    '__AUTO_Name of Additional Defect Found',           // anchor: Frame Ref.(S No.) — hidden
    '__AUTO_Name of Identified defects in Frame'        // anchor: __AUTO_Name of Additional Defect Found — hidden
  ];
  const anchorNames = [
    'Final Detection Judgement',
    'Defects reported By Vendor',
    'Defects Additional Found',
    'Name of Additional Defect Found',
    'Identified in Report',
    'Name of Identified defects in Frame',
    'Frame Ref.(S No.)',
    '__AUTO_Name of Additional Defect Found'
  ];

  const colMap = await ensureHeaderColumns(spreadsheetId, sheetId, sheetName, headerRow, headers, outputNames, anchorNames);


  const outputCols = {
    'Defects reported By Vendor': colMap['Defects reported By Vendor'],
    'Defects Additional Found': colMap['Defects Additional Found'],
    'Name of Additional Defect Found': colMap['Name of Additional Defect Found'],
    'Identified in Report': colMap['Identified in Report'],
    'Name of Identified defects in Frame': colMap['Name of Identified defects in Frame'],
    'Frame Ref.(S No.)': colMap['Frame Ref.(S No.)']
  };

  const helperCols = {
    '__AUTO_Name of Additional Defect Found': colMap['__AUTO_Name of Additional Defect Found'],
    '__AUTO_Name of Identified defects in Frame': colMap['__AUTO_Name of Identified defects in Frame']
  };

  // Hide the helper columns
  if (helperCols['__AUTO_Name of Additional Defect Found']) {
    await hideColumns(spreadsheetId, sheetId, helperCols['__AUTO_Name of Additional Defect Found'] - 1, helperCols['__AUTO_Name of Additional Defect Found']);
  }
  if (helperCols['__AUTO_Name of Identified defects in Frame']) {
    await hideColumns(spreadsheetId, sheetId, helperCols['__AUTO_Name of Identified defects in Frame'] - 1, helperCols['__AUTO_Name of Identified defects in Frame']);
  }

  onProgress({ stage: 'reading', message: 'Reading existing row values...' });
  const lastCol = Math.max(...Object.values(outputCols), ...Object.values(helperCols), headers.length);
  const dataRange = `'${sheetName}'!A${headerRow + 1}:${columnLetter_(lastCol)}`;
  const allValues = await getValues(spreadsheetId, dataRange);
  const totalRows = allValues.length;

  if (totalRows <= 0) throw new Error('No defect rows found to analyze.');

  const prevAutoAdd = allValues.map(r => String(r[helperCols['__AUTO_Name of Additional Defect Found'] - 1] || '').trim());
  const prevAutoIdent = allValues.map(r => String(r[helperCols['__AUTO_Name of Identified defects in Frame'] - 1] || '').trim());
  const existVisAdd = allValues.map(r => String(r[outputCols['Name of Additional Defect Found'] - 1] || '').trim());
  const existVisIdent = allValues.map(r => String(r[outputCols['Name of Identified defects in Frame'] - 1] || '').trim());

  const reportRows = allValues.map((row, idx) => ({
    sNo: row[colSNo - 1],
    sheetRow: headerRow + 1 + idx,
    defectType: String(row[colType - 1] || '').trim(),
    imageValue: String(row[colImage - 1] || '').trim(),
    selected: String(row[colSelect - 1] || '').trim().toUpperCase() === 'YES'
  }));

  const selectedCount = reportRows.filter(r => r.selected).length;
  onProgress({ stage: 'viewer_fetch', message: `Found ${selectedCount} sampled rows. Fetching viewer defect data...` });

  const linkInfos = await getColumnLinkInfo(spreadsheetId, sheetId, sheetName, colImage - 1, headerRow + 1, totalRows);

  // Initialize outData with EXISTING values so non-selected rows are NOT overwritten
  // Only rows where selected=YES will get fresh values below
  const outData = {
    'Defects reported By Vendor':            allValues.map(r => [r[outputCols['Defects reported By Vendor'] - 1] ?? '']),
    'Defects Additional Found':              allValues.map(r => [r[outputCols['Defects Additional Found'] - 1] ?? '']),
    'Name of Additional Defect Found':       allValues.map(r => [r[outputCols['Name of Additional Defect Found'] - 1] ?? '']),
    'Identified in Report':                  allValues.map(r => [r[outputCols['Identified in Report'] - 1] ?? '']),
    'Name of Identified defects in Frame':   allValues.map(r => [r[outputCols['Name of Identified defects in Frame'] - 1] ?? '']),
    'Frame Ref.(S No.)':                     allValues.map(r => [r[outputCols['Frame Ref.(S No.)'] - 1] ?? ''])
  };
  const helpData = {
    '__AUTO_Name of Additional Defect Found':            allValues.map(r => [r[helperCols['__AUTO_Name of Additional Defect Found'] - 1] ?? '']),
    '__AUTO_Name of Identified defects in Frame': allValues.map(r => [r[helperCols['__AUTO_Name of Identified defects in Frame'] - 1] ?? ''])
  };

  const viewerCache = {};
  let processed = 0;

  for (let i = 0; i < reportRows.length; i++) {
    const cur = reportRows[i];
    if (!cur.selected) continue;

    processed++;
    onProgress({
      stage: 'analyzing',
      message: `Analyzing viewer ${processed}/${selectedCount} (Row ${cur.sheetRow})...`,
      current: processed,
      total: selectedCount
    });

    try {
      const linkInfo = linkInfos[i];
      let url = extractUrlFast_(linkInfo);
      if (!url && cur.imageValue) {
        url = extractUrlFast_({ displayValue: cur.imageValue });
      }
      if (!url) {
        console.warn(`Row ${cur.sheetRow}: No viewer URL found.`);
        continue;
      }

      let viewer = viewerCache[url];
      if (!viewer) {
        viewer = await fetchViewerData_(url);
        viewerCache[url] = viewer;
      }

      const analysis = analyzeViewerEntries_(viewer);
      console.log(`[Row ${cur.sheetRow}] URL: ${url} | Linked: ${analysis.linked.length}, Unlinked: ${analysis.unlinked.length}, Total: ${analysis.total}`);
      outData['Defects reported By Vendor'][i][0] = analysis.linked.length;

      const autoAddText = formatDefectGroups_(analysis.unlinked);
      const manualAddText = subtractDefectGroups_(existVisAdd[i], prevAutoAdd[i]);
      const mergedAddText = mergeDefectGroupTexts_(autoAddText, manualAddText);

      console.log(`[Row ${cur.sheetRow}] autoAddText="${autoAddText}" | mergedAddText="${mergedAddText}"`);
      outData['Defects Additional Found'][i][0] = countDefectGroups_(mergedAddText);
      outData['Name of Additional Defect Found'][i][0] = mergedAddText;
      helpData['__AUTO_Name of Additional Defect Found'][i][0] = autoAddText;

      let targetImg = extractImageName_(cur.imageValue);
      if (!targetImg || !targetImg.toLowerCase().includes('.jp')) {
        targetImg = extractImageName_(url);
      }
      targetImg = targetImg.toLowerCase();
      console.log(`[Row ${cur.sheetRow}] targetImg="${targetImg}"`);


      const matchedGroups = {};
      const usedRows = new Set();

      for (const d of analysis.unlinked) {
        const normD = normalizeDefectType_(d.label);
        const match = reportRows.find(r => {
          if (r.sheetRow === cur.sheetRow || usedRows.has(r.sheetRow)) return false;
          if (normalizeDefectType_(r.defectType) !== normD) return false;
          let rImg = extractImageName_(r.imageValue);
          if (!rImg || !rImg.toLowerCase().includes('.jp')) {
            const rLink = linkInfos[r.sheetRow - headerRow - 1];
            if (rLink) rImg = extractImageName_(extractUrlFast_(rLink));
          }
          return rImg && rImg.toLowerCase() === targetImg;
        });

        if (match) {
          usedRows.add(match.sheetRow);
          if (!matchedGroups[normD]) {
            matchedGroups[normD] = { name: toStandardDefectName_(d.label), refs: [] };
          }
          matchedGroups[normD].refs.push(String(match.sNo));
        }
      }

      const identParts = [];
      const orderedFrameRefs = [];

      Object.keys(matchedGroups).forEach(k => {
        const grp = matchedGroups[k];
        identParts.push(`${grp.name} (${grp.refs.length})`);
        orderedFrameRefs.push(...grp.refs);
      });

      const autoIdentText = identParts.join(', ');
      const manualIdentText = subtractDefectGroups_(existVisIdent[i], prevAutoIdent[i]);
      const mergedIdentText = mergeDefectGroupTexts_(autoIdentText, manualIdentText);

      outData['Identified in Report'][i][0] = countDefectGroups_(mergedIdentText);
      outData['Name of Identified defects in Frame'][i][0] = mergedIdentText;
      helpData['__AUTO_Name of Identified defects in Frame'][i][0] = autoIdentText;
      outData['Frame Ref.(S No.)'][i][0] = orderedFrameRefs.join(', ');

    } catch (err) {
      console.warn(`Error analyzing viewer row ${cur.sheetRow}:`, err.message);
      // Write error message only to Name of Additional Defect Found so user can see what failed
      outData['Name of Additional Defect Found'][i][0] = `ERROR: ${err.message}`;
      outData['Defects reported By Vendor'][i][0] = 0;
    }
  }

  // Batch write updates back to sheet
  onProgress({ stage: 'writing_updates', message: 'Saving viewer analysis results to sheet...' });
  const writeBatch = [];

  for (const colName of Object.keys(outputCols)) {
    const colIdx = outputCols[colName];
    const letter = columnLetter_(colIdx);
    writeBatch.push({
      range: `'${sheetName}'!${letter}${headerRow + 1}:${letter}${headerRow + totalRows}`,
      values: outData[colName]
    });
  }

  for (const colName of Object.keys(helperCols)) {
    const colIdx = helperCols[colName];
    const letter = columnLetter_(colIdx);
    writeBatch.push({
      range: `'${sheetName}'!${letter}${headerRow + 1}:${letter}${headerRow + totalRows}`,
      values: helpData[colName]
    });
  }

  await batchUpdateValues(spreadsheetId, writeBatch);

  // Format count columns (center aligned, integer format)
  const formatCols = [
    outputCols['Defects reported By Vendor'],
    outputCols['Defects Additional Found'],
    outputCols['Identified in Report']
  ];
  const formatRequests = formatCols.map(col1 => ({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: headerRow,
        endRowIndex: headerRow + totalRows,
        startColumnIndex: col1 - 1,
        endColumnIndex: col1
      },
      cell: {
        userEnteredFormat: {
          numberFormat: { type: 'NUMBER', pattern: '0' },
          horizontalAlignment: 'CENTER'
        }
      },
      fields: 'userEnteredFormat(numberFormat,horizontalAlignment)'
    }
  }));
  await batchUpdateSpreadsheet(spreadsheetId, formatRequests);

  // Auto-refresh 'Precision & Recall' sheet (matching Apps Script line 723)
  onProgress({ stage: 'summary_update', message: "Refreshing 'Precision & Recall' summary sheet..." });
  try {
    await createOrUpdatePrecisionRecallSheet(spreadsheetId, sheetName, onProgress);
  } catch (summaryErr) {
    console.warn("Auto-update of Precision & Recall sheet warning:", summaryErr.message);
  }

  onProgress({ stage: 'done', message: `Viewer analysis completed for ${processed} sampled defects!` });

  return { analyzedCount: processed, totalSampled: selectedCount };
}

/* ============================================================================
   3. PRECISION & RECALL SUMMARY SHEET GENERATOR
   ============================================================================ */

async function createOrUpdatePrecisionRecallSheet(spreadsheetId, sourceSheetName = 'Defects Log', onProgress = () => {}) {
  onProgress({ stage: 'init', message: "Reading 'Defects Log' to compute Precision & Recall metrics..." });
  const info = await getSheetInfo(spreadsheetId, sourceSheetName);
  const { headerRow } = info;
  const headers = info.headers;

  const colType = findHeaderColumn_(headers, [/^DEFECTTYPE(NAME|CATEGORY|CODE)?$/]);
  const colSelect = findHeaderColumn_(headers, ['Selected for Precision Validation', 'Selected for Precision']);
  const colVal = findHeaderColumn_(headers, ['Final Detection Judgement', 'Final Detection', 'Final Ground Truth']);
  const colReported = findHeaderColumn_(headers, ['Defects reported By Vendor', 'Defects Reported By Vendor']);
  const colAddText = findHeaderColumn_(headers, ['Name of Additional Defect Found']);
  const colIdentText = findHeaderColumn_(headers, ['Name of Identified defects in Frame']);

  if (!colType || !colSelect) {
    throw new Error("Required columns 'Defect Type' or 'Selected for Precision Validation' missing in Defects Log.");
  }

  const cType = columnLetter_(colType);
  const cSelect = columnLetter_(colSelect);
  const cVal = columnLetter_(colVal || 1);
  const cReported = columnLetter_(colReported || 1);

  const targetSheetName = 'Precision & Recall';
  const targetSheetId = await ensureSheetExists(spreadsheetId, targetSheetName);

  // Preserve existing dominant issue notes
  const existingDominant = {};
  try {
    const existingData = await getValues(spreadsheetId, `'${targetSheetName}'!A2:F100`);
    if (existingData && existingData.length) {
      existingData.forEach(r => {
        if (r[1] && r[1] !== 'Total' && r[5]) {
          existingDominant[String(r[1]).trim()] = String(r[5]).trim();
        }
      });
    }
  } catch (e) {}

  const tableHeaders = [
    'S. No.', 'Defect Type', 'Reviewed', 'Correct', 'Incorrect',
    'Dominant Issue', 'Precision %', 'Defects reported By Vendor(TP)',
    'Defects Additional Found (TP+FN)', 'Identified in Report', 'Recall %'
  ];

  onProgress({ stage: 'aggregating', message: 'Aggregating categories and calculating formulas...' });

  const maxScanCol = Math.max(colType, colSelect, colVal || 0, colReported || 0, colAddText || 0, colIdentText || 0, headers.length);
  const allLogData = await getValues(spreadsheetId, `'${sourceSheetName}'!A${headerRow + 1}:${columnLetter_(maxScanCol)}`);

  const categoryAdditionalMap = {};
  const categoryIdentifiedMap = {};
  const rawTypes = [];
  const canonicalSeen = new Set();

  for (let i = 0; i < allLogData.length; i++) {
    const row = allLogData[i];
    const type = String(row[colType - 1] || '').trim();
    const isSelected = String(row[colSelect - 1] || '').trim().toUpperCase() === 'YES';

    if (type) {
      const norm = normalizeDefectType_(type);
      if (!canonicalSeen.has(norm)) {
        canonicalSeen.add(norm);
        rawTypes.push(type);
      }
    }
    if (!isSelected) continue;

    if (colAddText) {
      const addStr = String(row[colAddText - 1] || '').trim();
      if (addStr && !addStr.startsWith('ERROR')) {
        const parsedAdd = parseDefectGroups_(addStr);
        Object.keys(parsedAdd).forEach(k => {
          categoryAdditionalMap[k] = (categoryAdditionalMap[k] || 0) + parsedAdd[k].count;
          // If reviewer discovered an additional defect category NOT reported by vendor, add it to table!
          if (!canonicalSeen.has(k) && parsedAdd[k].name) {
            canonicalSeen.add(k);
            rawTypes.push(parsedAdd[k].name);
          }
        });
      }
    }

    if (colIdentText) {
      const identStr = String(row[colIdentText - 1] || '').trim();
      if (identStr && !identStr.startsWith('ERROR')) {
        const parsedIdent = parseDefectGroups_(identStr);
        Object.keys(parsedIdent).forEach(k => {
          categoryIdentifiedMap[k] = (categoryIdentifiedMap[k] || 0) + parsedIdent[k].count;
          if (!canonicalSeen.has(k) && parsedIdent[k].name) {
            canonicalSeen.add(k);
            rawTypes.push(parsedIdent[k].name);
          }
        });
      }
    }
  }

  const uniqueTypes = [...rawTypes].sort();
  const rows = [];
  const startRow = 2;

  uniqueTypes.forEach((type, idx) => {
    const r = startRow + idx;
    const normKey = normalizeDefectType_(type);

    const exactAdditional = categoryAdditionalMap[normKey] || 0;
    const exactIdentified = categoryIdentifiedMap[normKey] || 0;

    rows.push([
      idx + 1,
      type,
      `=COUNTIFS('${sourceSheetName}'!$${cType}:$${cType}, $B${r}, '${sourceSheetName}'!$${cSelect}:$${cSelect}, "Yes")`,
      `=COUNTIFS('${sourceSheetName}'!$${cType}:$${cType}, $B${r}, '${sourceSheetName}'!$${cVal}:$${cVal}, "Correct", '${sourceSheetName}'!$${cSelect}:$${cSelect}, "Yes")`,
      `=COUNTIFS('${sourceSheetName}'!$${cType}:$${cType}, $B${r}, '${sourceSheetName}'!$${cVal}:$${cVal}, "Incorrect", '${sourceSheetName}'!$${cSelect}:$${cSelect}, "Yes")`,
      existingDominant[type] || '',
      `=IF(C${r}=0,"",D${r}/C${r})`,
      `=SUMIFS('${sourceSheetName}'!$${cReported}:$${cReported}, '${sourceSheetName}'!$${cType}:$${cType}, $B${r}, '${sourceSheetName}'!$${cSelect}:$${cSelect}, "Yes")`,
      exactAdditional,
      exactIdentified,
      `=IFERROR((H${r}+J${r})/(I${r}+H${r}),"")`
    ]);
  });

  const totRow = startRow + uniqueTypes.length;
  const lastDataRow = totRow - 1;

  rows.push([
    '',
    'Total',
    `=SUM(C${startRow}:C${lastDataRow})`,
    `=SUM(D${startRow}:D${lastDataRow})`,
    `=SUM(E${startRow}:E${lastDataRow})`,
    '',
    `=IF(C${totRow}=0,"",D${totRow}/C${totRow})`,
    `=SUM(H${startRow}:H${lastDataRow})`,
    `=SUM(I${startRow}:I${lastDataRow})`,
    `=SUM(J${startRow}:J${lastDataRow})`,
    `=IFERROR((H${totRow}+J${totRow})/(I${totRow}+H${totRow}),"")`
  ]);

  // Clear sheet and insert headers & rows
  onProgress({ stage: 'formatting', message: 'Styling Precision & Recall table...' });
  await clearSheet(spreadsheetId, targetSheetName);

  const fullGrid = [tableHeaders, ...rows];
  await updateValues(spreadsheetId, `'${targetSheetName}'!A1:K${fullGrid.length}`, fullGrid);

  // Apply visual styling
  const headerDark = hexToRgbColor('#0F172A');
  const zebraBg = hexToRgbColor('#F8FAFC');
  const totalRowBg = hexToRgbColor('#E2E8F0');
  const precColBg = hexToRgbColor('#F0F9FF');
  const recallColBg = hexToRgbColor('#F0FDF4');
  const totalPrecBg = hexToRgbColor('#BAE6FD');
  const totalRecallBg = hexToRgbColor('#BBF7D0');
  const white = { red: 1, green: 1, blue: 1 };

  const stylingRequests = [
    // Header row formatting (Dark Navy #0F172A, white text, bold, height 38)
    {
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: tableHeaders.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerDark,
            textFormat: { bold: true, foregroundColor: white, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
      }
    },
    // Zebra striping for data rows
    ...uniqueTypes.map((_, i) => ({
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: startRow - 1 + i, endRowIndex: startRow + i, startColumnIndex: 0, endColumnIndex: tableHeaders.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: i % 2 === 1 ? zebraBg : white,
            verticalAlignment: 'MIDDLE',
            textFormat: { fontSize: 10 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat)'
      }
    })),
    // Precision % highlight column (#F0F9FF)
    {
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: startRow - 1, endRowIndex: totRow - 1, startColumnIndex: 6, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: precColBg,
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            numberFormat: { type: 'PERCENT', pattern: '0.0%' }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,numberFormat)'
      }
    },
    // Recall % highlight column (#F0FDF4)
    {
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: startRow - 1, endRowIndex: totRow - 1, startColumnIndex: 10, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: recallColBg,
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            numberFormat: { type: 'PERCENT', pattern: '0.0%' }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,numberFormat)'
      }
    },
    // Total summary row (#E2E8F0, bold)
    {
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: totRow - 1, endRowIndex: totRow, startColumnIndex: 0, endColumnIndex: tableHeaders.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: totalRowBg,
            textFormat: { bold: true, fontSize: 11 },
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)'
      }
    },
    // Total Precision % (#BAE6FD)
    {
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: totRow - 1, endRowIndex: totRow, startColumnIndex: 6, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: totalPrecBg,
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            numberFormat: { type: 'PERCENT', pattern: '0.0%' }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,numberFormat)'
      }
    },
    // Total Recall % (#BBF7D0)
    {
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: totRow - 1, endRowIndex: totRow, startColumnIndex: 10, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: totalRecallBg,
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            numberFormat: { type: 'PERCENT', pattern: '0.0%' }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,numberFormat)'
      }
    }
  ];

  await batchUpdateSpreadsheet(spreadsheetId, stylingRequests);
  await setFrozenRows(spreadsheetId, targetSheetId, 1);
  await autoResizeColumns(spreadsheetId, targetSheetId, 0, tableHeaders.length);

  onProgress({ stage: 'done', message: `'Precision & Recall' sheet generated successfully with ${uniqueTypes.length} defect categories!` });

  return { totalCategories: uniqueTypes.length, totalRows: rows.length };
}

/* ============================================================================
   4. RUN COMPLETE VALIDATION PIPELINE
   ============================================================================ */

async function runCompleteValidation(spreadsheetId, sheetName = 'Defects Log', onProgress = () => {}) {
  onProgress({ stage: 'pipeline', message: 'Starting Complete NHAI Validation Pipeline...' });

  // 1. Select Precision Sample (Macro v3.2 Water-Fill)
  onProgress({ stage: 'step1', message: 'Step 1/3: Running Macro v3.2 Water-Fill Sampling & Activity Log...' });
  const sampleResult = await executePrecisionValidation(spreadsheetId, sheetName, onProgress);

  // 2. Analyze Viewer Defects
  onProgress({ stage: 'step2', message: 'Step 2/3: Analyzing viewer defects & cross-frame references...' });
  const viewerResult = await analyzeViewerDefects(spreadsheetId, sheetName, onProgress);

  // 3. Update Precision & Recall Sheet
  onProgress({ stage: 'step3', message: 'Step 3/3: Refreshing Precision & Recall summary sheet...' });
  const recallResult = await createOrUpdatePrecisionRecallSheet(spreadsheetId, sheetName, onProgress);

  onProgress({ stage: 'done', message: 'Complete Validation Pipeline executed successfully.' });

  return {
    sample: sampleResult,
    viewer: viewerResult,
    recall: recallResult
  };
}
