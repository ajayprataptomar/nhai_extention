/**
 * NHAI Defect Validation - Validation Review Dashboard Controller
 * 1:1 Port of ValidationReview script to Chrome Extension (Google Sheets API v4)
 */

let allRecords = [];
let currentQueue = [];
let currentIndex = 0;
let currentMode = 'ALL';
let issuesTaxonomy = [];
let frameHtmlCache = {};
let urlMap = {};
let sNoToRowMap = {};
let reviewSheetMeta = {};

let currentActiveViewerUrl = '';
let curAdditionalCounts = {};
let curIssueRefs = {};
let origIssueRefs = {};
let curVisible = 'Yes';
let curTypeCorrect = 'Yes';
let curLocCorrect = 'Yes';


let currentSpreadsheetId = '';
let currentSheetName = 'Defects Log';

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  currentSpreadsheetId = params.get('spreadsheetId') || '';
  currentSheetName = params.get('sheetName') || 'Defects Log';

  if (!currentSpreadsheetId) {
    const saved = await chrome.storage.local.get(['lastSpreadsheetId', 'lastSheetName']);
    if (saved.lastSpreadsheetId) currentSpreadsheetId = saved.lastSpreadsheetId;
    if (saved.lastSheetName) currentSheetName = saved.lastSheetName;
  }

  // Live cluster check on session boot (Does NOT run during Save/Review operations)
  if (typeof syncClusterSession === 'function') {
    const cluster = await syncClusterSession('Review Dashboard Open');
    if (!cluster.online) {
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0F172A; font-family: 'Plus Jakarta Sans', sans-serif; color: #FFFFFF; padding: 2rem;">
          <div style="background: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 2.5rem; max-width: 520px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
            <h1 style="font-size: 1.35rem; font-weight: 700; color: #F8FAFC; margin-bottom: 0.75rem;">500 Internal Server Error</h1>
            <p style="font-size: 0.88rem; color: #94A3B8; line-height: 1.6; margin-bottom: 1.5rem;">
              ${cluster.message || 'NHAI Dedicated Processing Cluster Offline. Dedicated VPS backend node [vps-delhi-01] is unreachable. Error 0x500_CLUSTER_TIMEOUT. Please contact system administrator.'}
            </p>
            <div style="background: #0F172A; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; font-family: monospace; font-size: 0.75rem; color: #EF4444; margin-bottom: 1.5rem;">
              ERR_CLUSTER_GATEWAY_TIMEOUT (0x500)
            </div>
            <button onclick="window.location.reload()" style="background: #2563EB; color: #FFF; border: none; border-radius: 6px; padding: 10px 20px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              Retry Connection
            </button>
          </div>
        </div>
      `;
      return;
    }
  }

  setupEventListeners();

  if (!currentSpreadsheetId) {
    onError(new Error('No Google Spreadsheet selected. Please open the Home Command Center and select a spreadsheet.'));
    return;
  }

  loadData();
});

function setupEventListeners() {
  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setMode(btn.getAttribute('data-mode'), btn);
    });
  });

  // Media toolbar
  document.getElementById('btn-open-external')?.addEventListener('click', openExternalViewer);

  // Verdict toggle buttons
  document.getElementById('btn-vis-yes')?.addEventListener('click', () => setVerdict('visible', 'Yes'));
  document.getElementById('btn-vis-no')?.addEventListener('click', () => setVerdict('visible', 'No'));
  document.getElementById('btn-type-yes')?.addEventListener('click', () => setVerdict('typeCorrect', 'Yes'));
  document.getElementById('btn-type-no')?.addEventListener('click', () => setVerdict('typeCorrect', 'No'));
  document.getElementById('btn-loc-yes')?.addEventListener('click', () => setVerdict('locCorrect', 'Yes'));
  document.getElementById('btn-loc-no')?.addEventListener('click', () => setVerdict('locCorrect', 'No'));

  // Search input
  document.getElementById('issue-search')?.addEventListener('input', filterIssues);

  // Nav buttons
  document.getElementById('btn-prev')?.addEventListener('click', navPrevious);
  document.getElementById('btn-save-next')?.addEventListener('click', saveAndNext);

  // In-Dashboard Location Modal Listeners
  document.getElementById('btn-open-map')?.addEventListener('click', toggleLocationModal);
  document.getElementById('btn-close-loc-modal')?.addEventListener('click', closeLocationModal);

  document.getElementById('btn-map-street')?.addEventListener('click', () => {
    if (!locMap || !streetLayer || !satelliteLayer) return;
    document.getElementById('btn-map-street').classList.add('active');
    document.getElementById('btn-map-satellite').classList.remove('active');
    if (locMap.hasLayer(satelliteLayer)) locMap.removeLayer(satelliteLayer);
    if (!locMap.hasLayer(streetLayer)) locMap.addLayer(streetLayer);
  });

  document.getElementById('btn-map-satellite')?.addEventListener('click', () => {
    if (!locMap || !streetLayer || !satelliteLayer) return;
    document.getElementById('btn-map-satellite').classList.add('active');
    document.getElementById('btn-map-street').classList.remove('active');
    if (locMap.hasLayer(streetLayer)) locMap.removeLayer(streetLayer);
    if (!locMap.hasLayer(satelliteLayer)) locMap.addLayer(satelliteLayer);
  });

  document.getElementById('btn-open-full-gis')?.addEventListener('click', openFullGisDashboard);

  document.getElementById('btn-modal-loc-yes')?.addEventListener('click', () => {
    setVerdict('locCorrect', 'Yes');
  });

  document.getElementById('btn-modal-loc-no')?.addEventListener('click', () => {
    setVerdict('locCorrect', 'No');
  });

  // Keyboard Shortcuts for Rapid Auditing:
  // - Space bar: SAVE & NEXT
  // - N / n key: Toggle "Defect Type Correct ?" (Yes <-> No)
  // - V / v key: Toggle "Visible ?" (Yes <-> No)
  // - L / l key: Toggle "Location Correct ?" (Yes <-> No)
  // - M / m key: Toggle In-Dashboard Interactive GIS Location Map
  // - Shift + M: Open Full GIS Dashboard deep-linked
  // - ArrowLeft: Go to Previous Defect
  // - S / s key: Focus Search Box directly
  // - Escape key: Close Location Modal or blur search box
  // - Y / y key: Set "Defect Type Correct ?" to Yes
  // - Ctrl+Enter / Cmd+Enter: SAVE & NEXT
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

    // Allow Escape key to close modal or blur search box
    if (e.key === 'Escape') {
      if (isLocModalOpen) {
        e.preventDefault();
        closeLocationModal();
        return;
      }
      if (isInput) {
        e.preventDefault();
        e.target.blur();
        return;
      }
    }

    if (isInput) return;

    const keyLower = String(e.key || '').toLowerCase();
    const code = e.code || '';

    // Space bar -> Save & Next
    if (code === 'Space' || keyLower === ' ' || keyLower === 'spacebar') {
      e.preventDefault();
      saveAndNext();
      return;
    }

    // N / n (Capital or Small or CapsLock) -> Toggle Type Correct (Yes <-> No)
    if (keyLower === 'n' || code === 'KeyN') {
      e.preventDefault();
      const nextVal = (curTypeCorrect === 'Yes' || curTypeCorrect === 'YES') ? 'No' : 'Yes';
      setVerdict('typeCorrect', nextVal);
      return;
    }

    // V / v (Capital or Small or CapsLock) -> Toggle Visible (Yes <-> No)
    if (keyLower === 'v' || code === 'KeyV') {
      e.preventDefault();
      const nextVal = (curVisible === 'Yes' || curVisible === 'YES') ? 'No' : 'Yes';
      setVerdict('visible', nextVal);
      return;
    }

    // L / l (Capital or Small or CapsLock) -> Toggle Location Correct (Yes <-> No)
    if (keyLower === 'l' || code === 'KeyL') {
      e.preventDefault();
      const nextVal = (curLocCorrect === 'Yes' || curLocCorrect === 'YES') ? 'No' : 'Yes';
      setVerdict('locCorrect', nextVal);
      return;
    }

    // M / m (Capital or Small or CapsLock) -> Toggle In-Dashboard GIS Map Modal (or Shift+M for Full GIS)
    if (keyLower === 'm' || code === 'KeyM') {
      e.preventDefault();
      if (e.shiftKey) {
        openFullGisDashboard();
      } else {
        toggleLocationModal();
      }
      return;
    }

    // ArrowLeft -> Navigate to Previous defect
    if (code === 'ArrowLeft' || keyLower === 'arrowleft') {
      e.preventDefault();
      navPrevious();
      return;
    }

    // S / s (Capital or Small or CapsLock) -> Focus search box directly
    if (keyLower === 's' || code === 'KeyS') {
      e.preventDefault();
      const searchBox = document.getElementById('issue-search');
      if (searchBox) {
        searchBox.focus();
        searchBox.select();
      }
      return;
    }

    // Y / y (Capital or Small or CapsLock) -> Set Type Correct to Yes
    if (keyLower === 'y' || code === 'KeyY') {
      e.preventDefault();
      setVerdict('typeCorrect', 'Yes');
      return;
    }

    // Ctrl+Enter / Cmd+Enter -> Save & Next
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveAndNext();
      return;
    }
  });

  // Event delegation for taxonomy buttons, minus/plus, and individual frame unlinking
  document.addEventListener('click', (e) => {
    // 0. Click on defect frame reference badge (#s) to open viewer on-demand
    const badgeLink = e.target.closest('.ref-badge-link');
    if (badgeLink) {
      e.preventDefault();
      e.stopPropagation();
      const s = badgeLink.getAttribute('data-ref');
      openDefectViewerOnDemand(s, badgeLink);
      return;
    }

    // 1. Specific frame unlinking via close button [ × ]
    const unlinkBtn = e.target.closest('.btn-unlink-ref');
    if (unlinkBtn) {
      e.stopPropagation();
      const issue = decodeURIComponent(unlinkBtn.getAttribute('data-issue'));
      const ref = unlinkBtn.getAttribute('data-ref');
      unlinkSpecificFrame(issue, ref);
      return;
    }

    // 2. Click to restore previously unlinked frame [ + #s ]
    const restoreBtn = e.target.closest('.ref-badge-unlinked');
    if (restoreBtn) {
      e.stopPropagation();
      const issue = decodeURIComponent(restoreBtn.getAttribute('data-issue'));
      const ref = restoreBtn.getAttribute('data-ref');
      restoreSpecificFrame(issue, ref);
      return;
    }

    // 3. Counter plus / minus buttons
    const plusBtn = e.target.closest('.btn-plus');
    if (plusBtn) {
      const issue = decodeURIComponent(plusBtn.getAttribute('data-issue'));
      stepCount(issue, 1);
      return;
    }
    const minusBtn = e.target.closest('.btn-minus');
    if (minusBtn) {
      const issue = decodeURIComponent(minusBtn.getAttribute('data-issue'));
      stepCount(issue, -1);
      return;
    }
  });
}

async function loadData() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'flex';

  try {
    const res = await getValidationReviewData(currentSpreadsheetId, currentSheetName);
    onDataLoaded(res);
  } catch (err) {
    onError(err);
  }
}

function onDataLoaded(res) {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';

  allRecords = res.items || [];
  issuesTaxonomy = res.issuesList || [];
  urlMap = res.urlMap || {};
  sNoToRowMap = res.sNoToRowMap || {};
  reviewSheetMeta = res.meta || {};

  updateStats(res.progress);
  rebuildQueue();

  if (allRecords.length === 0) {
    alert('No defect records found with "Selected for Precision Validation" = Yes in the sheet.\n\nPlease run Step 1: "Select Precision Sample" first.');
    return;
  }

  if (currentQueue.length > 0) {
    currentIndex = 0;
    loadCurrentRecord();
  } else {
    alert('All sampled defects are already reviewed in this dataset!');
  }
}

function onError(err) {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
  showToast('Error loading dataset: ' + (err.message || err), false);
  alert('Error loading review dataset:\n' + (err.message || err));
}

function updateStats(p) {
  if (!allRecords || allRecords.length === 0) {
    document.getElementById('stat-reviewed').innerText = '0';
    document.getElementById('stat-total').innerText = '0';
    document.getElementById('stat-pending').innerText = '0';
    return;
  }

  const total = allRecords.length;
  let reviewed = 0;

  if (currentMode === 'PRECISION') {
    reviewed = allRecords.filter(r => r.isPrecisionReviewed).length;
  } else if (currentMode === 'RECALL') {
    reviewed = allRecords.filter(r => r.isRecallReviewed).length;
  } else {
    // ALL mode: count records that are fully reviewed (both Precision & Recall done)
    reviewed = allRecords.filter(r => r.isFullyReviewed).length;
  }

  const pending = total - reviewed;
  document.getElementById('stat-reviewed').innerText = reviewed;
  document.getElementById('stat-total').innerText = total;
  document.getElementById('stat-pending').innerText = pending;
}

function showToast(msg, isSuccess = true) {
  const toast = document.getElementById('dashboard-toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.style.background = isSuccess ? '#15803d' : '#b91c1c';
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 2200);
}

function setMode(mode, btn) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  rebuildQueue();
  updateStats();
  currentIndex = 0;
  loadCurrentRecord();
}

function rebuildQueue() {
  if (currentMode === 'PRECISION') {
    currentQueue = allRecords.filter(r => !r.isPrecisionReviewed);
  } else if (currentMode === 'RECALL') {
    const withCandidateDefects = allRecords.filter(r => !r.isRecallReviewed && (r.identCount > 0 || r.additionalCount > 0 || (r.identNames && r.identNames.trim() !== '') || (r.additionalNames && r.additionalNames.trim() !== '') || (r.frameRef && r.frameRef.trim() !== '')));
    currentQueue = withCandidateDefects.length > 0 ? withCandidateDefects : allRecords.filter(r => !r.isRecallReviewed);
  } else {
    currentQueue = allRecords.filter(r => !r.isFullyReviewed);
  }

  if (currentQueue.length === 0) {
    currentQueue = allRecords;
  }
}

function parseAdditionalDefectsString(rawText) {
  const result = {};
  if (!rawText) return result;

  const cleanStr = String(rawText).trim();
  const regex = /([^,]+?)\s*\(\s*(\d+)\s*\)/g;
  let m;
  while ((m = regex.exec(cleanStr)) !== null) {
    const rawName = m[1].trim();
    const name = toStandardDefectName_(rawName);
    const count = parseInt(m[2], 10);
    if (name && !isNaN(count) && count > 0) {
      result[name] = (result[name] || 0) + count;
    }
  }
  return result;
}

function parseFrameReferences(identText, frameRefStr) {
  const map = {};
  if (!identText || !frameRefStr) return map;

  const rawRefs = frameRefStr.split(',').map(s => s.trim()).filter(Boolean);
  const regex = /([^,]+?)\s*\(\s*(\d+)\s*\)/g;
  let m;
  let refIdx = 0;

  while ((m = regex.exec(identText)) !== null) {
    const rawName = m[1].trim();
    const name = toStandardDefectName_(rawName);
    const count = parseInt(m[2], 10) || 0;
    if (!map[name]) map[name] = [];

    for (let k = 0; k < count; k++) {
      if (refIdx < rawRefs.length) {
        map[name].push(rawRefs[refIdx]);
        refIdx++;
      }
    }
  }
  return map;
}

function loadCurrentRecord() {
  if (!currentQueue || currentQueue.length === 0 || currentIndex >= currentQueue.length) return;
  const rec = currentQueue[currentIndex];

  document.getElementById('head-sno').innerText = `S.NO ${rec.sNo}`;
  document.getElementById('head-type').innerText = rec.defectType;
  document.getElementById('head-meta').innerText = `${rec.roadType} | ${rec.direction} (Lane ${rec.lane || '1'}) • Ch: ${rec.chainage}`;
  document.getElementById('card-reported-count').innerText = rec.reportedCount || 1;

  const sevEl = document.getElementById('head-sev');
  sevEl.innerText = rec.severity;
  sevEl.className = `sev-tag sev-${rec.severity}`;

  const isVisNo = String(rec.visible).toUpperCase() === 'NO';
  const isTypeNo = String(rec.typeCorrect).toUpperCase() === 'NO';
  const isLocNo = String(rec.locCorrect).toUpperCase() === 'NO';

  curVisible = isVisNo ? 'No' : 'Yes';
  curTypeCorrect = isTypeNo ? 'No' : 'Yes';
  curLocCorrect = isLocNo ? 'No' : 'Yes';
  renderVerdicts();

  curAdditionalCounts = parseAdditionalDefectsString(rec.additionalNames);
  
  // Load both active and original reference mappings
  curIssueRefs = rec.linkedIdentifiedRefs || parseFrameReferences(rec.identNames, rec.frameRef);
  origIssueRefs = JSON.parse(JSON.stringify(curIssueRefs));

  Object.keys(curAdditionalCounts).forEach(k => {
    if (!issuesTaxonomy.includes(k)) {
      issuesTaxonomy.unshift(k);
    }
  });

  renderIssueTaxonomy();
  updateIdentifiedReportUI();

  currentActiveViewerUrl = rec.viewerUrl || '';
  const frame = document.getElementById('native-viewer-frame');
  const loadBox = document.getElementById('frame-loading');

  if (currentActiveViewerUrl) {
    loadBox.style.display = 'flex';
    frame.style.display = 'none';
    const msgEl = loadBox.querySelector('span');
    if (msgEl) msgEl.innerText = 'Loading Native Defect Frame...';

    let loadTimeout = null;
    let loaded = false;

    frame.onload = () => {
      loaded = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      loadBox.style.display = 'none';
      frame.style.display = 'block';
    };

    frame.onerror = () => {
      if (loadTimeout) clearTimeout(loadTimeout);
      fallbackToHtmlRender(currentActiveViewerUrl);
    };

    // Load URL directly into frame for full native interactivity & bounding boxes
    frame.removeAttribute('srcdoc');
    if (frame.src !== currentActiveViewerUrl) {
      frame.src = currentActiveViewerUrl;
    } else {
      // If src already matches, display frame immediately
      loaded = true;
      loadBox.style.display = 'none';
      frame.style.display = 'block';
    }

    // Safety timeout: if iframe doesn't trigger onload within 3.5 seconds, use background HTML fallback
    loadTimeout = setTimeout(() => {
      if (!loaded && frame.style.display === 'none') {
        fallbackToHtmlRender(currentActiveViewerUrl);
      }
    }, 3500);

    prefetchNextRecords();
  } else {
    frame.removeAttribute('src');
    frame.removeAttribute('srcdoc');
    frame.style.display = 'none';
    loadBox.style.display = 'flex';
    const msgEl = loadBox.querySelector('span');
    if (msgEl) msgEl.innerText = 'No Viewer URL available for this record.';
  }

  // If Location Map Modal is currently open, seamlessly refresh map to the new defect
  if (isLocModalOpen) {
    openLocationModal();
  }
}

function fallbackToHtmlRender(url) {
  const frame = document.getElementById('native-viewer-frame');
  const loadBox = document.getElementById('frame-loading');

  if (frameHtmlCache[url]) {
    applyHtmlToFrame(frameHtmlCache[url]);
    return;
  }

  fetchNativeViewerHTML(url)
    .then(res => {
      if (res && res.success && res.htmlContent) {
        frameHtmlCache[url] = res.htmlContent;
        applyHtmlToFrame(res.htmlContent);
      } else {
        if (loadBox) {
          loadBox.style.display = 'flex';
          const msg = loadBox.querySelector('span');
          if (msg) msg.innerText = 'Failed to load frame. Click "Open in New Tab" below.';
        }
      }
    })
    .catch(err => {
      if (loadBox) {
        loadBox.style.display = 'flex';
        const msg = loadBox.querySelector('span');
        if (msg) msg.innerText = 'Error loading frame: ' + (err.message || err);
      }
    });
}

function applyHtmlToFrame(html) {
  const frame = document.getElementById('native-viewer-frame');
  const loadBox = document.getElementById('frame-loading');
  if (!frame) return;

  // Revoke any previous blob URL to avoid memory leaks
  if (frame._blobUrl) {
    URL.revokeObjectURL(frame._blobUrl);
    frame._blobUrl = null;
  }

  // Use Blob URL instead of srcdoc — Chrome extension CSP blocks inline scripts
  // inside srcdoc, but Blob URLs load in their own opaque origin, bypassing this.
  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  frame._blobUrl = blobUrl;

  frame.removeAttribute('srcdoc');
  frame.src = blobUrl;
  frame.style.display = 'block';
  if (loadBox) loadBox.style.display = 'none';
}

function prefetchNextRecords() {
  for (let offset = 1; offset <= 2; offset++) {
    const nextIdx = currentIndex + offset;
    if (nextIdx < currentQueue.length) {
      const nextRec = currentQueue[nextIdx];
      const nextUrl = nextRec.viewerUrl;
      if (nextUrl && !frameHtmlCache[nextUrl]) {
        fetchNativeViewerHTML(nextUrl).then(res => {
          if (res && res.success && res.htmlContent) {
            frameHtmlCache[nextUrl] = res.htmlContent;
          }
        });
      }
    }
  }
}

function openExternalViewer() {
  if (currentActiveViewerUrl) {
    window.open(currentActiveViewerUrl, '_blank');
  } else {
    alert('No Viewer URL available to open.');
  }
}

function setVerdict(field, val) {
  if (field === 'visible') curVisible = val;
  if (field === 'typeCorrect') curTypeCorrect = val;
  if (field === 'locCorrect') curLocCorrect = val;
  renderVerdicts();
  renderModalLocVerdicts();
}

function renderVerdicts() {
  const isVisYes = curVisible === 'Yes' || curVisible === 'YES';
  const isTypeYes = curTypeCorrect === 'Yes' || curTypeCorrect === 'YES';
  const isLocYes = curLocCorrect === 'Yes' || curLocCorrect === 'YES';

  const visYesBtn = document.getElementById('btn-vis-yes');
  const visNoBtn = document.getElementById('btn-vis-no');
  const typeYesBtn = document.getElementById('btn-type-yes');
  const typeNoBtn = document.getElementById('btn-type-no');
  const locYesBtn = document.getElementById('btn-loc-yes');
  const locNoBtn = document.getElementById('btn-loc-no');

  if (visYesBtn) visYesBtn.className = `toggle-btn yes ${isVisYes ? 'active' : ''}`;
  if (visNoBtn) visNoBtn.className = `toggle-btn no ${!isVisYes ? 'active' : ''}`;
  if (typeYesBtn) typeYesBtn.className = `toggle-btn yes ${isTypeYes ? 'active' : ''}`;
  if (typeNoBtn) typeNoBtn.className = `toggle-btn no ${!isTypeYes ? 'active' : ''}`;
  if (locYesBtn) locYesBtn.className = `toggle-btn yes ${isLocYes ? 'active' : ''}`;
  if (locNoBtn) locNoBtn.className = `toggle-btn no ${!isLocYes ? 'active' : ''}`;

  const reportedEl = document.getElementById('card-reported-count');
  if (reportedEl && currentQueue[currentIndex]) {
    const isAllYes = (isVisYes && isTypeYes && isLocYes);
    reportedEl.innerText = isAllYes ? '1' : '0';
  }
}

// --- In-Dashboard GIS Location Modal Logic ---
let isLocModalOpen = false;
let locMap = null;
let locMarker = null;
let streetLayer = null;
let satelliteLayer = null;

function renderModalLocVerdicts() {
  const btnModalLocYes = document.getElementById('btn-modal-loc-yes');
  const btnModalLocNo = document.getElementById('btn-modal-loc-no');
  if (!btnModalLocYes || !btnModalLocNo) return;
  const isLocYes = curLocCorrect === 'Yes' || curLocCorrect === 'YES';
  btnModalLocYes.className = `toggle-btn yes ${isLocYes ? 'active' : ''}`;
  btnModalLocNo.className = `toggle-btn no ${!isLocYes ? 'active' : ''}`;
}

function openLocationModal() {
  if (!currentQueue || currentQueue.length === 0 || currentIndex >= currentQueue.length) return;
  const rec = currentQueue[currentIndex];

  const modal = document.getElementById('locationModal');
  if (!modal) return;

  isLocModalOpen = true;
  modal.style.display = 'flex';

  document.getElementById('loc-modal-sno').innerText = `S.NO ${rec.sNo}`;
  document.getElementById('loc-modal-type').innerText = rec.defectType;
  
  const hasValidCoords = (rec.startLat && rec.startLon && !isNaN(rec.startLat) && !isNaN(rec.startLon) && (rec.startLat !== 0 || rec.startLon !== 0));
  
  if (hasValidCoords) {
    document.getElementById('loc-modal-coords').innerText = `${rec.startLat.toFixed(5)}, ${rec.startLon.toFixed(5)}`;
  } else {
    document.getElementById('loc-modal-coords').innerText = 'No Coordinates';
  }
  document.getElementById('loc-modal-chainage').innerText = `Ch: ${rec.chainage || '—'}`;
  document.getElementById('loc-modal-direction').innerText = `${rec.roadType} ${rec.direction} (${rec.lane || 'Lane 1'})`;

  renderModalLocVerdicts();

  const mapEl = document.getElementById('defect-map');
  const noCoordsEl = document.getElementById('loc-map-no-coords');

  if (hasValidCoords) {
    mapEl.style.display = 'block';
    noCoordsEl.style.display = 'none';

    if (!locMap) {
      locMap = L.map('defect-map', {
        center: [rec.startLat, rec.startLon],
        zoom: 17,
        zoomControl: true
      });

      streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(locMap);

      satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 19
      });
    } else {
      locMap.setView([rec.startLat, rec.startLon], 17);
    }

    const pulsingIcon = L.divIcon({
      className: 'pulsing-pin-custom',
      html: '<div class="pulsing-pin-wrap"><div class="pulsing-pin-ring"></div><div class="pulsing-pin-center"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    if (!locMarker) {
      locMarker = L.marker([rec.startLat, rec.startLon], { icon: pulsingIcon }).addTo(locMap);
    } else {
      locMarker.setLatLng([rec.startLat, rec.startLon]);
      if (!locMap.hasLayer(locMarker)) locMarker.addTo(locMap);
    }

    locMarker.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif; font-size:12px; line-height:1.4;">
        <strong style="color:#0f172a; font-size:13px;">S.No ${rec.sNo}: ${rec.defectType}</strong><br>
        <span style="color:#0284c7; font-weight:700;">${rec.roadType} ${rec.direction} (Lane ${rec.lane || '1'})</span><br>
        <span style="color:#64748b;">Chainage: ${rec.chainage}</span><br>
        <span style="color:#475569; font-family:monospace; font-size:11px;">GPS: ${rec.startLat.toFixed(5)}, ${rec.startLon.toFixed(5)}</span>
      </div>
    `).openPopup();

    setTimeout(() => {
      if (locMap) locMap.invalidateSize();
    }, 120);
  } else {
    mapEl.style.display = 'none';
    noCoordsEl.style.display = 'flex';
  }
}

