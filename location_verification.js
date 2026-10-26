/**
 * NHAI Defect Validation - Location Verification Map Controller
 * 1:1 Port of LocationVerification script to Chrome Extension (Leaflet + Google Sheets API)
 */

const LOCATION_CLUSTER_RADIUS = 22;
const DISABLE_CLUSTERING_ZOOM = 17;
const DEFAULT_INSPECT_MAX_ZOOM = 16;

let allDefects = [];
let currentVisibleBounds = [];
let map, markersCluster, nonClusterGroup, densityLayerGroup, progressionLayer;
let showProgression = false;
let isClusteringEnabled = true;
let isDensityEnabled = false;
let isInitialLoad = true;

let currentSpreadsheetId = '';
let currentSheetName = 'Defects Log';

document.addEventListener('DOMContentLoaded', async () => {
  // Parse URL search params
  const params = new URLSearchParams(window.location.search);
  currentSpreadsheetId = params.get('spreadsheetId') || '';
  currentSheetName = params.get('sheetName') || 'Defects Log';

  // Fallback to storage if not in URL
  if (!currentSpreadsheetId) {
    const saved = await chrome.storage.local.get(['lastSpreadsheetId', 'lastSheetName']);
    if (saved.lastSpreadsheetId) currentSpreadsheetId = saved.lastSpreadsheetId;
    if (saved.lastSheetName) currentSheetName = saved.lastSheetName;
  }

  // Live cluster check on session boot (Does NOT run during in-flight map usage)
  if (typeof syncClusterSession === 'function') {
    const cluster = await syncClusterSession('Location Map Open');
    if (!cluster.online) {
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0F172A; font-family: sans-serif; color: #FFFFFF; padding: 2rem;">
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

  initMap();
  setupEventListeners();

  if (!currentSpreadsheetId) {
    onError(new Error('No Google Spreadsheet selected. Please open the Home Command Center and select a spreadsheet.'));
    return;
  }

  loadData();
});

function setupEventListeners() {
  document.getElementById('btn-popout')?.addEventListener('click', openDedicatedFullWindow);
  document.getElementById('filter-search')?.addEventListener('input', applyFilters);
  document.getElementById('filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('filter-road')?.addEventListener('change', applyFilters);
  document.getElementById('filter-direction')?.addEventListener('change', applyFilters);
  document.getElementById('filter-severity')?.addEventListener('change', applyFilters);
  document.getElementById('filter-suspicion')?.addEventListener('change', applyFilters);

  document.getElementById('btn-cluster-toggle')?.addEventListener('click', toggleClustering);
  document.getElementById('btn-density-toggle')?.addEventListener('click', toggleDensityView);
  document.getElementById('btn-fit-selected')?.addEventListener('click', fitSelectedMarkers);
  document.getElementById('btn-reset-view')?.addEventListener('click', resetMapView);
  document.getElementById('btn-progression-toggle')?.addEventListener('click', toggleProgressionLine);

  // Event delegation for popup buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-decision');
    if (btn) {
      const isYes = btn.classList.contains('btn-yes-val');
      const isNo = btn.classList.contains('btn-no-val');
      const card = btn.closest('.review-card');
      if (card && (isYes || isNo)) {
        const sheetRow = parseInt(card.getAttribute('data-sheet-row'), 10);
        submitLocationDecision(sheetRow, isYes ? 'Yes' : 'No', btn);
      }
    }
  });
}

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([22.5937, 78.9629], 5);

  // OpenStreetMap Standard Tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors | NHAI RAMS QA'
  }).addTo(map);

  markersCluster = L.markerClusterGroup({
    maxClusterRadius: LOCATION_CLUSTER_RADIUS,
    disableClusteringAtZoom: DISABLE_CLUSTERING_ZOOM,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,
    animate: true,
    iconCreateFunction: function(cluster) {
      const markers = cluster.getAllChildMarkers();
      let hasSuspicious = false;
      let hasReview = false;

      for (let i = 0; i < markers.length; i++) {
        const d = markers[i].defectData;
        if (d) {
          if (d.suspStatus === 'Suspicious') { hasSuspicious = true; break; }
          if (d.suspStatus === 'Review') { hasReview = true; }
        }
      }

      let clusterClass = '';
      if (hasSuspicious) clusterClass = 'cluster-suspicious';
      else if (hasReview) clusterClass = 'cluster-review';

      return L.divIcon({
        html: `<div class="cluster-badge ${clusterClass}">${cluster.getChildCount()}</div>`,
        className: 'custom-cluster',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
    }
  });

  markersCluster.on('clusterclick', function(c) {
    const targetZoom = Math.min(map.getZoom() + 2, DISABLE_CLUSTERING_ZOOM);
    map.setView(c.latlng, targetZoom, { animate: true });
  });

  nonClusterGroup = L.layerGroup();
  densityLayerGroup = L.layerGroup();
  progressionLayer = L.layerGroup().addTo(map);

  map.addLayer(markersCluster);
}

async function loadData() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'flex';

  try {
    const data = await getLocationVerificationData(currentSpreadsheetId, currentSheetName);
    onDataLoaded(data);
  } catch (err) {
    onError(err);
  }
}

