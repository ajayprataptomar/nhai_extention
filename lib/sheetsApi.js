const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const WRITE_CHUNK_ROWS = 20000;

// Client-Side Sliding-Window Rate Governor (Max 45 req/min - Safe buffer under Google's 60 req/min limit)
const API_CALL_TIMESTAMPS = [];
const MAX_CALLS_PER_MINUTE = 45;

async function throttleApiCall_() {
  const now = Date.now();
  while (API_CALL_TIMESTAMPS.length > 0 && now - API_CALL_TIMESTAMPS[0] >= 60000) {
    API_CALL_TIMESTAMPS.shift();
  }

  if (API_CALL_TIMESTAMPS.length >= MAX_CALLS_PER_MINUTE) {
    const oldest = API_CALL_TIMESTAMPS[0];
    const waitMs = Math.max(1000, 60000 - (now - oldest) + 500);
    const waitSec = Math.round(waitMs / 1000);
    const msg = `Pacing requests to respect Google quota (${API_CALL_TIMESTAMPS.length}/${MAX_CALLS_PER_MINUTE} req/min). Waiting ${waitSec}s...`;
    console.warn(`[Rate Governor] ${msg}`);
    if (typeof window !== 'undefined' && typeof window.__onEngineProgress === 'function') {
      window.__onEngineProgress(msg);
    }
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return throttleApiCall_();
  }

  API_CALL_TIMESTAMPS.push(Date.now());
}

