/**
 * Authentication module for Google Sheets API.
 * Supports:
 * 1. Manual Access Token fallback (Extension Settings)
 * 2. Dynamic Cloud OAuth Client ID via chrome.identity.launchWebAuthFlow (Configurable in Admin Panel)
 * 3. Native Chrome Identity OAuth (getAuthToken via manifest.json)
 */

function getAuthTokenViaWebFlow(clientId, interactive = true) {
  return new Promise((resolve, reject) => {
    if (!chrome.identity || !chrome.identity.launchWebAuthFlow) {
      return reject(new Error('chrome.identity.launchWebAuthFlow is not available.'));
    }

    const redirectUri = chrome.identity.getRedirectURL();
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/spreadsheets');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&prompt=consent`;

    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: interactive
    }, (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        return reject(new Error(chrome.runtime.lastError?.message || 'Authorization failed or closed.'));
      }
      try {
        const hashIndex = responseUrl.indexOf('#');
        if (hashIndex === -1) {
          const urlObj = new URL(responseUrl);
          const err = urlObj.searchParams.get('error') || 'OAuth response did not return token.';
          return reject(new Error(err));
        }
        const hash = responseUrl.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
        if (accessToken) {
          chrome.storage.local.set({
            dynamicOAuthToken: accessToken,
            dynamicTokenExpiresAt: Date.now() + (expiresIn * 1000)
          });
          resolve(accessToken);
        } else {
          const err = params.get('error') || 'No access token in response.';
          reject(new Error(err));
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function getAuthToken(interactive = true) {
  // 1. Check if user set a manual Google OAuth Access Token
  const storage = await chrome.storage.local.get([
    'manualOAuthToken',
    'tokenExpiresAt',
    'clusterGoogleClientId',
    'dynamicOAuthToken',
    'dynamicTokenExpiresAt'
  ]);

  if (storage.manualOAuthToken) {
    if (!storage.tokenExpiresAt || Date.now() < storage.tokenExpiresAt) {
      return storage.manualOAuthToken;
    }
  }

  // 2. Check cached dynamic OAuth token from WebAuthFlow
  if (storage.dynamicOAuthToken && storage.dynamicTokenExpiresAt && Date.now() < storage.dynamicTokenExpiresAt) {
    return storage.dynamicOAuthToken;
  }

  // 3. Resolve active Google Client ID (from Cloud Admin Panel or Manifest)
  let cloudClientId = storage.clusterGoogleClientId;
  if (!cloudClientId && typeof syncClusterSession === 'function') {
    const cluster = await syncClusterSession('Auth Pre-check').catch(() => null);
    if (cluster?.config?.googleClientId) {
      cloudClientId = cluster.config.googleClientId.trim();
    }
  }

  const manifestClientId = chrome.runtime.getManifest()?.oauth2?.client_id;

  // If cloud provided a client ID that differs from manifest, use dynamic WebAuthFlow directly
  if (cloudClientId && cloudClientId !== manifestClientId && !cloudClientId.includes('PASTE_YOUR_OAUTH_CLIENT_ID')) {
    return getAuthTokenViaWebFlow(cloudClientId, interactive);
  }

  // 4. Try native Chrome Identity API (getAuthToken)
  return new Promise((resolve, reject) => {
    if (!chrome.identity || !chrome.identity.getAuthToken) {
      const fallbackClientId = cloudClientId || manifestClientId;
      if (fallbackClientId && !fallbackClientId.includes('PASTE_YOUR_OAUTH_CLIENT_ID')) {
        return getAuthTokenViaWebFlow(fallbackClientId, interactive).then(resolve, reject);
      }
      return reject(new Error('chrome.identity API is not available. Please check extension permissions.'));
    }

    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        const errMsg = chrome.runtime.lastError?.message || 'Sign-in failed or was cancelled.';
        const fallbackClientId = cloudClientId || manifestClientId;

        // If native getAuthToken failed due to OAuth client mismatch or app ID, auto-fallback to WebAuthFlow
        if (fallbackClientId && !fallbackClientId.includes('PASTE_YOUR_OAUTH_CLIENT_ID')) {
          console.warn('[Auth] chrome.identity.getAuthToken failed, falling back to WebAuthFlow...', errMsg);
          return getAuthTokenViaWebFlow(fallbackClientId, interactive).then(resolve, reject);
        }

        if (errMsg.includes('OAuth2 client not found') || errMsg.includes('bad client id') || errMsg.includes('PASTE_YOUR_OAUTH_CLIENT_ID')) {
          reject(new Error(
            'Google OAuth Client ID is not configured yet. ' +
            'You can configure it in Admin Panel, set a Google Access Token directly in Extension Settings, or create a Client ID in Google Cloud Console.'
          ));
        } else {
          reject(new Error(errMsg));
        }
        return;
      }
      resolve(token);
    });
  });
}

function dropCachedAuthToken(token) {
  return new Promise(async (resolve) => {
    // Remove manual or dynamic token if it matches
    const storage = await chrome.storage.local.get(['manualOAuthToken', 'dynamicOAuthToken']);
    if (storage.manualOAuthToken === token) {
      await chrome.storage.local.remove(['manualOAuthToken', 'tokenExpiresAt']);
    }
    if (storage.dynamicOAuthToken === token) {
      await chrome.storage.local.remove(['dynamicOAuthToken', 'dynamicTokenExpiresAt']);
    }
    if (!token || !chrome.identity?.removeCachedAuthToken) return resolve();
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

async function setManualToken(token, expiresInSeconds = 3600) {
  const tokenExpiresAt = expiresInSeconds ? Date.now() + (expiresInSeconds * 1000) : 0;
  await chrome.storage.local.set({
    manualOAuthToken: token.trim(),
    tokenExpiresAt: tokenExpiresAt
  });
}

async function clearManualToken() {
  await chrome.storage.local.remove(['manualOAuthToken', 'tokenExpiresAt']);
}

async function getAuthStatus() {
  try {
    const token = await getAuthToken(false);
    return { authenticated: !!token, token: token ? token.substring(0, 10) + '...' : null };
  } catch (e) {
    return { authenticated: false, error: e.message };
  }
}

async function signOut() {
  const token = await getAuthToken(false).catch(() => null);
  if (token) {
    await dropCachedAuthToken(token);
  }
  await chrome.storage.local.remove([
    'dynamicOAuthToken',
    'dynamicTokenExpiresAt',
    'manualOAuthToken',
    'tokenExpiresAt'
  ]);
}