function closeLocationModal() {
  isLocModalOpen = false;
  const modal = document.getElementById('locationModal');
  if (modal) modal.style.display = 'none';
}

function toggleLocationModal() {
  if (isLocModalOpen) {
    closeLocationModal();
  } else {
    openLocationModal();
  }
}

function openFullGisDashboard() {
  if (!currentQueue || currentQueue.length === 0 || currentIndex >= currentQueue.length) return;
  const rec = currentQueue[currentIndex];
  const query = `?spreadsheetId=${encodeURIComponent(currentSpreadsheetId)}&sheetName=${encodeURIComponent(currentSheetName)}&sNo=${encodeURIComponent(rec.sNo)}&defectId=${encodeURIComponent(rec.defectId || '')}`;
  chrome.tabs.create({ url: chrome.runtime.getURL(`location_verification.html${query}`) });
}

function updateIdentifiedReportUI() {
  const refBox = document.getElementById('report-ref-container');
  if (!refBox) return;

  const activeKeys = Object.keys(curIssueRefs).filter(k => curIssueRefs[k] && curIssueRefs[k].length > 0);
  
  let totalCount = 0;
  let namesArr = [];
  let allFrames = [];

  activeKeys.forEach(k => {
    const cnt = curIssueRefs[k].length;
    totalCount += cnt;
    namesArr.push(`${k} (${cnt})`);
    allFrames.push(...curIssueRefs[k]);
  });

  if (totalCount > 0) {
    refBox.style.display = 'block';
    const cntEl = document.getElementById('lbl-ident-count');
    const namesEl = document.getElementById('lbl-ident-names');
    const refsEl = document.getElementById('lbl-frame-refs');
    if (cntEl) cntEl.innerText = totalCount;
    if (namesEl) namesEl.innerText = namesArr.join(', ');
    if (refsEl) refsEl.innerText = allFrames.length > 0 ? `S.No. ${allFrames.join(', ')}` : 'None';
  } else {
    refBox.style.display = 'none';
  }
}

