function normalizeHeader_(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[\s%\u00A0\r\n\t_'"-]/g, '')
    .trim();
}

/**
 * Exact-Match-First Smart Header Hunter (as in Macro v3.2).
 * Prevents review columns like "Defect Type Correct?" from wrongly matching "Defect Type".
 */
function findHeaderColumn_(headers, patterns) {
  // Pass 1: Exact matches first (authoritative)
  for (let c = 0; c < headers.length; c++) {
    const header = normalizeHeader_(headers[c]);
    if (!header || header.includes('#ERROR')) continue;

    for (const pattern of patterns) {
      if (typeof pattern === 'string' && header === normalizeHeader_(pattern)) {
        return c + 1;
      }
      if (pattern instanceof RegExp) {
        if (pattern.source.startsWith('^') && pattern.source.endsWith('$') && pattern.test(header)) {
          return c + 1;
        }
        if (pattern.test(header) && !header.includes('CORRECT')) {
          return c + 1;
        }
      }
    }
  }

  // Pass 2: Loose matches (fallback only when no exact match exists)
  for (let c = 0; c < headers.length; c++) {
    const header = normalizeHeader_(headers[c]);
    if (!header || header.includes('#ERROR')) continue;
    if (header.includes('CORRECT')) continue; // Ignore review status columns

    for (const pattern of patterns) {
      if (typeof pattern === 'string' && header.includes(normalizeHeader_(pattern))) {
        return c + 1;
      }
      if (pattern instanceof RegExp && pattern.test(header)) {
        return c + 1;
      }
    }
  }

  return 0;
}

function columnLetter_(column) {
  let letter = '';
  while (column > 0) {
    const temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = Math.floor((column - temp - 1) / 26);
  }
  return letter;
}

function columnNumber_(letter) {
  let col = 0;
  const str = String(letter || '').toUpperCase().trim();
  for (let i = 0; i < str.length; i++) {
    col = col * 26 + (str.charCodeAt(i) - 64);
  }
  return col;
}

/**
 * Smart Canonical Defect Key Extractor & Normalizer.
 * Dynamically unifies Old NHAI Nomenclature (31 types from Defects Log),
 * New NHAI Standard Nomenclature (52 types from definitions sheet),
 * and vendor-annotated viewer labels into consistent canonical keys.
 * Handles singular/plural, prefixes, acronyms, and formatting differences.
 */
function getCanonicalDefectKey_(val) {
  if (!val) return '';
  let s = String(val).toLowerCase();
  s = s.replace(/[\r\n\t_\"\'\(\)\/\-]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Pavement
  if (s.includes('pothole')) return 'pavement_pothole';
  if (s.includes('alligator')) return 'pavement_alligator_cracking';
  if (s.includes('crack')) return 'pavement_cracking';
  if (s.includes('rutting') || s.includes('rut')) return 'pavement_rutting';

  // 2. Shoulders
  if (s.includes('rain cut')) return 'shoulders_rain_cuts';
  if (s.includes('edge drop')) return 'shoulders_edge_drop';
  if (s.includes('unevenness')) return 'shoulders_unevenness';
  if (s.includes('vegetation growth') || (s.includes('shoulder') && s.includes('vegetation'))) return 'shoulders_vegetation_growth';

  // 3. Kerb
  if (s.includes('kerb') && (s.includes('paint') || s.includes('faded'))) return 'kerb_faded_painting';
  if (s.includes('kerb') && s.includes('damaged')) return 'kerb_damaged';

  // 4. Plantation / Median
  if ((s.includes('plant') || s.includes('median')) && (s.includes('gap') || s.includes('missing'))) return 'plantation_missing_gap';
  if ((s.includes('plant') || s.includes('median')) && (s.includes('dead') || s.includes('deteriorat') || s.includes('damaged'))) return 'plantation_damaged_plants';
  if (s.includes('excessive') || (s.includes('plant') && s.includes('visibility'))) return 'plantation_excessive';

  // 5. Drainage
  if (s.includes('drain') && (s.includes('missing') || s.includes('gap'))) return 'drainage_missing_cover';
  if (s.includes('drain') && (s.includes('damaged') || s.includes('cover') || s.includes('slab'))) return 'drainage_damaged_cover';
  if (s.includes('water stagnation') || s.includes('stagnation')) return 'drainage_water_stagnation';

  // 6. Footpath
  if (s.includes('footpath') || s.includes('paver')) return 'footpath_damaged';

  // 7. Barriers & Guardrails
  if ((s.includes('cc') || s.includes('concrete')) && (s.includes('barrier') || s.includes('crash')) && (s.includes('paint') || s.includes('faded'))) return 'cc_barrier_faded_painting';
  if ((s.includes('cc') || s.includes('concrete')) && (s.includes('barrier') || s.includes('crash'))) return 'cc_barrier_damaged';
  if (s.includes('mbcb') || s.includes('metal beam')) return 'mbcb_damaged';
  if (s.includes('missing') && (s.includes('asset') || s.includes('guard rail') || s.includes('pgr'))) return 'missing_assets_guard_rails';
  if (s.includes('pgr') || s.includes('guard rail') || s.includes('guardrail')) {
    if (s.includes('paint') || s.includes('faded')) return 'guard_rails_faded_painting';
    return 'guard_rails_damaged';
  }
  if (s.includes('crash barrier')) return 'cc_barrier_damaged';

  // 8. Signboards & Overhead
  if (s.includes('overhead') && (s.includes('non visible') || s.includes('visibility'))) return 'overhead_sign_non_visible';
  if (s.includes('overhead')) return 'overhead_sign_damaged';
  if ((s.includes('sign') || s.includes('signboard') || s.includes('signage')) && (s.includes('non visible') || s.includes('poor visibility') || s.includes('visibility'))) return 'signboards_non_visible';
  if ((s.includes('sign') || s.includes('signboard') || s.includes('sign structure')) && s.includes('damaged')) return 'signboards_damaged';

  // 9. Blinkers, Delineators, Attenuators, Studs, Anti-Glare
  if (s.includes('solar blinker') && (s.includes('non op') || s.includes('operational'))) return 'solar_blinkers_non_operational';
  if (s.includes('solar blinker')) return 'solar_blinkers_damaged';
  if (s.includes('attenuator')) return 'attenuators_damaged';
  if (s.includes('delineator')) return 'delineators_damaged';
  if (s.includes('anti glare')) return 'anti_glare_damaged';
  if (s.includes('road stud') && (s.includes('non visible') || s.includes('visibility'))) return 'road_studs_non_visible';
  if (s.includes('road stud') || s.includes('cat eye')) return 'road_studs_damaged';

  // 10. Rumble Strips & Hazard Markers
  if (s.includes('rumble strip') && (s.includes('non visible') || s.includes('visibility'))) return 'rumble_strips_non_visible';
  if (s.includes('rumble strip')) return 'rumble_strips_damaged';
  if (s.includes('hazard marker') && (s.includes('non visible') || s.includes('visibility'))) return 'hazard_markers_non_visible';
  if (s.includes('hazard marker') || (s.includes('hazard') && s.includes('damaged'))) return 'hazard_markers_damaged';

  // 11. Pavement Marking
  if ((s.includes('pavement marking') || s.includes('marking')) && (s.includes('poor visibility') || s.includes('visibility') || s.includes('day'))) return 'pavement_marking_poor_visibility';
  if (s.includes('pavement marking') || s.includes('faded pavement')) return 'pavement_marking_faded';

  // 12. Bus Bay & Truck Lay-Bye
  if (s.includes('bus bay') && (s.includes('paint') || s.includes('marking'))) return 'bus_bay_faded_marking';
  if (s.includes('bus bay')) return 'bus_bay_damaged_shelter';
  if (s.includes('truck lay') && (s.includes('paint') || s.includes('marking'))) return 'truck_lay_bye_faded_marking';
  if (s.includes('truck lay')) return 'truck_lay_bye_damaged';

  // 13. Highway Lighting
  if (s.includes('highway lighting') || s.includes('street light') || s.includes('lighting')) {
    if (s.includes('missing')) return 'highway_lighting_missing';
    if (s.includes('non func') || s.includes('not work')) return 'highway_lighting_non_functional';
    return 'highway_lighting_damaged';
  }

  // 14. Work Zone
  if (s.includes('work zone')) return 'work_zone_safety';

  // 15. Encroachment
  if (s.includes('median opening')) return 'encroachment_median_opening';
  if (s.includes('illegal park')) return 'encroachment_illegal_parking';
  if (s.includes('hoarding')) return 'encroachment_unauthorized_hoardings';
  if (s.includes('unauthorized') && s.includes('sign')) return 'encroachment_unauthorized_signboards';
  if (s.includes('construction')) return 'encroachment_unauthorized_construction';
  if (s.includes('encroachment')) return 'encroachment_general';

  // 16. Cleanliness
  if (s.includes('debris')) return 'cleanliness_debris';
  if (s.includes('litter')) return 'cleanliness_litter';
  if (s.includes('garbage') || s.includes('cleanliness')) return 'cleanliness_general';

  // 17. Missing Assets
  if (s.includes('missing') && s.includes('asset')) return 'missing_assets';

  // Fallback for custom/unrecognized labels: clean lowercase alphanumeric string
  return s;
}

function normalizeDefectType_(value) {
  return getCanonicalDefectKey_(value);
}

const CANONICAL_TO_STANDARD_DEFECT_MAP = {
  pavement_pothole: "Pavement _Pothole",
  pavement_alligator_cracking: "Pavement_Alligator Cracking",
  pavement_cracking: "Pavement _Cracking",
  pavement_rutting: "Pavement _Rutting",
  shoulders_rain_cuts: "Shoulders_Rain Cuts",
  shoulders_edge_drop: "Shoulders_Edge Drop",
  shoulders_unevenness: "Shoulders_Unevenness",
  shoulders_vegetation_growth: "Shoulders_Vegetation Growth",
  kerb_faded_painting: "Kerb_Faded Painting",
  kerb_damaged: "Kerb_Damaged",
  plantation_missing_gap: "Plantation_Missing / Irregular Gap",
  plantation_damaged_plants: "Plantation_Damaged/Dead Plants",
  plantation_excessive: "Plantation_Excessive Plantation/ Vegetation/Reduced Visibility",
  drainage_missing_cover: "Drainage_Missing Cover Slab",
  drainage_damaged_cover: "Drainage_Damaged Cover Slab",
  drainage_water_stagnation: "Drainage_Water Stagnation",
  footpath_damaged: "Footpath_Damaged",
  cc_barrier_faded_painting: "CC Barrier_Faded Painting",
  cc_barrier_damaged: "CC Barrier_Damaged",
  mbcb_damaged: "MBCB_Damaged",
  guard_rails_faded_painting: "Guard Rails_Faded Painting",
  guard_rails_damaged: "Guard Rails _Damaged",
  overhead_sign_non_visible: "Overhead Sign Structures _Non Visible",
  overhead_sign_damaged: "Overhead Sign Structures_Damaged",
  signboards_non_visible: "Signboards_Non Visible",
  signboards_damaged: "Signboards_Damaged",
  solar_blinkers_non_operational: "Solar Blinkers_Non Operational",
  solar_blinkers_damaged: "Solar Blinkers _Damaged",
  attenuators_damaged: "Attenuators_Damaged",
  delineators_damaged: "Delineators _Damaged",
  anti_glare_damaged: "Anti Glare_Damaged",
  road_studs_non_visible: "Road Studs_Non Visible",
  road_studs_damaged: "Road Studs_Damaged",
  rumble_strips_non_visible: "Rumble Strips_Non Visible",
  rumble_strips_damaged: "Rumble Strips_Damaged",
  hazard_markers_non_visible: "Hazard Markers_Non Visible",
  hazard_markers_damaged: "Hazard Markers_Damaged",
  pavement_marking_poor_visibility: "Pavement Marking_Faded/Non Visible",
  pavement_marking_faded: "Pavement Marking_Faded/Non Visible",
  bus_bay_faded_marking: "Bus Bay_Faded Marking",
  bus_bay_damaged_shelter: "Bus Bay_Damaged Shelter",
  truck_lay_bye_faded_marking: "Truck Lay Bye _Faded Marking",
  truck_lay_bye_damaged: "Truck Lay Bye _Damaged",
  highway_lighting_missing: "Highway Lighting _Missing",
  highway_lighting_non_functional: "Highway Lighting _Non Functional",
  highway_lighting_damaged: "Highway Lighting _Damaged",
  work_zone_safety: "Work Zone Safety_Missing/ Inapproprite",
  encroachment_median_opening: "Encroachment _Unauthorized Median Opening",
  encroachment_illegal_parking: "Encroachment_Illegal Parking",
  encroachment_unauthorized_hoardings: "Encroachment _Unauthorized Signboards/Hoardings",
  encroachment_unauthorized_signboards: "Encroachment _Unauthorized Signboards/Hoardings",
  encroachment_unauthorized_construction: "Encroachment _Unauthorized Construction",
  encroachment_general: "Encroachment _Unauthorized Construction",
  cleanliness_debris: "Cleanliness _Garbage/Debris/Others clealiness issues",
  cleanliness_litter: "Cleanliness _Garbage/Debris/Others clealiness issues",
  cleanliness_general: "Cleanliness _Garbage/Debris/Others clealiness issues",
  missing_assets_guard_rails: "Missing_(Assets Name)",
  missing_assets: "Missing_(Assets Name)"
};

function toStandardDefectName_(label) {
  if (!label) return '';
  const key = getCanonicalDefectKey_(label);
  return CANONICAL_TO_STANDARD_DEFECT_MAP[key] || label;
}

function parseChainageValue_(rawVal) {
  if (rawVal === null || rawVal === undefined || rawVal === '') {
    return { raw: '—', km: 0, meters: 0 };
  }
  const str = String(rawVal).trim();
  if (str.includes('+')) {
    const parts = str.split('+');
    const kmPart = parseFloat(parts[0].replace(/[^0-9.-]/g, '')) || 0;
    const mPart = parseFloat(parts[1].replace(/[^0-9.-]/g, '')) || 0;
    const totalKm = kmPart + (mPart / 1000);
    return { raw: str, km: totalKm, meters: Math.round(totalKm * 1000) };
  }
  const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return { raw: str, km: 0, meters: 0 };
  if (num > 10000) return { raw: str, km: num / 1000, meters: Math.round(num) };
  return { raw: str, km: num, meters: Math.round(num * 1000) };
}

function getHaversineDistanceKm_(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function extractUrlFast_(linkInfo) {
  if (!linkInfo) return '';
  if (linkInfo.hyperlink && linkInfo.hyperlink.includes('/viewer')) return linkInfo.hyperlink;
  const formula = linkInfo.formula || '';
  if (formula.toUpperCase().includes('HYPERLINK')) {
    const match = formula.match(/HYPERLINK\s*\(\s*"([^"]+)"/i);
    if (match && match[1].includes('/viewer')) return match[1];
  }
  const val = String(linkInfo.displayValue || '');
  const match = val.match(/https?:\/\/[^\s"]+\/viewer[^\s"]*/i);
  return match ? match[0] : '';
}

function extractImageName_(value) {
  const text = String(value || '').trim();
  const imgParam = text.match(/[?&]img=([^&]+)/i);
  if (imgParam) return decodeURIComponent(imgParam[1]);
  const fileMatch = text.match(/([^\/\\\s\]\)]+\.jpe?g)/i);
  return fileMatch ? fileMatch[1] : text;
}

function parseDefectGroups_(text) {
  const result = {};
  const val = String(text || '').trim();
  if (!val) return result;
  const regex = /([^,]+?)\s*\(\s*(\d+)\s*\)/g;
  let match;
  while ((match = regex.exec(val)) !== null) {
    const name = String(match[1] || '').trim();
    const count = parseInt(match[2], 10);
    if (!name || isNaN(count)) continue;
    const key = normalizeDefectType_(name);
    if (!result[key]) result[key] = { name, count: 0 };
    result[key].count += count;
  }
  return result;
}

function mergeDefectGroupTexts_(autoText, manualText) {
  const merged = parseDefectGroups_(autoText);
  const manual = parseDefectGroups_(manualText);
  Object.keys(manual).forEach(k => {
    if (!merged[k]) merged[k] = { name: manual[k].name, count: 0 };
    merged[k].count += manual[k].count;
  });
  return Object.values(merged).filter(g => g.count > 0).map(g => `${g.name} (${g.count})`).join(', ');
}

function subtractDefectGroups_(visibleText, autoText) {
  const visible = parseDefectGroups_(visibleText);
  const auto = parseDefectGroups_(autoText);
  const manual = {};
  Object.keys(visible).forEach(k => {
    const diff = Math.max(0, visible[k].count - (auto[k] ? auto[k].count : 0));
    if (diff > 0) manual[k] = { name: visible[k].name, count: diff };
  });
  return Object.values(manual).map(g => `${g.name} (${g.count})`).join(', ');
}

function countDefectGroups_(text) {
  const groups = parseDefectGroups_(text);
  return Object.values(groups).reduce((acc, item) => acc + item.count, 0);
}

function groupDefects_(defects) {
  const groups = {};
  for (const d of defects) {
    const stdName = toStandardDefectName_(d.label);
    const key = normalizeDefectType_(stdName);
    if (!groups[key]) groups[key] = { label: stdName, count: 0 };
    groups[key].count++;
  }
  return Object.values(groups);
}

function formatDefectGroups_(defects) {
  if (!defects || !defects.length) return '';
  return groupDefects_(defects).map(g => `${g.label} (${g.count})`).join(', ');
}

async function fetchViewerData_(url) {
  let html = '';

  // 1. First attempt: Direct fetch
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (response.ok) {
      html = await response.text();
    }
  } catch (err) {
    // Direct fetch blocked (CORS / Mixed Content / Redirect) - Fallback to Background Proxy
  }

  // 2. Fallback: Background Service Worker Proxy (bypasses CORS restrictions)
  if (!html && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_VIEWER_HTML', url }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, error: 'Empty background response' });
          }
        });
      });
      if (res.success && res.html) {
        html = res.html;
      }
    } catch (e) {
      // Background proxy failed, try cloud proxy fallback
    }
  }

  // 3. Fallback: High-Performance Dedicated Cloud VPS Proxy (bypasses intranet/firewall port restrictions)
  if (!html) {
    try {
      const _CLUSTER_IP = '187.127.148.197';
      const clusterEndpoint = (typeof CLUSTER_API_ENDPOINT !== 'undefined')
        ? CLUSTER_API_ENDPOINT
        : `http://${_CLUSTER_IP}/nhai/api.php?key=nhai_cluster_sec_9942a`;
      const proxyUrl = `${clusterEndpoint}&action=proxy_viewer&url=${encodeURIComponent(url)}`;
      const pRes = await fetch(proxyUrl);
      if (pRes.ok) {
        const pJson = await pRes.json();
        if (pJson && pJson.status === 'success' && pJson.html) {
          html = pJson.html;
        }
      }
    } catch (_) {}
  }

  if (!html) throw new Error('Failed to retrieve viewer HTML.');

  // Robust HTML Parser supporting combined and independent declarations
  // Pattern 1: Combined `const DATA=[...], HL="...", LBL="..."`
  const combinedMatch = html.match(/(?:const|var|let)\s+DATA\s*=\s*(\[[\s\S]*?\])\s*,\s*HL\s*=\s*["']([^"']*)["']\s*,\s*LBL\s*=\s*["']([^"']*)["']/);
  if (combinedMatch) {
    return {
      data: JSON.parse(combinedMatch[1]),
      HL: combinedMatch[2] || '',
      LBL: combinedMatch[3] || ''
    };
  }

  // Pattern 2: Flexible independent extractions
  const dataMatch = html.match(/(?:const|var|let)\s+DATA\s*=\s*(\[[\s\S]*?\])(?:\s*[,;])/);
  if (!dataMatch) throw new Error('DATA/HL/LBL payload missing in viewer.');

  const hlMatch = html.match(/HL\s*=\s*["']([^"']*)["']/);
  const lblMatch = html.match(/LBL\s*=\s*["']([^"']*)["']/);

  return {
    data: JSON.parse(dataMatch[1]),
    HL: hlMatch ? hlMatch[1] : '',
    LBL: lblMatch ? lblMatch[1] : ''
  };
}

function analyzeViewerEntries_(viewer) {
  const data = viewer.data || [];
  const HL = viewer.HL || '';
  const LBL = viewer.LBL || '';
  let linkedIndexes = [];

  for (let i = 0; i < data.length; i++) {
    if (HL && (data[i].id === HL || data[i].gid === HL)) {
      linkedIndexes.push(i);
    }
  }

  if (!linkedIndexes.length && LBL) {
    const normLBL = normalizeDefectType_(LBL);
    for (let i = 0; i < data.length; i++) {
      if (normalizeDefectType_(data[i].label) === normLBL) {
        linkedIndexes.push(i);
        break;
      }
    }
  }

  if (!linkedIndexes.length && data.length) linkedIndexes.push(0);

  const linkedSet = new Set(linkedIndexes);
  const linked = [];
  const unlinked = [];

  data.forEach((item, index) => {
    const obj = { id: item.id || '', label: item.label || '' };
    if (linkedSet.has(index)) {
      linked.push(obj);
    } else {
      unlinked.push(obj);
    }
  });

  return { linked, unlinked, total: data.length };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