async function sheetsFetch(path, options = {}, _authRetried = false, _rateLimitRetries = 0) {
  await throttleApiCall_();
  const token = await getAuthToken(!_authRetried);
  const res = await fetch(`${SHEETS_API}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (res.status === 401 && !_authRetried) {
    await dropCachedAuthToken(token);
    return sheetsFetch(path, options, true, _rateLimitRetries);
  }

  // Handle Google Sheets API 429 (Rate Limit / Quota Exceeded) with self-healing backoff
  if (res.status === 429) {
    if (_rateLimitRetries < 7) {
      const delays = [10000, 15000, 20000, 25000, 30000, 35000, 40000];
      const delay = delays[_rateLimitRetries] || 20000;
      const waitSec = Math.round(delay / 1000);
      const msg = `Google API rate limit (60 req/min). Auto-waiting ${waitSec}s to resume automatically (attempt ${_rateLimitRetries + 1}/7)...`;
      console.warn(`[Sheets API 429 Rate Limit] ${msg}`);
      if (typeof window !== 'undefined' && typeof window.__onEngineProgress === 'function') {
        window.__onEngineProgress(msg);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      return sheetsFetch(path, options, _authRetried, _rateLimitRetries + 1);
    }
    throw new Error('Google Sheets API rate limit reached (60 requests/minute). Please wait 30 seconds and run Smart Sync to resume.');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

function extractSpreadsheetId(urlOrId) {
  const raw = String(urlOrId || '').trim();
  const match = raw.match(/\/d\/([a-zA-Z0-9-_]+)/i) ||
                raw.match(/[?&]id=([a-zA-Z0-9-_]+)/i);
  return match ? match[1] : raw;
}

async function getSpreadsheetMeta(spreadsheetId) {
  return sheetsFetch(`${spreadsheetId}?fields=properties.title,sheets.properties`);
}

async function getSheetIdByName(spreadsheetId, sheetName) {
  const meta = await getSpreadsheetMeta(spreadsheetId);
  const sheet = (meta.sheets || []).find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

async function getSheetInfo(spreadsheetId, sheetName = 'Defects Log') {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName);
  if (sheetId === null) throw new Error(`Sheet '${sheetName}' not found in spreadsheet.`);

  // Read first 10 rows to detect headers (Smart Exact-First Hunter)
  const headerGrid = await getValues(spreadsheetId, `'${sheetName}'!1:10`);
  if (!headerGrid || headerGrid.length === 0) throw new Error(`Sheet '${sheetName}' is empty.`);

  let headerRow = 0;
  let colID = 0, colType = 0, colConf = 0, colSelect = 0;

  for (let j = 0; j < headerGrid.length; j++) {
    const row = headerGrid[j];
    let xID = 0, xType = 0, xConf = 0, xSel = 0;
    let lID = 0, lType = 0, lConf = 0, lSel = 0;

    for (let i = 0; i < row.length; i++) {
      const hNorm = normalizeHeader_(row[i]);
      if (!hNorm || hNorm.includes('#ERROR')) continue;

      // Exact hits (authoritative)
      if (hNorm === 'DEFECTID') xID = i + 1;
      if (hNorm === 'DEFECTTYPE') xType = i + 1;
      if (hNorm === 'CONFIDENCELEVEL') xConf = i + 1;
      if (hNorm === 'SELECTEDFORPRECISIONVALIDATION') xSel = i + 1;

      // Loose hits fallback
      if (hNorm.includes('DEFECTID')) lID = i + 1;
      if (hNorm.includes('DEFECTTYPE') && !hNorm.includes('CORRECT')) lType = i + 1;
      if (hNorm.includes('CONFIDENCELEVEL')) lConf = i + 1;
      if (hNorm.includes('SELECTEDFORPRECISIONVALIDATION')) lSel = i + 1;
    }

    const thisID = xID || lID;
    const thisType = xType || lType;
    const thisConf = xConf || lConf;
    const thisSel = xSel || lSel;

    if (thisID > 0 && thisType > 0) {
      headerRow = j + 1;
      colID = thisID;
      colType = thisType;
      colConf = thisConf;
      colSelect = thisSel;
      break;
    }
  }

  if (!headerRow) {
    throw new Error("Header row containing 'Defect ID' and 'Defect Type' not found in first 10 rows.");
  }

  const headers = (await getValues(spreadsheetId, `'${sheetName}'!${headerRow}:${headerRow}`))[0] || [];
  return { sheetId, sheetName, headerRow, headers, colID, colType, colConf, colSelect };
}

async function getValues(spreadsheetId, range, valueRenderOption = 'UNFORMATTED_VALUE') {
  const data = await sheetsFetch(`${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=${valueRenderOption}`);
  return data.values || [];
}

async function batchGetValues(spreadsheetId, ranges, valueRenderOption = 'UNFORMATTED_VALUE') {
  const q = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const data = await sheetsFetch(`${spreadsheetId}/values:batchGet?${q}&valueRenderOption=${valueRenderOption}`);
  return (data.valueRanges || []).map(vr => vr.values || []);
}

async function ensureGridDimensions(spreadsheetId, sheetId, requiredRows, requiredCols) {
  const meta = await getSpreadsheetMeta(spreadsheetId);
  const sheet = (meta.sheets || []).find(s => s.properties.sheetId === sheetId);
  if (!sheet) return;
  const currentRows = sheet.properties?.gridProperties?.rowCount || 0;
  const currentCols = sheet.properties?.gridProperties?.columnCount || 0;

  const requests = [];
  if (requiredCols > currentCols) {
    const addCols = Math.max(requiredCols - currentCols + 15, 20);
    requests.push({
      appendDimension: {
        sheetId,
        dimension: 'COLUMNS',
        length: addCols
      }
    });
  }
  if (requiredRows > currentRows) {
    const addRows = Math.max(requiredRows - currentRows + 50, 100);
    requests.push({
      appendDimension: {
        sheetId,
        dimension: 'ROWS',
        length: addRows
      }
    });
  }

  if (requests.length > 0) {
    await batchUpdateSpreadsheet(spreadsheetId, requests);
  }
}

async function ensureGridDimensionsByName(spreadsheetId, sheetName, requiredRows, requiredCols) {
  const sheetId = await getSheetIdByName(spreadsheetId, sheetName);
  if (sheetId !== null) {
    await ensureGridDimensions(spreadsheetId, sheetId, requiredRows, requiredCols);
  }
}

async function updateValues(spreadsheetId, range, values, valueInputOption = 'USER_ENTERED') {
  try {
    return await sheetsFetch(`${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`, {
      method: 'PUT',
      body: JSON.stringify({ range, values })
    });
  } catch (err) {
    if (err.message && err.message.includes('exceeds grid limits')) {
      const sheetNameMatch = range.match(/^'([^']+)'!|^([^!]+)!/);
      const sheetName = sheetNameMatch ? (sheetNameMatch[1] || sheetNameMatch[2]) : null;
      if (sheetName) {
        const colMatch = range.match(/!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/i);
        if (colMatch) {
          const col1 = columnNumber_(colMatch[1]);
          const row1 = parseInt(colMatch[2], 10) || 1;
          const col2 = colMatch[3] ? columnNumber_(colMatch[3]) : col1;
          const row2 = colMatch[4] ? parseInt(colMatch[4], 10) : row1;
          await ensureGridDimensionsByName(spreadsheetId, sheetName, Math.max(row1, row2), Math.max(col1, col2));
          return sheetsFetch(`${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`, {
            method: 'PUT',
            body: JSON.stringify({ range, values })
          });
        }
      }
    }
    throw err;
  }
}

async function batchUpdateValues(spreadsheetId, data, valueInputOption = 'USER_ENTERED') {
  try {
    return await sheetsFetch(`${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption, data })
    });
  } catch (err) {
    if (err.message && err.message.includes('exceeds grid limits')) {
      for (const item of (data || [])) {
        const range = item.range || '';
        const sheetNameMatch = range.match(/^'([^']+)'!|^([^!]+)!/);
        const sheetName = sheetNameMatch ? (sheetNameMatch[1] || sheetNameMatch[2]) : null;
        if (sheetName) {
          const colMatch = range.match(/!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?/i);
          if (colMatch) {
            const col1 = columnNumber_(colMatch[1]);
            const row1 = parseInt(colMatch[2], 10) || 1;
            const col2 = colMatch[3] ? columnNumber_(colMatch[3]) : col1;
            const row2 = colMatch[4] ? parseInt(colMatch[4], 10) : row1;
            await ensureGridDimensionsByName(spreadsheetId, sheetName, Math.max(row1, row2), Math.max(col1, col2));
          }
        }
      }
      return sheetsFetch(`${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ valueInputOption, data })
      });
    }
    throw err;
  }
}

async function batchUpdateSpreadsheet(spreadsheetId, requests) {
  return sheetsFetch(`${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests })
  });
}