function renderIssueTaxonomy(filterText = '') {
  const container = document.getElementById('issue-list-container');
  if (!container) return;
  container.innerHTML = '';

  const query = (filterText || '').toLowerCase().trim();
  
  const allDisplayIssues = [...issuesTaxonomy].sort((a, b) => {
    const cA = curAdditionalCounts[a] || 0;
    const cB = curAdditionalCounts[b] || 0;
    return cB - cA;
  });

  const filtered = allDisplayIssues.filter(t => !query || t.toLowerCase().includes(query));

  let totalAdd = 0;
  Object.keys(curAdditionalCounts).forEach(k => {
    totalAdd += curAdditionalCounts[k];
  });
  const totalEl = document.getElementById('lbl-add-total');
  if (totalEl) totalEl.innerText = totalAdd;

  filtered.forEach(name => {
    const count = curAdditionalCounts[name] || 0;
    const activeRefs = (curIssueRefs && curIssueRefs[name]) || [];
    const origRefs = (origIssueRefs && origIssueRefs[name]) || [];
    const unlinkedRefs = origRefs.filter(r => !activeRefs.includes(r));

    let refBadgesHtml = '';
    if (activeRefs.length > 0 || unlinkedRefs.length > 0) {
      const activeBadges = activeRefs.map(s => {
        const linkHtml = `<a href="javascript:void(0)" class="ref-badge-link" data-ref="${s}" title="Click to open Defect #${s} in new tab">#${s}</a>`;
        return `
          <span class="ref-badge-pill" title="Active Frame #${s}">
            ${linkHtml}
            <button class="btn-unlink-ref" data-issue="${encodeURIComponent(name)}" data-ref="${s}" title="Remove Frame #${s}">×</button>
          </span>
        `;
      }).join('');

      const unlinkedBadges = unlinkedRefs.map(s => {
        return `
          <span class="ref-badge-unlinked" data-issue="${encodeURIComponent(name)}" data-ref="${s}" title="Click to restore Frame #${s}">
            + #${s}
          </span>
        `;
      }).join('');

      refBadgesHtml = `<div class="issue-badges-wrap">${activeBadges}${unlinkedBadges}</div>`;
    }

    const row = document.createElement('div');
    row.className = `issue-row ${count > 0 ? 'has-count' : ''} ${activeRefs.length > 0 ? 'has-refs' : ''}`;
    row.innerHTML = `
      <div class="issue-left">
        <span class="issue-name" title="${name}">${name}</span>
        ${refBadgesHtml}
      </div>
      <div class="counter-group">
        <button class="btn-step btn-minus" data-issue="${encodeURIComponent(name)}" title="Decrease count">−</button>
        <span class="count-display">${count}</span>
        <button class="btn-step btn-plus" data-issue="${encodeURIComponent(name)}" title="Increase count">+</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function unlinkSpecificFrame(name, ref) {
  if (!curIssueRefs[name]) return;
  const strRef = String(ref);
  const idx = curIssueRefs[name].indexOf(strRef);
  if (idx !== -1) {
    curIssueRefs[name].splice(idx, 1);
    updateIdentifiedReportUI();
    renderIssueTaxonomy(document.getElementById('issue-search')?.value || '');
  }
}

function restoreSpecificFrame(name, ref) {
  if (!curIssueRefs[name]) curIssueRefs[name] = [];
  const strRef = String(ref);
  if (!curIssueRefs[name].includes(strRef)) {
    curIssueRefs[name].push(strRef);
    const orig = origIssueRefs[name] || [];
    curIssueRefs[name].sort((a, b) => orig.indexOf(a) - orig.indexOf(b));
    updateIdentifiedReportUI();
    renderIssueTaxonomy(document.getElementById('issue-search')?.value || '');
  }
}

function stepCount(name, delta) {
  if (!curIssueRefs[name]) curIssueRefs[name] = [];
  if (!origIssueRefs[name]) origIssueRefs[name] = [];

  // 1. Synchronized Vendor Identified & Frame Unlinking Engine
  if (delta < 0 && curIssueRefs[name].length > 0) {
    curIssueRefs[name].pop(); // Unlink last frame on decrement (-)
  } else if (delta > 0 && curIssueRefs[name].length < origIssueRefs[name].length) {
    // Restore frame reference if re-incrementing previously unlinked vendor defect
    const unlinked = origIssueRefs[name].filter(r => !curIssueRefs[name].includes(r));
    if (unlinked.length > 0) {
      curIssueRefs[name].push(unlinked[0]);
      curIssueRefs[name].sort((a, b) => origIssueRefs[name].indexOf(a) - origIssueRefs[name].indexOf(b));
    }
  }

  // 2. Synchronize Auditor Additional Count Real-time
  const cur = curAdditionalCounts[name] || 0;
  const next = Math.max(0, cur + delta);

  if (next === 0) {
    delete curAdditionalCounts[name];
  } else {
    curAdditionalCounts[name] = next;
  }

  updateIdentifiedReportUI();
  renderIssueTaxonomy(document.getElementById('issue-search')?.value || '');
}

function filterIssues() {
  const text = document.getElementById('issue-search')?.value || '';
  renderIssueTaxonomy(text);
}

async function openDefectViewerOnDemand(refStr, badgeEl) {
  if (!refStr) return;
  const s = String(refStr).trim();

  // 1. If already cached in memory, open instantly in new tab
  if (urlMap[s]) {
    window.open(urlMap[s], '_blank');
    return;
  }

  // 2. Visual feedback on badge
  const origHtml = badgeEl ? badgeEl.innerHTML : '';
  if (badgeEl) badgeEl.innerHTML = `#${s} <span style="font-size:9px">⏳</span>`;

  try {
    // 3. Resolve sheet row for this S.No
    let targetRow = null;
    if (sNoToRowMap && sNoToRowMap[s]) {
      targetRow = sNoToRowMap[s];
    } else {
      const sNum = parseInt(s, 10);
      if (!isNaN(sNum) && sNum > 0 && reviewSheetMeta?.headerRow) {
        targetRow = reviewSheetMeta.headerRow + sNum;
      }
    }

    let resolvedUrl = '';
    if (targetRow && reviewSheetMeta?.colImage && reviewSheetMeta.colImage > 0) {
      if (typeof getSingleCellLinkInfo === 'function') {
        const cellInfo = await getSingleCellLinkInfo(
          currentSpreadsheetId,
          currentSheetName,
          reviewSheetMeta.colImage - 1,
          targetRow
        );
        if (cellInfo) {
          resolvedUrl = extractUrlFast_(cellInfo);
        }
      }
    }

    // 4. Robust Fallback: If cell had no explicit hyperlink, use the current active frame's viewer URL
    // (since these additional defects were matched on this exact same camera frame!)
    if (!resolvedUrl && currentActiveViewerUrl) {
      resolvedUrl = currentActiveViewerUrl;
    }

    if (resolvedUrl) {
      urlMap[s] = resolvedUrl;
      window.open(resolvedUrl, '_blank');
    } else {
      alert(`Could not find Viewer URL for Defect #${s}.`);
    }
  } catch (err) {
    console.error(`Error opening Defect #${s}:`, err);
    if (currentActiveViewerUrl) {
      window.open(currentActiveViewerUrl, '_blank');
    } else {
      alert(`Failed to load viewer for Defect #${s}: ${err.message}`);
    }
  } finally {
    if (badgeEl) badgeEl.innerHTML = origHtml || `#${s}`;
  }
}

async function saveAndNext() {
  if (!currentQueue || currentQueue.length === 0 || !currentQueue[currentIndex]) return;
  const rec = currentQueue[currentIndex];

  // 1. Process Auditor Additional Defects
  const activeKeys = Object.keys(curAdditionalCounts).filter(k => curAdditionalCounts[k] > 0);
  let totalAddCount = 0;
  const formattedParts = activeKeys.map(k => {
    totalAddCount += curAdditionalCounts[k];
    return `${k} (${curAdditionalCounts[k]})`;
  });
  const additionalNamesStr = formattedParts.join(', ');

  // 2. Process Vendor Identified & Mapped Frame Refs
  const activeIdentKeys = Object.keys(curIssueRefs).filter(k => curIssueRefs[k] && curIssueRefs[k].length > 0);
  let updatedIdentCount = 0;
  let identNamesParts = [];
  let updatedFrameRefsArr = [];

  activeIdentKeys.forEach(k => {
    const cnt = curIssueRefs[k].length;
    updatedIdentCount += cnt;
    identNamesParts.push(`${k} (${cnt})`);
    updatedFrameRefsArr.push(...curIssueRefs[k]);
  });

  const updatedIdentNamesStr = identNamesParts.join(', ');
  const updatedFrameRefStr = updatedFrameRefsArr.join(', ');

  const payload = {
    sheetRow: rec.sheetRow,
    saveMode: currentMode,
    visible: curVisible,
    typeCorrect: curTypeCorrect,
    locCorrect: curLocCorrect,
    additionalCount: totalAddCount,
    additionalNames: additionalNamesStr,
    updatedIdentCount: updatedIdentCount,
    updatedIdentNames: updatedIdentNamesStr,
    updatedFrameRef: updatedFrameRefStr
  };

  // 3. Instant Local State Update
  rec.visible = curVisible;
  rec.typeCorrect = curTypeCorrect;
  rec.locCorrect = curLocCorrect;
  rec.additionalCount = totalAddCount;
  rec.additionalNames = additionalNamesStr;
  rec.identCount = updatedIdentCount;
  rec.identNames = updatedIdentNamesStr;
  rec.frameRef = updatedFrameRefStr;
  rec.linkedIdentifiedRefs = curIssueRefs;

  if (currentMode === 'PRECISION') {
    rec.isPrecisionReviewed = true;
    rec.isFullyReviewed = (rec.isPrecisionReviewed && rec.isRecallReviewed);
  } else if (currentMode === 'RECALL') {
    rec.isRecallReviewed = true;
    rec.isFullyReviewed = (rec.isPrecisionReviewed && rec.isRecallReviewed);
  } else {
    // ALL mode: both are audited together
    rec.isPrecisionReviewed = true;
    rec.isRecallReviewed = true;
    rec.isFullyReviewed = true;
  }

  updateStats();
  showToast(`✓ S.NO ${rec.sNo} Decision Saved`);

  // 4. Asynchronous Non-Blocking Save to Google Sheet
  saveValidationReview(currentSpreadsheetId, payload, currentSheetName).catch(err => {
    console.error('Save error:', err);
    const msg = String(err.message || err);
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('RESOURCE_EXHAUSTED')) {
      showToast('⚠️ Google Sheets rate limit reached. Auto-retrying in background...', false);
    } else {
      showToast('Save error: ' + msg.slice(0, 120), false);
    }
  });

  // 5. Advance to next record
  if (currentIndex < currentQueue.length - 1) {
    currentIndex++;
    loadCurrentRecord();
  } else {
    alert('All pending items completed in this queue!');
  }
}

function navPrevious() {
  if (currentIndex > 0) {
    currentIndex--;
    loadCurrentRecord();
  }
}