function onDataLoaded(data) {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  if (!data || !data.items || !data.items.length) {
    showToast("No defect records found with 'Selected for Precision Validation' = Yes in sheet.", false);
    return;
  }

  allDefects = data.items;
  renderSummary(data.summary);
  populateDefectTypeFilter(allDefects);
  applyFilters();
}

function onError(err) {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  showToast('Error loading coordinates: ' + (err.message || err), false);
  alert('Error loading location data:\n' + (err.message || err));
}

function renderSummary(sum) {
  if (!sum) return;
  document.getElementById('sum-total').innerText = sum.total || 0;
  document.getElementById('sum-mcw').innerText = sum.mcw || 0;
  document.getElementById('sum-sr').innerText = sum.sr || 0;
  document.getElementById('sum-ir').innerText = sum.ir || 0;
  document.getElementById('sum-lhs').innerText = sum.lhs || 0;
  document.getElementById('sum-rhs').innerText = sum.rhs || 0;
  document.getElementById('sum-high').innerText = sum.high || 0;
  document.getElementById('sum-normal').innerText = sum.normal || 0;
  document.getElementById('sum-review').innerText = sum.review || 0;
  document.getElementById('sum-suspicious').innerText = sum.suspicious || 0;
}

function populateDefectTypeFilter(items) {
  const select = document.getElementById('filter-type');
  if (!select) return;
  select.innerHTML = '<option value="ALL">All Categories</option>';

  const typeCounts = {};
  items.forEach(d => {
    const t = d.defectType || 'Unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  Object.keys(typeCounts).sort().forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.innerText = `${t} (${typeCounts[t]})`;
    select.appendChild(opt);
  });
}

