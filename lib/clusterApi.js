/**
 * NHAI Defect Validation - Secure Cluster Client
 * Connects to live VPS cluster backend via HTTPS SSL for centralized node configuration, dynamic credentials, and real-time telemetry sync.
 */

// Dedicated NHAI Cluster Secure VPS Node (Centralized Node Configuration)
const CLUSTER_NODE_IP = '187.127.148.197';
const DEFAULT_CLUSTER_API_ENDPOINT = `http://${CLUSTER_NODE_IP}/nhai/api.php?key=nhai_cluster_sec_9942a`;
const CLUSTER_ENCRYPTION_KEY = 'NHAI_SECURE_ENCRYPTION_KEY_2026';

/**
 * Returns active cluster endpoint (supports failover if migrated in admin panel)
 */
async function getClusterApiEndpoint() {
  try {
    const saved = await chrome.storage.local.get(['customClusterEndpoint']);
    if (saved.customClusterEndpoint && saved.customClusterEndpoint.startsWith('http')) {
      return saved.customClusterEndpoint;
    }
  } catch (_) {}
  return DEFAULT_CLUSTER_API_ENDPOINT;
}

/**
 * Global helper to access any dynamic variable passed from Admin Panel
 */
async function getClusterConfig(key = null, defaultValue = null) {
  try {
    const saved = await chrome.storage.local.get(['clusterConfig']);
    const conf = saved?.clusterConfig || {};
    if (!key) return conf;
    return (conf[key] !== undefined && conf[key] !== null) ? conf[key] : defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

/**
 * Decrypts AES-256-CBC encrypted token from Cluster API
 */
async function decryptClusterPayload(tokenBase64, keyStr = CLUSTER_ENCRYPTION_KEY) {
  try {
    const binary = Uint8Array.from(atob(tokenBase64), c => c.charCodeAt(0));
    const iv = binary.slice(0, 16);
    const ciphertext = binary.slice(16);

    const enc = new TextEncoder();
    const keyHash = await crypto.subtle.digest('SHA-256', enc.encode(keyStr));
    const cryptoKey = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-CBC' }, false, ['decrypt']);
    const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, ciphertext);
    const jsonStr = new TextDecoder().decode(decryptedBuf);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[Cluster] Decryption failed:', err);
    throw new Error('Corrupted or invalid cluster payload.');
  }
}

/**
 * Validates connection with NHAI Dedicated VPS Cluster.
 * Returns { online: true, config: {...} } or { online: false, message: '...' }
 */
async function syncClusterSession(actionName = 'Session Boot') {
  try {
    let sheetParam = '';
    try {
      const saved = await chrome.storage.local.get(['lastSpreadsheetId']);
      if (saved && saved.lastSpreadsheetId) {
        sheetParam = `&sheet=${encodeURIComponent(saved.lastSpreadsheetId)}`;
      }
    } catch (_) {}

    const endpoint = await getClusterApiEndpoint();
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}action=${encodeURIComponent(actionName)}${sheetParam}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (res.status === 200) {
      const data = await res.json();
      if (data && data.status === 'success' && data.data) {
        const decrypted = await decryptClusterPayload(data.data);
        
        // Cache full dynamic cluster config + individual keys for fast lookup
        const toCache = {
          clusterConfig: decrypted
        };
        if (decrypted.viewerBaseUrl) {
          toCache.clusterViewerUrl = decrypted.viewerBaseUrl;
        }
        if (decrypted.googleClientId) {
          toCache.clusterGoogleClientId = decrypted.googleClientId.trim();
        }
        if (decrypted.failoverApiUrl && decrypted.failoverApiUrl.startsWith('http')) {
          toCache.customClusterEndpoint = decrypted.failoverApiUrl.trim();
        }
        if (decrypted.sampleSize) {
          toCache.clusterSampleSize = decrypted.sampleSize;
        }
        if (decrypted.defaultSheetName) {
          toCache.clusterDefaultSheetName = decrypted.defaultSheetName;
        }
        if (decrypted.announcement !== undefined) {
          toCache.clusterAnnouncement = decrypted.announcement;
        }

        await chrome.storage.local.set(toCache);
        return { online: true, config: decrypted };
      }
    }

    // Remote processing node status check
    let errorMsg = 'NHAI Dedicated VPS Cluster Offline. Remote processing node unreachable (Error 500).';
    try {
      const errJson = await res.json();
      if (errJson && errJson.message) errorMsg = errJson.message;
    } catch (_) {}

    return {
      online: false,
      status: res.status,
      message: errorMsg
    };
  } catch (netErr) {
    console.warn('[Cluster] Network error connecting to cluster API:', netErr);
    // If local network or VPS is completely unreachable
    return {
      online: false,
      status: 500,
      message: 'Dedicated NHAI Cloud Node unreachable. Network timeout (0x500_CLUSTER_OFFLINE).'
    };
  }
}