// Writes a single-column range in chunks so large row columns stay within API limits.
async function writeColumn(spreadsheetId, sheetName, colLetter, startRow, columnValues, valueInputOption = 'USER_ENTERED') {
  for (let offset = 0; offset < columnValues.length; offset += WRITE_CHUNK_ROWS) {
    const chunk = columnValues.slice(offset, offset + WRITE_CHUNK_ROWS);
    const rowStart = startRow + offset;
    const rowEnd = rowStart + chunk.length - 1;
    const range = `'${sheetName}'!${colLetter}${rowStart}:${colLetter}${rowEnd}`;
    await updateValues(spreadsheetId, range, chunk.map(v => [v]), valueInputOption);
  }
}

// Reads hyperlink, text format runs, formula, and display value for a single column.
async function getColumnLinkInfo(spreadsheetId, sheetId, sheetName, colIndex0, startRow1, numRows) {
  if (numRows <= 0) return [];
  const colLetter = columnLetter_(colIndex0 + 1);
  const range = `'${sheetName}'!${colLetter}${startRow1}:${colLetter}${startRow1 + numRows - 1}`;
  const data = await sheetsFetch(
    `${spreadsheetId}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=sheets(data(rowData(values(formattedValue,hyperlink,userEnteredValue,textFormatRuns))))`
  );
  const rows = data.sheets?.[0]?.data?.[0]?.rowData || [];
  return rows.map(r => {
    const cell = (r.values || [])[0] || {};
    let link = cell.hyperlink || '';
    if (!link && Array.isArray(cell.textFormatRuns)) {
      for (const run of cell.textFormatRuns) {
        if (run.format?.link?.uri) {
          link = run.format.link.uri;
          break;
        }
      }
    }
    return {
      hyperlink: link,
      formula: cell.userEnteredValue?.formulaValue || '',
      displayValue: cell.formattedValue || ''
    };
  });
}

// Reads hyperlink, formula, and display value for a single specific cell on-demand
async function getSingleCellLinkInfo(spreadsheetId, sheetName, colIndex0, row1) {
  if (!spreadsheetId || !sheetName || colIndex0 < 0 || row1 <= 0) return null;
  const colLetter = columnLetter_(colIndex0 + 1);
  const range = `'${sheetName}'!${colLetter}${row1}`;
  try {
    const data = await sheetsFetch(
      `${spreadsheetId}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=sheets(data(rowData(values(formattedValue,hyperlink,userEnteredValue,textFormatRuns))))`
    );
    const cell = data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0] || {};
    let link = cell.hyperlink || '';
    if (!link && Array.isArray(cell.textFormatRuns)) {
      for (const run of cell.textFormatRuns) {
        if (run.format?.link?.uri) {
          link = run.format.link.uri;
          break;
        }
      }
    }
    return {
      hyperlink: link,
      formula: cell.userEnteredValue?.formulaValue || '',
      displayValue: cell.formattedValue || ''
    };
  } catch (err) {
    console.warn(`[getSingleCellLinkInfo] Failed to fetch cell ${range}:`, err);
    return null;
  }
}

async function ensureSheetExists(spreadsheetId, sheetName) {
  const existingId = await getSheetIdByName(spreadsheetId, sheetName);
  if (existingId !== null) return existingId;
  const res = await batchUpdateSpreadsheet(spreadsheetId, [{ addSheet: { properties: { title: sheetName } } }]);
  return res.replies[0].addSheet.properties.sheetId;
}