function applyFilters() {
  const search = document.getElementById('filter-search').value.trim().toLowerCase();
  const type = document.getElementById('filter-type').value;
  const road = document.getElementById('filter-road').value;
  const dir = document.getElementById('filter-direction').value;
  const sev = document.getElementById('filter-severity').value;
  const susp = document.getElementById('filter-suspicion').value;

  markersCluster.clearLayers();
  nonClusterGroup.clearLayers();
  densityLayerGroup.clearLayers();
  progressionLayer.clearLayers();
  currentVisibleBounds = [];

  const filtered = allDefects.filter(d => {
    if (search) {
      const matchSNo = String(d.sNo || '').toLowerCase().includes(search);
      const matchId = String(d.defectId || '').toLowerCase().includes(search);
      const matchType = String(d.defectType || '').toLowerCase().includes(search);
      if (!matchSNo && !matchId && !matchType) return false;
    }
    if (type !== 'ALL' && d.defectType !== type) return false;
    if (road !== 'ALL') {
      if (road === 'MCW' && (d.roadType.includes('SR') || d.roadType.includes('IR'))) return false;
      if (road === 'SR' && (!d.roadType.includes('SR') && !d.roadType.includes('SERVICE'))) return false;
      if (road === 'IR' && (!d.roadType.includes('IR') && !d.roadType.includes('INTERCHANGE'))) return false;
    }
    if (dir !== 'ALL' && d.direction !== dir) return false;
    if (sev !== 'ALL') {
      const sUpper = (d.severity || '').toUpperCase();
      if (!sUpper.includes(sev)) return false;
    }
    if (susp !== 'ALL' && d.suspStatus !== susp) return false;

    return true;
  });

  const bounds = [];
  const progressionPoints = [];
  const targetContainer = isClusteringEnabled ? markersCluster : nonClusterGroup;

  filtered.forEach(d => {
    if (!d.startLat || !d.startLon) return;

    bounds.push([d.startLat, d.startLon]);
    if (d.chainageMeters > 0) {
      progressionPoints.push({ lat: d.startLat, lon: d.startLon, ch: d.chainageMeters });
    }

    let pinColor = '#10b981';
    if (d.suspStatus === 'Review') pinColor = '#f59e0b';
    if (d.suspStatus === 'Suspicious') pinColor = '#ef4444';

    const customIcon = L.divIcon({
      className: 'custom-pin-node',
      html: `<div class="marker-pin-svg" style="background-color:${pinColor};"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([d.startLat, d.startLon], { icon: customIcon });
    marker.defectData = d;

    marker.bindTooltip(`S.No ${d.sNo}: ${d.defectType}`, {
      direction: 'top',
      offset: [0, -7],
      className: 'marker-hover-tooltip'
    });

    marker.bindPopup(() => {
      const freshItem = allDefects.find(item => item.sheetRow === d.sheetRow) || d;
      return buildReviewCard(freshItem);
    }, {
      maxWidth: 360,
      className: 'leaflet-popup-custom',
      autoPan: true
    });

    marker.on('click', function() {
      const currZ = map.getZoom();
      map.setView([d.startLat, d.startLon], Math.max(currZ, 15), { animate: true });
    });

    targetContainer.addLayer(marker);

    if (isDensityEnabled) {
      const densityCircle = L.circleMarker([d.startLat, d.startLon], {
        radius: 16,
        fillColor: pinColor,
        fillOpacity: 0.22,
        stroke: false
      });
      densityLayerGroup.addLayer(densityCircle);
    }

    if (d.isLength && d.endLat && d.endLon) {
      const line = L.polyline([[d.startLat, d.startLon], [d.endLat, d.endLon]], {
        color: pinColor,
        weight: 3,
        opacity: 0.85,
        dashArray: '4, 4'
      });
      targetContainer.addLayer(line);
    }
  });

  currentVisibleBounds = bounds;

  if (showProgression && progressionPoints.length > 1) {
    progressionPoints.sort((a, b) => a.ch - b.ch);
    const polyline = L.polyline(progressionPoints.map(p => [p.lat, p.lon]), {
      color: '#0284c7',
      weight: 2,
      opacity: 0.7,
      dashArray: '6, 6'
    });
    progressionLayer.addLayer(polyline);
  }

  // Deep-link auto focus if sNo or defectId is passed in URL
  const urlParams = new URLSearchParams(window.location.search);
  const targetSNo = urlParams.get('sNo');
  const targetDefectId = urlParams.get('defectId');
  if (isInitialLoad && (targetSNo || targetDefectId)) {
    const targetDefect = allDefects.find(d => 
      (targetSNo && String(d.sNo) === String(targetSNo)) ||
      (targetDefectId && String(d.defectId) === String(targetDefectId))
    );
    if (targetDefect && targetDefect.startLat && targetDefect.startLon) {
      map.setView([targetDefect.startLat, targetDefect.startLon], 18);
      setTimeout(() => {
        markersCluster.eachLayer(m => {
          if (m.defectData && (
            (targetSNo && String(m.defectData.sNo) === String(targetSNo)) ||
            (targetDefectId && String(m.defectData.defectId) === String(targetDefectId))
          )) {
            if (markersCluster.hasLayer(m)) {
              markersCluster.zoomToShowLayer(m, () => { m.openPopup(); });
            } else {
              m.openPopup();
            }
          }
        });
      }, 350);
      isInitialLoad = false;
      return;
    }
  }

  if (isInitialLoad && currentVisibleBounds.length > 0) {
    fitSelectedMarkers();
    isInitialLoad = false;
  }
}

function buildReviewCard(d) {
  const isYes = (d.locationCorrect === 'Yes');
  const isNo = (d.locationCorrect === 'No');

  let badgeStatusText = '<span style="color:#64748b">Status: Pending Review</span>';
  if (isYes) badgeStatusText = '<span style="color:#15803d">✓ Validated: Yes</span>';
  if (isNo) badgeStatusText = '<span style="color:#b91c1c">✗ Validated: No</span>';

  const latDisplay = d.startLat ? d.startLat.toFixed(6) : 'N/A';
  const lonDisplay = d.startLon ? d.startLon.toFixed(6) : 'N/A';

  return `
    <div class="review-card" data-sheet-row="${d.sheetRow}">
      <div class="review-card-header">
        <div>
          <span class="card-sno">S.No. ${d.sNo}</span>
          <span class="card-id">${d.defectId}</span>
        </div>
        <span class="card-badge badge-sev-${d.severity}">${d.severity}</span>
      </div>

      <div class="card-title">${d.defectType}</div>

      <table class="card-specs-table">
        <tr><td class="spec-label">Chainage</td><td class="spec-value">${d.startChainageRaw} (Km ${d.startChainage.toFixed(3)})</td></tr>
        <tr><td class="spec-label">Corridor Context</td><td class="spec-value">${d.roadType} | ${d.direction} | ${d.lane}</td></tr>
        <tr><td class="spec-label">GPS Fix</td><td class="spec-value">${latDisplay}, ${lonDisplay}</td></tr>
      </table>

      <div class="status-alert status-alert-${d.suspStatus}">
        <strong>${d.suspStatus}:</strong> ${d.suspReason}
      </div>

      <div class="action-links">
        ${d.imageUrl ? `<a href="${d.imageUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-primary">Open Defect Viewer</a>` : ''}
        ${d.gmapsUrl ? `<a href="${d.gmapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-secondary">Google Satellite</a>` : ''}
      </div>

      <div class="decision-container">
        <div class="decision-label">
          <span>Location Correct Verification</span>
          <span id="badge-status-${d.sheetRow}" style="font-size:10px; font-weight:800;">
            ${badgeStatusText}
          </span>
        </div>
        <div class="decision-btn-group">
          <button class="btn-decision btn-yes-val ${isYes ? 'active' : ''}">Yes</button>
          <button class="btn-decision btn-no-val ${isNo ? 'active' : ''}">No</button>
        </div>
        <div id="feedback-row-${d.sheetRow}" class="card-save-feedback ${isYes ? 'save-success-Yes' : (isNo ? 'save-success-No' : '')}">
          ${isYes ? '✓ Saved: Location marked as YES in Sheet' : (isNo ? '✗ Saved: Location marked as NO in Sheet' : '')}
        </div>
      </div>
    </div>
  `;
}

async function submitLocationDecision(sheetRow, decision, btn) {
  const container = btn.closest('.decision-btn-group');
  const yesBtn = container.querySelector('.btn-yes-val');
  const noBtn = container.querySelector('.btn-no-val');
  const card = btn.closest('.review-card');
  const feedbackEl = card.querySelector(`#feedback-row-${sheetRow}`);
  const badgeStatus = card.querySelector(`#badge-status-${sheetRow}`);

  const prevText = btn.innerText;
  btn.innerText = '...';

  const item = allDefects.find(d => d.sheetRow === sheetRow);
  if (item) item.locationCorrect = decision;

  if (decision === 'Yes') {
    yesBtn.classList.add('active');
    noBtn.classList.remove('active');
    if (badgeStatus) badgeStatus.innerHTML = '<span style="color:#15803d">✓ Validated: Yes</span>';
    if (feedbackEl) {
      feedbackEl.className = 'card-save-feedback save-success-Yes';
      feedbackEl.innerHTML = '✓ Saved: Location marked as YES in Sheet';
    }
    showToast(`✓ S.No ${item ? item.sNo : ''} Location Marked as YES`);
  } else {
    noBtn.classList.add('active');
    yesBtn.classList.remove('active');
    if (badgeStatus) badgeStatus.innerHTML = '<span style="color:#b91c1c">✗ Validated: No</span>';
    if (feedbackEl) {
      feedbackEl.className = 'card-save-feedback save-success-No';
      feedbackEl.innerHTML = '✗ Saved: Location marked as NO in Sheet';
    }
    showToast(`✗ S.No ${item ? item.sNo : ''} Location Marked as NO`);
  }

  try {
    await updateLocationCorrectness(currentSpreadsheetId, sheetRow, decision, currentSheetName);
    btn.innerText = prevText;
  } catch (err) {
    btn.innerText = prevText;
    if (feedbackEl) {
      feedbackEl.className = 'card-save-feedback save-success-No';
      feedbackEl.innerText = 'Error: ' + (err.message || err);
    }
    showToast('Error saving: ' + (err.message || err), false);
  }
}

function fitSelectedMarkers() {
  if (currentVisibleBounds.length > 0) {
    map.fitBounds(L.latLngBounds(currentVisibleBounds), { padding: [50, 50], maxZoom: 16 });
  }
}

function resetMapView() {
  document.getElementById('filter-search').value = '';
  document.getElementById('filter-type').value = 'ALL';
  document.getElementById('filter-road').value = 'ALL';
  document.getElementById('filter-direction').value = 'ALL';
  document.getElementById('filter-severity').value = 'ALL';
  document.getElementById('filter-suspicion').value = 'ALL';
  applyFilters();
  fitSelectedMarkers();
}

function toggleClustering() {
  isClusteringEnabled = !isClusteringEnabled;
  const btn = document.getElementById('btn-cluster-toggle');
  if (isClusteringEnabled) {
    map.removeLayer(nonClusterGroup);
    map.addLayer(markersCluster);
    btn.classList.add('active');
    btn.innerText = 'Cluster: ON';
  } else {
    map.removeLayer(markersCluster);
    map.addLayer(nonClusterGroup);
    btn.classList.remove('active');
    btn.innerText = 'Cluster: OFF';
  }
  applyFilters();
}

function toggleDensityView() {
  isDensityEnabled = !isDensityEnabled;
  const btn = document.getElementById('btn-density-toggle');
  if (isDensityEnabled) {
    map.addLayer(densityLayerGroup);
    btn.classList.add('active');
    btn.innerText = 'Halo: ON';
  } else {
    map.removeLayer(densityLayerGroup);
    btn.classList.remove('active');
    btn.innerText = 'Halo: OFF';
  }
  applyFilters();
}

function toggleProgressionLine() {
  showProgression = !showProgression;
  const btn = document.getElementById('btn-progression-toggle');
  if (showProgression) {
    map.addLayer(progressionLayer);
    btn.classList.add('active');
    btn.innerText = 'Progression Path: ON';
  } else {
    map.removeLayer(progressionLayer);
    btn.classList.remove('active');
    btn.innerText = 'Progression Path: OFF';
  }
  applyFilters();
}

function openDedicatedFullWindow() {
  window.open(window.location.href, '_blank', 'width=1600,height=1000');
}

function showToast(msg, isSuccess = true) {
  const toast = document.getElementById('global-toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.style.background = isSuccess ? '#15803d' : '#b91c1c';
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3200);
}
