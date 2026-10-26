// Dynamic iframe unblocking rules (remove X-Frame-Options & CSP frame-ancestors)
async function setupIframeRules() {
  if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001],
        addRules: [
          {
            id: 1001,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              responseHeaders: [
                { header: 'x-frame-options', operation: 'remove' },
                { header: 'content-security-policy', operation: 'remove' }
              ]
            },
            condition: {
              urlFilter: '*',
              resourceTypes: ['sub_frame']
            }
          }
        ]
      });
      console.log('[NHAI Extension] Iframe unblocking rules configured.');
    } catch (e) {
      console.warn('[NHAI Extension] Error setting up declarativeNetRequest rules:', e);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupIframeRules();
});
chrome.runtime.onStartup?.addListener(() => {
  setupIframeRules();
});
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('home.html') });
});

// Elevated Service Worker fetch proxy for CORS-free viewer scraping
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_VIEWER_HTML') {
    fetch(request.url, { redirect: 'follow' })
      .then(async (res) => {
        if (!res.ok) {
          sendResponse({ success: false, error: 'HTTP ' + res.status });
          return;
        }
        const text = await res.text();
        sendResponse({ success: true, html: text, finalUrl: res.url });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for asynchronous sendResponse
  }
});