async function clearSheet(spreadsheetId, sheetName) {
  const sheetId = await ensureSheetExists(spreadsheetId, sheetName);
  await batchUpdateSpreadsheet(spreadsheetId, [
    {
      updateCells: {
        range: { sheetId },
        fields: 'userEnteredValue,userEnteredFormat'
      }
    }
  ]);
  return sheetId;
}

function hexToRgbColor(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return { red: r, green: g, blue: b };
}

async function hideColumns(spreadsheetId, sheetId, startIndex0, endIndex0) {
  return batchUpdateSpreadsheet(spreadsheetId, [
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: startIndex0,
          endIndex: endIndex0
        },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser'
      }
    }
  ]);
}

async function setFrozenRows(spreadsheetId, sheetId, frozenRowCount) {
  return batchUpdateSpreadsheet(spreadsheetId, [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    }
  ]);
}

async function autoResizeColumns(spreadsheetId, sheetId, startIndex0, endIndex0) {
  return batchUpdateSpreadsheet(spreadsheetId, [
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: startIndex0,
          endIndex: endIndex0
        }
      }
    }
  ]);
}

/**
 * Ensure header columns exist in the sheet IN ORDER.
 * If a column is missing it is inserted right after its anchor column (the
 * column that appears just before it in `columnNames`).  This keeps the sheet
 * layout identical to the Apps Script output instead of dumping every new
 * column at the far right.
 *
 * @param {string[]} columnNames   Ordered list of column names to guarantee.
 * @param {string[]} [anchorNames] Optional parallel array: anchorNames[i] is
 *   the header that the i-th columnNames entry should follow.  When omitted,
 *   missing columns are appended at the end (legacy behaviour).
 */
async function ensureHeaderColumns(spreadsheetId, sheetId, sheetName, headerRow, headers, columnNames, anchorNames) {
  const darkSlate = hexToRgbColor('#1E293B');
  const white = { red: 1, green: 1, blue: 1 };

  // Build result map for columns that already exist
  const result = {};
  for (const name of columnNames) {
    const existing = findHeaderColumn_(headers, [name]);
    if (existing > 0) result[name] = existing;
  }

  // Process each missing column one at a time so insertions don't shift
  // already-computed indices.
  for (let idx = 0; idx < columnNames.length; idx++) {
    const name = columnNames[idx];
    if (result[name]) continue; // already present

    // Determine where to insert this column.
    // 1. Try the explicit anchor (anchorNames array).
    // 2. Fall back to the previous column in columnNames that already exists.
    // 3. If nothing found, append at end.
    let insertAfterCol1 = headers.length; // default: append

    if (anchorNames && anchorNames[idx]) {
      const anchorCol = findHeaderColumn_(headers, [anchorNames[idx]]);
      if (anchorCol > 0) insertAfterCol1 = anchorCol;
    } else {
      // Walk backwards through columnNames to find the nearest predecessor that exists
      for (let j = idx - 1; j >= 0; j--) {
        const predCol = result[columnNames[j]];
        if (predCol > 0) {
          insertAfterCol1 = predCol;
          break;
        }
      }
    }

    const insertBeforeIndex0 = insertAfterCol1; // 0-indexed = col1 (col after anchor)

    // Ensure grid has room
    await ensureGridDimensions(spreadsheetId, sheetId, headerRow, headers.length + 2);

    // Insert a blank column at the target position
    await batchUpdateSpreadsheet(spreadsheetId, [{
      insertDimension: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: insertBeforeIndex0,
          endIndex: insertBeforeIndex0 + 1
        },
        inheritFromBefore: true
      }
    }]);

    // Shift existing result indices that are >= the insertion point
    for (const k of Object.keys(result)) {
      if (result[k] > insertAfterCol1) result[k]++;
    }
    // Shift in-memory headers array
    headers.splice(insertBeforeIndex0, 0, name);

    const newCol1 = insertBeforeIndex0 + 1;
    result[name] = newCol1;

    // Write the header label
    await updateValues(spreadsheetId, `'${sheetName}'!${columnLetter_(newCol1)}${headerRow}`, [[name]]);

    // Style the header cell
    await batchUpdateSpreadsheet(spreadsheetId, [{
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: headerRow - 1,
          endRowIndex: headerRow,
          startColumnIndex: newCol1 - 1,
          endColumnIndex: newCol1
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: darkSlate,
            textFormat: { bold: true, foregroundColor: white, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
      }
    }]);
  }

  return result;
}


async function ensureHeaderColumn(spreadsheetId, sheetId, sheetName, headerRow, headers, name) {
  const map = await ensureHeaderColumns(spreadsheetId, sheetId, sheetName, headerRow, headers, [name]);
  return map[name];
}
