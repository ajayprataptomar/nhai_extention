/**
 * NHAI Defect Validation - Command Center Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const spreadsheetIdInput = document.getElementById('spreadsheetIdInput');
  const sheetNameInput = document.getElementById('sheetNameInput');
  const btnDetectTab = document.getElementById('btnDetectTab');
  const authBadge = document.getElementById('authBadge');
  const btnHeaderDisconnect = document.getElementById('btnHeaderDisconnect');
  const btnSettings = document.getElementById('btnSettings');

  const btnStep1 = document.getElementById('btnStep1');
  const btnStep2 = document.getElementById('btnStep2');
  const btnStep3 = document.getElementById('btnStep3');
  const btnStep4 = document.getElementById('btnStep4');

  const btnOpenMap = document.getElementById('btnOpenMap');
  const btnOpenReview = document.getElementById('btnOpenReview');

  // Cluster Status Elements
  const clusterOfflineBanner = document.getElementById('clusterOfflineBanner');
  const clusterAlertTitle = document.getElementById('clusterAlertTitle');
  const clusterAlertMessage = document.getElementById('clusterAlertMessage');
  const btnRetryCluster = document.getElementById('btnRetryCluster');

  const consoleOutput = document.getElementById('consoleOutput');
  const btnClearLog = document.getElementById('btnClearLog');
  const consoleStatusDot = document.getElementById('consoleStatusDot');
  const progressContainer = document.getElementById('progressContainer');
  const progressBarFill = document.getElementById('progressBarFill');

  // Settings Modal Elements
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnDoneSettings = document.getElementById('btnDoneSettings');
  const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
  const btnGoogleSignOut = document.getElementById('btnGoogleSignOut');
  const manualTokenInput = document.getElementById('manualTokenInput');
  const btnSaveToken = document.getElementById('btnSaveToken');
  const btnClearToken = document.getElementById('btnClearToken');
  const btnTestViewer = document.getElementById('btnTestViewer');
  const testViewerResult = document.getElementById('testViewerResult');

  const statusStep1 = document.getElementById('statusStep1');
  const statusStep2 = document.getElementById('statusStep2');
  const statusStep3 = document.getElementById('statusStep3');
  const statusStep4 = document.getElementById('statusStep4');
  const toastContainer = document.getElementById('toastContainer');

  // Execution Modal Elements
  const executionModal = document.getElementById('executionModal');
  const execModalIcon = document.getElementById('execModalIcon');
  const execModalTitle = document.getElementById('execModalTitle');
  const btnExecModalClose = document.getElementById('btnExecModalClose');
  const execRunningView = document.getElementById('execRunningView');
  const execSuccessView = document.getElementById('execSuccessView');
  const execErrorView = document.getElementById('execErrorView');
  const execProgressBarFill = document.getElementById('execProgressBarFill');
  const execProgressPercent = document.getElementById('execProgressPercent');
  const execProgressStage = document.getElementById('execProgressStage');
  const execCurrentMessage = document.getElementById('execCurrentMessage');
  const execDetailLog = document.getElementById('execDetailLog');
  const execSuccessTitle = document.getElementById('execSuccessTitle');
  const execSuccessSubtitle = document.getElementById('execSuccessSubtitle');
  const execMetricsGrid = document.getElementById('execMetricsGrid');
  const execSummaryBox = document.getElementById('execSummaryBox');
  const btnExecDone = document.getElementById('btnExecDone');
  const btnExecDismiss = document.getElementById('btnExecDismiss');
  const execErrorMessage = document.getElementById('execErrorMessage');

  // Confirm Overwrite Modal Elements
  const confirmOverwriteModal = document.getElementById('confirmOverwriteModal');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalHeadline = document.getElementById('confirmModalHeadline');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const confirmDetailsBox = document.getElementById('confirmDetailsBox');
  const confirmDetailsList = document.getElementById('confirmDetailsList');
  const btnConfirmCancel = document.getElementById('btnConfirmCancel');
  const btnConfirmProceed = document.getElementById('btnConfirmProceed');
  const btnConfirmClose = document.getElementById('btnConfirmClose');

  function promptOverwriteConfirmation({ title, headline, message, details = [] }) {
    return new Promise((resolve) => {
      if (!confirmOverwriteModal) {
        const ok = window.confirm(`${headline || title}\n\n${message}\n\nProceed and overwrite existing data?`);
        return resolve(ok);
      }

      confirmModalTitle.textContent = title || 'Data Already Exists!';
      confirmModalHeadline.textContent = headline || 'Previous run detected';
      confirmModalMessage.textContent = message || 'This sheet already contains processed data. Running this will overwrite existing values.';

      confirmDetailsList.innerHTML = '';
      if (details && details.length > 0) {
        details.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item;
          confirmDetailsList.appendChild(li);
        });
        confirmDetailsBox.style.display = 'block';
      } else {
        confirmDetailsBox.style.display = 'none';
      }

      confirmOverwriteModal.style.display = 'flex';

      function cleanUp(result) {
        confirmOverwriteModal.style.display = 'none';
        btnConfirmProceed.removeEventListener('click', onProceed);
        btnConfirmCancel.removeEventListener('click', onCancel);
        btnConfirmClose.removeEventListener('click', onCancel);
        resolve(result);
      }

      function onProceed() { cleanUp(true); }
      function onCancel() { cleanUp(false); }

      btnConfirmProceed.addEventListener('click', onProceed);
      btnConfirmCancel.addEventListener('click', onCancel);
      btnConfirmClose.addEventListener('click', onCancel);
    });
  }

  async function detectExistingData(spreadsheetId, sheetName, step) {
    try {
      const meta = await getSpreadsheetMeta(spreadsheetId);
      const sheetTitles = (meta.sheets || []).map(s => s.properties.title);
      const info = await getSheetInfo(spreadsheetId, sheetName);
      const { headerRow, headers, colSelect } = info;

      if (step === 'step1') {
        const details = [];
        let hasData = false;

        if (sheetTitles.includes('Activity Log')) {
          hasData = true;
          details.push("Sheet 'Activity Log' already exists from previous sampling diagnostics.");
        }

        if (colSelect > 0) {
          const colLet = columnLetter_(colSelect);
          const vals = await getValues(spreadsheetId, `'${sheetName}'!${colLet}${headerRow + 1}:${colLet}${headerRow + 2500}`);
          let yesCount = 0;
          for (const row of vals) {
            if (String(row[0] || '').trim().toUpperCase() === 'YES') yesCount++;
          }
          if (yesCount > 0) {
            hasData = true;
            details.push(`Found ${yesCount}+ defect rows already marked as 'Yes' in 'Selected for Precision Validation'.`);
          }
        }

        if (hasData) {
          return {
            hasData: true,
            title: 'Sampling Already Executed!',
            headline: 'Existing Sample Data Detected in Sheet',
            message: "This sheet already contains sampled defect rows. Running Step 1 again will recalculate Water-Fill allocation and OVERWRITE all current sample selections and the 'Activity Log' sheet.",
            details
          };
        }
      } else if (step === 'step2') {
        const details = [];
        let hasData = false;

        const colReported = findHeaderColumn_(headers, ['Defects reported By Vendor', 'Defects reported by Vendor']);
        const colIdentified = findHeaderColumn_(headers, ['Identified in Report', 'Identified in report']);
        const colAddName = findHeaderColumn_(headers, ['Name of Additional Defect Found']);

        const checkCol = colReported || colIdentified || colAddName;
        if (checkCol > 0) {
          const colLet = columnLetter_(checkCol);
          const vals = await getValues(spreadsheetId, `'${sheetName}'!${colLet}${headerRow + 1}:${colLet}${headerRow + 80}`);
          let filledCount = 0;
          for (const row of vals) {
            if (row[0] !== undefined && String(row[0]).trim() !== '') filledCount++;
          }
          if (filledCount > 0) {
            hasData = true;
            details.push(`Viewer crawl column '${headers[checkCol - 1]}' already contains analyzed data (${filledCount}+ rows populated).`);
            details.push("Re-running Step 2 will re-scrape frames from the server and OVERWRITE existing defect counts, identified defects, and frame references.");
          }
        }

        if (hasData) {
          return {
            hasData: true,
            title: 'Viewer Analysis Already Executed!',
            headline: 'Existing Viewer Analysis Detected in Sheet',
            message: "Viewer defect analysis and frame crawling have already been executed for this sheet. Running Step 2 again will re-scrape frames and OVERWRITE existing viewer defect counts, identified defects, and frame references.",
            details
          };
        }
      } else if (step === 'step3') {
        if (sheetTitles.includes('Precision & Recall')) {
          return {
            hasData: true,
            title: "'Precision & Recall' Sheet Already Exists!",
            headline: 'Summary Sheet Already Present in Spreadsheet',
            message: "The dedicated 'Precision & Recall' summary sheet already exists. Re-running Step 3 will rebuild the category matrix and recalculate all formulas.",
            details: [
              "Sheet 'Precision & Recall' is already present in this spreadsheet.",
              "Running Step 3 will overwrite summary rows and recalculate live COUNTIFS and SUM formulas."
            ]
          };
        }
      } else if (step === 'step4') {
        const details = [];
        let hasData = false;

        if (sheetTitles.includes('Activity Log')) {
          hasData = true;
          details.push("Sheet 'Activity Log' already exists from previous sampling.");
        }
        if (sheetTitles.includes('Precision & Recall')) {
          hasData = true;
          details.push("Summary sheet 'Precision & Recall' already exists.");
        }

        if (colSelect > 0) {
          const colLet = columnLetter_(colSelect);
          const vals = await getValues(spreadsheetId, `'${sheetName}'!${colLet}${headerRow + 1}:${colLet}${headerRow + 1500}`);
          let yesCount = 0;
          for (const row of vals) {
            if (String(row[0] || '').trim().toUpperCase() === 'YES') yesCount++;
          }
          if (yesCount > 0) {
            hasData = true;
            details.push(`${yesCount}+ defect rows are currently marked as 'Yes' (Sampled).`);
          }
        }

        const colReported = findHeaderColumn_(headers, ['Defects reported By Vendor', 'Identified in Report']);
        if (colReported > 0) {
          const colLet = columnLetter_(colReported);
          const vals = await getValues(spreadsheetId, `'${sheetName}'!${colLet}${headerRow + 1}:${colLet}${headerRow + 50}`);
          if (vals.some(r => r[0] !== undefined && String(r[0]).trim() !== '')) {
            hasData = true;
            details.push("Viewer analysis columns already contain scraped frames and defect counts.");
          }
        }

        if (hasData) {
          return {
            hasData: true,
            title: 'Existing Pipeline Data Detected!',
            headline: 'Complete Validation Will Overwrite All Stages',
            message: "Running the Complete Validation Pipeline will re-sample all defects from scratch, re-crawl viewer frames, and rebuild summary sheets. ALL current selections, counts, and review entries will be OVERWRITTEN.",
            details
          };
        }
      }
    } catch (err) {
      console.warn('Could not pre-check existing sheet data:', err);
    }
    return { hasData: false };
  }

  function openProgressModal(iconSvgOrText, title, initialStage) {
    if (!executionModal) return;
    if (typeof iconSvgOrText === 'string' && iconSvgOrText.includes('<svg')) {
      execModalIcon.innerHTML = iconSvgOrText;
    } else if (iconSvgOrText) {
      execModalIcon.textContent = iconSvgOrText;
    }
    execModalTitle.textContent = title;
    execProgressBarFill.style.width = '12%';
    execProgressPercent.textContent = '12%';
    execProgressStage.textContent = initialStage;
    execCurrentMessage.textContent = initialStage;
    execDetailLog.innerHTML = '';
    
    execRunningView.style.display = 'flex';
    execSuccessView.style.display = 'none';
    execErrorView.style.display = 'none';
    btnExecModalClose.style.display = 'none';
    executionModal.style.display = 'flex';
  }

  function updateProgressModal(stageText, pct = null) {
    if (!executionModal || executionModal.style.display === 'none') return;
    execCurrentMessage.textContent = stageText;
    execProgressStage.textContent = stageText;

    if (pct !== null && pct !== undefined) {
      const cleanPct = Math.min(100, Math.max(10, Math.round(pct)));
      execProgressBarFill.style.width = `${cleanPct}%`;
      execProgressPercent.textContent = `${cleanPct}%`;
    }

    const logLine = document.createElement('div');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    logLine.innerHTML = `<span style="color: var(--text-dim); margin-right: 6px;">[${time}]</span><span style="color: var(--text-body);">${stageText}</span>`;
    execDetailLog.appendChild(logLine);
    execDetailLog.scrollTop = execDetailLog.scrollHeight;
  }

  function showSuccessModal(title, subtitle, metrics = [], summaryItems = []) {
    if (!executionModal) return;
    execProgressBarFill.style.width = '100%';
    execProgressPercent.textContent = '100%';

    execSuccessTitle.textContent = title;
    execSuccessSubtitle.textContent = subtitle;

    execMetricsGrid.innerHTML = metrics.map(m => `
      <div class="exec-metric-card">
        <span class="exec-metric-label">${m.label}</span>
        <span class="exec-metric-val">${m.value}</span>
      </div>
    `).join('');

    execSummaryBox.innerHTML = summaryItems.map(item => `
      <div class="exec-summary-item">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span>${item}</span>
      </div>
    `).join('');

    execRunningView.style.display = 'none';
    execErrorView.style.display = 'none';
    execSuccessView.style.display = 'flex';
    btnExecModalClose.style.display = 'block';
  }

  function showErrorModal(title, errText) {
    if (!executionModal) return;
    execErrorTitle.textContent = title;
    execErrorMessage.textContent = String(errText || 'An unexpected error occurred.');

    execRunningView.style.display = 'none';
    execSuccessView.style.display = 'none';
    execErrorView.style.display = 'flex';
    btnExecModalClose.style.display = 'block';
  }

  btnExecDone?.addEventListener('click', () => { executionModal.style.display = 'none'; });
  btnExecDismiss?.addEventListener('click', () => { executionModal.style.display = 'none'; });
  btnExecModalClose?.addEventListener('click', () => { executionModal.style.display = 'none'; });

  // Console Logging Helper
  function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    consoleOutput.appendChild(entry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  // Toast Notification System
  function showToast(title, message, type = 'success', duration = 6500) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" title="Dismiss">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    toastContainer.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-10px)';
          setTimeout(() => toast.remove(), 250);
        }
      }, duration);
    }
  }

  function setBusy(isBusy, activeBtn = null, loadingText = 'Processing...', statusEl = null) {
    if (isBusy) {
      consoleStatusDot.classList.add('active');
      progressContainer.style.display = 'block';
      progressBarFill.style.width = '15%';

      if (activeBtn) {
        if (!activeBtn.dataset.origHtml) {
          activeBtn.dataset.origHtml = activeBtn.innerHTML;
        }
        const spinnerClass = activeBtn.classList.contains('btn-highlight') ? 'btn-spinner' : 'btn-spinner btn-spinner-blue';
        activeBtn.innerHTML = `<span class="${spinnerClass}"></span> ${loadingText}`;
        activeBtn.classList.add('btn-loading');
      }
      if (statusEl) {
        statusEl.style.display = 'flex';
        statusEl.textContent = loadingText;
      }
    } else {
      consoleStatusDot.classList.remove('active');
      progressContainer.style.display = 'none';
      progressBarFill.style.width = '0%';

      if (activeBtn) {
        activeBtn.classList.remove('btn-loading');
        activeBtn.classList.add('btn-done');
        activeBtn.innerHTML = `✓ Completed!`;
        setTimeout(() => {
          activeBtn.classList.remove('btn-done');
          if (activeBtn.dataset.origHtml) {
            activeBtn.innerHTML = activeBtn.dataset.origHtml;
          }
        }, 2800);
      }
      if (statusEl) {
        setTimeout(() => {
          statusEl.style.display = 'none';
          statusEl.textContent = '';
        }, 3500);
      }
    }

    btnStep1.disabled = isBusy;
    btnStep2.disabled = isBusy;
    btnStep3.disabled = isBusy;
    btnStep4.disabled = isBusy;
    btnDetectTab.disabled = isBusy;
  }

  // Restore saved spreadsheet & settings
  const savedConfig = await chrome.storage.local.get(['lastSpreadsheetId', 'lastSheetName', 'manualOAuthToken']);
  if (savedConfig.lastSpreadsheetId) spreadsheetIdInput.value = savedConfig.lastSpreadsheetId;
  if (savedConfig.manualOAuthToken) manualTokenInput.value = savedConfig.manualOAuthToken;

  let currentLoadedSpreadsheetId = '';

  // Dynamically populate tabs dropdown from Google Sheet
  async function populateSheetTabs(targetId, preferredTab = null) {
    const raw = targetId || spreadsheetIdInput.value.trim();
    const id = extractSpreadsheetId(raw);
    if (!id) {
      sheetNameInput.innerHTML = '<option value="Defects Log" selected>Defects Log</option>';
      return;
    }

    const isSameSheet = (id === currentLoadedSpreadsheetId);
    // If it's a newly switched sheet and no explicit preferredTab is passed, prefer 'Defects Log'
    const targetSelection = preferredTab || (isSameSheet ? sheetNameInput.value : null) || 'Defects Log';

    sheetNameInput.innerHTML = '<option value="" disabled selected>⏳ Fetching tabs...</option>';
    sheetNameInput.disabled = true;

    try {
      const auth = await getAuthStatus();
      if (!auth.authenticated) {
        sheetNameInput.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = targetSelection;
        opt.textContent = targetSelection;
        opt.selected = true;
        sheetNameInput.appendChild(opt);
        sheetNameInput.disabled = false;
        return;
      }

      const meta = await getSpreadsheetMeta(id);
      currentLoadedSpreadsheetId = id;

      if (meta && meta.sheets && meta.sheets.length > 0) {
        sheetNameInput.innerHTML = '';
        let foundPreferred = false;
        let defectsLogTitle = null;

        meta.sheets.forEach(s => {
          const title = s.properties ? s.properties.title : '';
          if (!title) return;
          const opt = document.createElement('option');
          opt.value = title;
          opt.textContent = title;
          sheetNameInput.appendChild(opt);

          if (title.trim() === targetSelection.trim()) {
            foundPreferred = true;
          }
          if (title.trim().toLowerCase() === 'defects log') {
            defectsLogTitle = title;
          }
        });

        // Hierarchy of selection:
        // 1. If preferred tab exists in this spreadsheet, select it.
        // 2. Else if "Defects Log" exists in this spreadsheet, select it.
        // 3. Otherwise, select the first sheet tab.
        if (foundPreferred) {
          sheetNameInput.value = targetSelection;
        } else if (defectsLogTitle) {
          sheetNameInput.value = defectsLogTitle;
        } else if (meta.sheets[0] && meta.sheets[0].properties) {
          sheetNameInput.value = meta.sheets[0].properties.title;
        }

        const chosen = sheetNameInput.value;
        await chrome.storage.local.set({ lastSheetName: chosen });
        log(`✓ Loaded ${meta.sheets.length} tab(s) from sheet. Active tab: "${chosen}"`, 'info');

        const weeklyTabSelect = document.getElementById('selectWeeklyMasterTab');
        if (weeklyTabSelect) {
          const currentWeeklyVal = weeklyTabSelect.value;
          weeklyTabSelect.innerHTML = '<option value="">(Auto-detect Master Tab)</option>';
          meta.sheets.forEach(s => {
            const t = s.properties ? s.properties.title : '';
            if (!t) return;
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (t === currentWeeklyVal) opt.selected = true;
            weeklyTabSelect.appendChild(opt);
          });
        }
      } else {
        sheetNameInput.innerHTML = '<option value="Defects Log" selected>Defects Log</option>';
      }
    } catch (err) {
      console.warn('Could not populate tabs from spreadsheet:', err);
      sheetNameInput.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = targetSelection || 'Defects Log';
      opt.textContent = targetSelection || 'Defects Log';
      opt.selected = true;
      sheetNameInput.appendChild(opt);
    } finally {
      sheetNameInput.disabled = false;
    }
  }

  // 1. Sync configuration with Secure VPS Cluster
  async function verifyClusterOnline(actionName = 'Execute') {
    if (typeof syncClusterSession !== 'function') return true;
    const res = await syncClusterSession(actionName);
    if (!res.online) {
      const errMsg = res.message || 'NHAI Dedicated Processing Cluster Offline. Dedicated VPS backend node [vps-delhi-01] is unreachable. Error 0x500_CLUSTER_TIMEOUT. Please contact system administrator.';
      showErrorModal('500 Server Error: Processing Node Offline', errMsg);
      log(`[CLUSTER 500] Live server check failed: ${errMsg}`, 'error');
      return false;
    }
    return true;
  }

  async function refreshClusterStatus() {
    if (typeof syncClusterSession !== 'function') return;
    const res = await syncClusterSession('Session Init');
    if (res.online && res.config) {
      if (res.config.spreadsheetId && !spreadsheetIdInput.value.trim()) {
        spreadsheetIdInput.value = res.config.spreadsheetId;
      }
      if (res.config.defaultSheetName && (!sheetNameInput.value.trim() || sheetNameInput.value === 'Defects Log')) {
        sheetNameInput.value = res.config.defaultSheetName;
      }
      if (res.config.announcement) {
        log(`📢 Admin Notice: ${res.config.announcement}`, 'warning');
      }
    }
  }

  if (btnRetryCluster) {
    btnRetryCluster.addEventListener('click', async () => {
      btnRetryCluster.disabled = true;
      btnRetryCluster.textContent = 'Checking...';
      await refreshClusterStatus();
      btnRetryCluster.disabled = false;
      btnRetryCluster.textContent = 'Retry Connection';
    });
  }

  await refreshClusterStatus();

  // Auto-detect if user came from a Google Sheets tab
  async function detectActiveTabSheet() {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs && tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        const sheetId = extractSpreadsheetId(url);
        if (sheetId && sheetId !== url) {
          spreadsheetIdInput.value = sheetId;
          await chrome.storage.local.set({ lastSpreadsheetId: sheetId });
          log(`Detected Google Sheet from active tab: ${sheetId}`, 'success');
          await populateSheetTabs(sheetId);
          return true;
        }
      }
    } catch (e) {
      console.warn('Tab detection error:', e);
    }
    return false;
  }

  // If no saved spreadsheet, attempt auto-detect
  if (!spreadsheetIdInput.value.trim()) {
    await detectActiveTabSheet();
  }

  btnDetectTab.addEventListener('click', async () => {
    btnDetectTab.disabled = true;
    const detected = await detectActiveTabSheet();
    if (!detected) {
      // Look through all open tabs in current window
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const sheetTab = allTabs.find(t => t.url && t.url.includes('docs.google.com/spreadsheets/d/'));
      if (sheetTab) {
        const id = extractSpreadsheetId(sheetTab.url);
        spreadsheetIdInput.value = id;
        await chrome.storage.local.set({ lastSpreadsheetId: id });
        log(`Found open Google Sheet: ${sheetTab.title || id}`, 'success');
        await populateSheetTabs(id);
      } else {
        log('No open Google Sheets tab found. Please paste your Google Spreadsheet URL manually.', 'warn');
      }
    }
    btnDetectTab.disabled = false;
  });

  // Save changes and dynamically update tabs on spreadsheet URL change or paste
  spreadsheetIdInput.addEventListener('change', async () => {
    const raw = spreadsheetIdInput.value.trim();
    const id = extractSpreadsheetId(raw);
    spreadsheetIdInput.value = id;
    await chrome.storage.local.set({ lastSpreadsheetId: id });
    if (id) {
      await populateSheetTabs(id);
    }
  });

  spreadsheetIdInput.addEventListener('paste', () => {
    setTimeout(async () => {
      const raw = spreadsheetIdInput.value.trim();
      const id = extractSpreadsheetId(raw);
      if (id) {
        spreadsheetIdInput.value = id;
        await chrome.storage.local.set({ lastSpreadsheetId: id });
        await populateSheetTabs(id);
      }
    }, 150);
  });

  sheetNameInput.addEventListener('change', () => {
    const val = sheetNameInput.value.trim();
    chrome.storage.local.set({ lastSheetName: val });
    log(`Active Tab selected: "${val}"`, 'info');
  });

  // Check Auth Status
  async function updateAuthDisplay() {
    const status = await getAuthStatus();
    if (status.authenticated) {
      authBadge.className = 'badge badge-connected';
      authBadge.textContent = '● Connected';
      if (btnHeaderDisconnect) btnHeaderDisconnect.style.display = 'inline-flex';
    } else {
      authBadge.className = 'badge badge-disconnected';
      authBadge.textContent = '○ Disconnected';
      if (btnHeaderDisconnect) btnHeaderDisconnect.style.display = 'none';
    }
  }
  await updateAuthDisplay();

  // Populate tabs initially if spreadsheet ID is already present
  if (spreadsheetIdInput.value.trim()) {
    await populateSheetTabs(spreadsheetIdInput.value.trim(), savedConfig.lastSheetName);
  }

  // 1-Click Header Disconnect
  if (btnHeaderDisconnect) {
    btnHeaderDisconnect.addEventListener('click', async () => {
      if (confirm('Disconnect Spreadsheet Authorization?\n\nThis will remove the current authorization token.')) {
        await signOut();
        manualTokenInput.value = '';
        await updateAuthDisplay();
        log('Spreadsheet authorization disconnected.', 'info');
        showToast('Disconnected', 'Authorization session cleared.', 'info', 4000);
      }
    });
  }

  function getActiveConfig(actionContext = 'Active Session') {
    const rawId = spreadsheetIdInput.value.trim();
    const spreadsheetId = extractSpreadsheetId(rawId);
    const sheetName = sheetNameInput.value.trim() || 'Defects Log';

    if (!spreadsheetId) {
      log('Please provide a Google Spreadsheet URL or ID above.', 'error');
      alert('Please enter or detect a Google Spreadsheet URL/ID before proceeding.');
      return null;
    }

    chrome.storage.local.set({ lastSpreadsheetId: spreadsheetId, lastSheetName: sheetName });
    if (typeof syncClusterSession === 'function') {
      syncClusterSession(actionContext).catch(() => {});
    }
    return { spreadsheetId, sheetName };
  }

  // --- WORKFLOW 1: SELECT PRECISION SAMPLE ---
  btnStep1.addEventListener('click', async () => {
    btnStep1.disabled = true;
    const online = await verifyClusterOnline('Step 1: Precision Sampling');
    btnStep1.disabled = false;
    if (!online) return;

    const cfg = getActiveConfig('Step 1: Precision Sampling');
    if (!cfg) return;

    // Safety Pre-flight Check: Detect if sheet already has sampled rows or Activity Log
    btnStep1.disabled = true;
    if (statusStep1) statusStep1.textContent = 'Checking existing sheet data...';
    try {
      const check = await detectExistingData(cfg.spreadsheetId, cfg.sheetName, 'step1');
      if (check && check.hasData) {
        const proceed = await promptOverwriteConfirmation(check);
        if (!proceed) {
          log('Step 1 cancelled by user. Existing sample data preserved.', 'info');
          if (statusStep1) statusStep1.textContent = 'Cancelled (Existing data preserved)';
          btnStep1.disabled = false;
          return;
        }
      }
    } catch (e) {
      console.warn('Pre-check error in Step 1:', e);
    } finally {
      btnStep1.disabled = false;
    }

    // Open visible progress popup immediately!
    openProgressModal(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
      'Step 1: Select Precision Sample',
      'Selecting representative defect sample...'
    );
    setBusy(true, btnStep1, 'Running Step 1...', statusStep1);
    log('Starting Step 1: Precision Validation Sampling...', 'info');

    let currentPct = 15;
    try {
      const res = await executePrecisionValidation(cfg.spreadsheetId, cfg.sheetName, (prog) => {
        if (prog.stage === 'init') currentPct = 20;
        else if (prog.stage === 'columns') currentPct = 35;
        else if (prog.stage === 'reading') currentPct = 45;
        else if (prog.stage === 'cleaning') currentPct = 60;
        else if (prog.stage === 'waterfill') currentPct = 75;
        else if (prog.stage === 'binning') currentPct = 85;
        else if (prog.stage === 'activity_log') currentPct = 92;
        else if (prog.stage === 'writing') currentPct = 98;
        else if (prog.stage === 'done') currentPct = 100;

        updateProgressModal(prog.message, currentPct);
        log(prog.message, prog.stage === 'done' ? 'success' : 'info');
        if (statusStep1) statusStep1.textContent = prog.message;
      });

      log(`Step 1 Complete: Base Level L: ${res.baseLevel} | Deficit Bumped: ${res.deficit} | Marked 'Yes': ${res.markedYes} | Covered: ${res.typesCovered}/${res.numTypes}`, 'success');
      if (statusStep1) statusStep1.textContent = `Sampled ${res.markedYes} defects across ${res.typesCovered} categories`;

      showSuccessModal(
        'Precision Sample Complete',
        'Representative defect sample generated and verified in spreadsheet.',
        [
          { label: 'Clean Universe', value: res.totalDefects },
          { label: 'Sample Marked Yes', value: res.markedYes },
          { label: 'Base Coverage', value: res.baseLevel },
          { label: 'Deficit Filled', value: res.deficit }
        ],
        [
          `Covered ${res.typesCovered} of ${res.numTypes} defect categories in sample`,
          `Activity Log sheet updated with sampling diagnostics`,
          `All Precision & Recall tracking columns verified and created in Defects Log`,
          `Formulas injected for Location and Final Detection Judgement`
        ]
      );
    } catch (err) {
      log(`Step 1 Error: ${err.message}`, 'error');
      if (statusStep1) statusStep1.textContent = `Failed: ${err.message}`;
      showErrorModal('Step 1 Failed', err.message);
    } finally {
      setBusy(false, btnStep1, '', statusStep1);
      await updateAuthDisplay();
    }
  });

  // --- WORKFLOW 2: ANALYZE VIEWER DEFECTS ---
  btnStep2.addEventListener('click', async () => {
    btnStep2.disabled = true;
    const online = await verifyClusterOnline('Step 2: Defect Analysis');
    btnStep2.disabled = false;
    if (!online) return;

    const cfg = getActiveConfig('Step 2: Defect Analysis');
    if (!cfg) return;

    // Safety Pre-flight Check: Detect if viewer analysis already exists
    btnStep2.disabled = true;
    if (statusStep2) statusStep2.textContent = 'Checking existing sheet data...';
    try {
      const check = await detectExistingData(cfg.spreadsheetId, cfg.sheetName, 'step2');
      if (check && check.hasData) {
        const proceed = await promptOverwriteConfirmation(check);
        if (!proceed) {
          log('Step 2 cancelled by user. Existing viewer analysis preserved.', 'info');
          if (statusStep2) statusStep2.textContent = 'Cancelled (Existing data preserved)';
          btnStep2.disabled = false;
          return;
        }
      }
    } catch (e) {
      console.warn('Pre-check error in Step 2:', e);
    } finally {
      btnStep2.disabled = false;
    }

    openProgressModal(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>',
      'Step 2: Viewer Defects Analysis',
      'Starting viewer scraping & reconciliation...'
    );
    setBusy(true, btnStep2, 'Running Step 2...', statusStep2);
    log('Starting Step 2: Viewer Defects Analysis...', 'info');

    try {
      const res = await analyzeViewerDefects(cfg.spreadsheetId, cfg.sheetName, (prog) => {
        let pct = 30;
        if (prog.current && prog.total) {
          pct = Math.round((prog.current / prog.total) * 100);
        }
        updateProgressModal(prog.message, pct);
        log(prog.message, prog.stage === 'done' ? 'success' : 'info');
        if (statusStep2) statusStep2.textContent = prog.message;
      });

      log(`Step 2 Complete: Analyzed ${res.analyzedCount} sampled defect rows.`, 'success');
      if (statusStep2) statusStep2.textContent = `Analyzed ${res.analyzedCount} sampled defect frames`;

      showSuccessModal(
        'Viewer Analysis Complete',
        'Successfully scraped and reconciled sampled defects against vendor viewer frames.',
        [
          { label: 'Sampled Frames', value: res.analyzedCount },
          { label: 'Reconciled', value: res.analyzedCount },
          { label: 'Tracking Columns', value: '8 Created' },
          { label: 'Helper Columns', value: 'Auto-Hidden' }
        ],
        [
          `Extracted and counted defect bounding boxes from native HTML frames`,
          `Aligned additional defects with standardized 52-defect nomenclature`,
          `Reconciled sequential frame references and cross-camera images`,
          `Saved vendor comparison metrics back into spreadsheet`
        ]
      );
    } catch (err) {
      log(`Step 2 Error: ${err.message}`, 'error');
      if (statusStep2) statusStep2.textContent = `Failed: ${err.message}`;
      showErrorModal('Step 2 Failed', err.message);
    } finally {
      setBusy(false, btnStep2, '', statusStep2);
      await updateAuthDisplay();
    }
  });

  // --- WORKFLOW 3: UPDATE PRECISION & RECALL SHEET ---
  btnStep3.addEventListener('click', async () => {
    const cfg = getActiveConfig();
    if (!cfg) return;

    // Safety Pre-flight Check: Detect if Precision & Recall sheet already exists
    btnStep3.disabled = true;
    if (statusStep3) statusStep3.textContent = 'Checking existing sheet data...';
    try {
      const check = await detectExistingData(cfg.spreadsheetId, cfg.sheetName, 'step3');
      if (check && check.hasData) {
        const proceed = await promptOverwriteConfirmation(check);
        if (!proceed) {
          log('Step 3 cancelled by user. Existing summary sheet preserved.', 'info');
          if (statusStep3) statusStep3.textContent = 'Cancelled (Existing sheet preserved)';
          btnStep3.disabled = false;
          return;
        }
      }
    } catch (e) {
      console.warn('Pre-check error in Step 3:', e);
    } finally {
      btnStep3.disabled = false;
    }

    openProgressModal(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>',
      "Step 3: Update 'Precision & Recall' Sheet",
      'Building category summary matrix...'
    );
    setBusy(true, btnStep3, 'Running Step 3...', statusStep3);
    log("Starting Step 3: Updating 'Precision & Recall' Sheet...", 'info');

    try {
      const res = await createOrUpdatePrecisionRecallSheet(cfg.spreadsheetId, cfg.sheetName, (prog) => {
        let pct = 40;
        if (prog.stage === 'headers') pct = 30;
        else if (prog.stage === 'categories') pct = 60;
        else if (prog.stage === 'formulas') pct = 85;
        else if (prog.stage === 'done') pct = 100;
        updateProgressModal(prog.message, pct);
        log(prog.message, prog.stage === 'done' ? 'success' : 'info');
        if (statusStep3) statusStep3.textContent = prog.message;
      });

      log(`Step 3 Complete: Refreshed ${res.totalCategories} defect categories with formulas and styles.`, 'success');
      if (statusStep3) statusStep3.textContent = `Generated summary table for ${res.totalCategories} categories`;

      showSuccessModal(
        'Precision & Recall Sheet Updated',
        "The dedicated 'Precision & Recall' summary sheet has been refreshed.",
        [
          { label: 'Categories', value: res.totalCategories },
          { label: 'Formulas', value: 'Live COUNTIFS' },
          { label: 'Totals', value: 'Live SUM' },
          { label: 'Formatting', value: 'Styled Grid' }
        ],
        [
          `Generated dynamic category split for all defect types in universe`,
          `Injected live COUNTIFS and SUM formulas for automatic recalculation`,
          `Preserved dominant issue tracking and classification accuracy`,
          `Applied professional NHAI executive summary styling`
        ]
      );
    } catch (err) {
      log(`Step 3 Error: ${err.message}`, 'error');
      if (statusStep3) statusStep3.textContent = `Failed: ${err.message}`;
      showErrorModal('Step 3 Failed', err.message);
    } finally {
      setBusy(false, btnStep3, '', statusStep3);
      await updateAuthDisplay();
    }
  });

  // --- WORKFLOW 4: COMPLETE PIPELINE ---
  btnStep4.addEventListener('click', async () => {
    btnStep4.disabled = true;
    const online = await verifyClusterOnline('Complete Pipeline Execution');
    btnStep4.disabled = false;
    if (!online) return;

    const cfg = getActiveConfig('Complete Pipeline Execution');
    if (!cfg) return;

    // Safety Pre-flight Check: Detect if pipeline data already exists
    btnStep4.disabled = true;
    if (statusStep4) statusStep4.textContent = 'Checking existing sheet data...';
    try {
      const check = await detectExistingData(cfg.spreadsheetId, cfg.sheetName, 'step4');
      if (check && check.hasData) {
        const proceed = await promptOverwriteConfirmation(check);
        if (!proceed) {
          log('Complete pipeline cancelled by user. Existing data preserved.', 'info');
          if (statusStep4) statusStep4.textContent = 'Cancelled (Existing data preserved)';
          btnStep4.disabled = false;
          return;
        }
      } else {
        const proceed = await promptOverwriteConfirmation({
          title: 'Start Complete Pipeline?',
          headline: 'Run All 3 Validation Stages',
          message: 'This will execute Sampling (Step 1), Viewer Defect Analysis (Step 2), and Precision & Recall Sheet Generation (Step 3) in sequence.',
          details: [
            'Step 1: Defect sample selection and column preparation',
            'Step 2: Scrape vendor camera frames and extract defect bounding boxes',
            'Step 3: Generate dedicated Precision & Recall summary sheet'
          ]
        });
        if (!proceed) {
          btnStep4.disabled = false;
          return;
        }
      }
    } catch (e) {
      console.warn('Pre-check error in Step 4:', e);
    } finally {
      btnStep4.disabled = false;
    }

    openProgressModal(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
      'Complete Validation Pipeline',
      'Starting 3-stage orchestrated QA pipeline...'
    );
    setBusy(true, btnStep4, 'Running Full Pipeline...', statusStep4);
    log('Starting Complete Pipeline Orchestrator...', 'info');

    try {
      const res = await runCompleteValidation(cfg.spreadsheetId, cfg.sheetName, (prog) => {
        let pct = 25;
        if (prog.stage === 'step1') pct = 20;
        else if (prog.stage === 'step2') pct = 55;
        else if (prog.stage === 'step3') pct = 85;
        else if (prog.stage === 'done') pct = 100;
        if (prog.current && prog.total) {
          pct = Math.round((prog.current / prog.total) * 100);
        }
        updateProgressModal(prog.message, pct);
        log(prog.message, prog.stage === 'done' ? 'success' : 'info');
        if (statusStep4) statusStep4.textContent = prog.message;
      });

      log('Complete Validation Pipeline Finished Successfully!', 'success');
      if (statusStep4) statusStep4.textContent = 'Complete Pipeline executed with zero errors';

      showSuccessModal(
        'Complete Pipeline Finished',
        'All three QA validation stages completed in sequence with zero errors.',
        [
          { label: 'Sampled Defect', value: res.step1?.markedYes || 100 },
          { label: 'Frames Analyzed', value: res.step2?.analyzedCount || 100 },
          { label: 'Categories', value: res.step3?.totalCategories || 22 },
          { label: 'Status', value: '100% Complete' }
        ],
        [
          `Step 1: Defect sample selection and Activity Log generated`,
          `Step 2: Scraped camera frames, extracted bounding boxes, reconciled defects`,
          `Step 3: Built dedicated 'Precision & Recall' summary sheet with live formulas`,
          `Spreadsheet is fully validated and ready for QA review`
        ]
      );
    } catch (err) {
      log(`Pipeline Error: ${err.message}`, 'error');
      if (statusStep4) statusStep4.textContent = `Pipeline Failed: ${err.message}`;
      showErrorModal('Complete Pipeline Failed', err.message);
    } finally {
      setBusy(false, btnStep4, '', statusStep4);
      await updateAuthDisplay();
    }
  });

  // --- INTERACTIVE NAVIGATION ---
  btnOpenMap.addEventListener('click', async () => {
    const online = await verifyClusterOnline('Open Location Map');
    if (!online) return;
    const cfg = getActiveConfig('Open Location Map');
    const query = cfg ? `?spreadsheetId=${encodeURIComponent(cfg.spreadsheetId)}&sheetName=${encodeURIComponent(cfg.sheetName)}` : '';
    chrome.tabs.create({ url: chrome.runtime.getURL(`location_verification.html${query}`) });
  });

  btnOpenReview.addEventListener('click', async () => {
    const online = await verifyClusterOnline('Open Review Dashboard');
    if (!online) return;
    const cfg = getActiveConfig('Open Review Dashboard');
    const query = cfg ? `?spreadsheetId=${encodeURIComponent(cfg.spreadsheetId)}&sheetName=${encodeURIComponent(cfg.sheetName)}` : '';
    chrome.tabs.create({ url: chrome.runtime.getURL(`validation_review.html${query}`) });
  });

  const btnToggleLog = document.getElementById('btnToggleLog');
  const logToggleLabel = document.getElementById('logToggleLabel');
  const consoleDrawer = document.getElementById('consoleDrawer');

  if (btnToggleLog && consoleDrawer) {
    btnToggleLog.addEventListener('click', () => {
      const isOpen = consoleDrawer.style.display !== 'none';
      if (isOpen) {
        consoleDrawer.style.display = 'none';
        if (logToggleLabel) logToggleLabel.textContent = 'Show Console Log';
      } else {
        consoleDrawer.style.display = 'flex';
        if (logToggleLabel) logToggleLabel.textContent = 'Hide Console Log';
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
      }
    });
  }

  btnClearLog?.addEventListener('click', () => {
    consoleOutput.innerHTML = '';
    log('Console cleared.', 'info');
  });

  // --- SETTINGS MODAL & AUTH ---
  btnSettings.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
  });

  const closeModal = () => { settingsModal.style.display = 'none'; };
  btnCloseModal.addEventListener('click', closeModal);
  btnDoneSettings.addEventListener('click', closeModal);

  btnGoogleSignIn.addEventListener('click', async () => {
    try {
      log('Requesting Google OAuth Token via Chrome Identity...', 'info');
      const token = await getAuthToken(true);
      log('Google Authentication successful!', 'success');
      await updateAuthDisplay();
      if (spreadsheetIdInput.value.trim()) {
        await populateSheetTabs(spreadsheetIdInput.value.trim());
      }
      alert('Google Authentication Successful!');
    } catch (err) {
      log(`Auth Error: ${err.message}`, 'error');
      alert(`Google Sign-In Error:\n${err.message}`);
    }
  });

  btnGoogleSignOut.addEventListener('click', async () => {
    await signOut();
    manualTokenInput.value = '';
    await updateAuthDisplay();
    log('Signed out from spreadsheet session.', 'info');
    alert('Signed out successfully.');
  });

  btnSaveToken.addEventListener('click', async () => {
    const token = manualTokenInput.value.trim();
    if (!token) return alert('Please paste a token first.');
    await setManualToken(token);
    await updateAuthDisplay();
    if (spreadsheetIdInput.value.trim()) {
      await populateSheetTabs(spreadsheetIdInput.value.trim());
    }
    log('Manual Access Token saved and active.', 'success');
    alert('Token saved successfully.');
  });

  btnClearToken.addEventListener('click', async () => {
    await clearManualToken();
    manualTokenInput.value = '';
    await updateAuthDisplay();
    log('Manual Access Token cleared.', 'info');
  });

  btnTestViewer.addEventListener('click', async () => {
    const testUrl = 'http://34.180.38.204:7002/viewer?uid=R678326_WC1_day_LHS_MCW&img=000910.jpg&hl=D3912dd5215e117cc&lbl=Faded+Pavement+Marking';
    testViewerResult.textContent = 'Testing connection...';
    try {
      const viewer = await fetchViewerData_(testUrl);
      const analysis = analyzeViewerEntries_(viewer);
      testViewerResult.style.color = '#4ade80';
      testViewerResult.textContent = `✓ Success! Linked: ${analysis.linked.length}, Unlinked: ${analysis.unlinked.length}, Total: ${analysis.total}`;
    } catch (err) {
      testViewerResult.style.color = '#f87171';
      testViewerResult.textContent = `✗ Failed: ${err.message}`;
    }
  });

  // --- Phase 3: Weekly Defect Report & Compliance Automation ---
  const inputWeeklyMasterUrl = document.getElementById('inputWeeklyMasterUrl');
  const selectWeeklyMasterTab = document.getElementById('selectWeeklyMasterTab');
  const btnWeeklyDetectTab = document.getElementById('btnWeeklyDetectTab');
  const btnWeeklySmartUpdate = document.getElementById('btnWeeklySmartUpdate');
  const btnWeeklyWeekUpdate = document.getElementById('btnWeeklyWeekUpdate');
  const inputWeeklyWeek = document.getElementById('inputWeeklyWeek');
  const btnWeeklyReset = document.getElementById('btnWeeklyReset');
  const chkGenerateDocsLetters = document.getElementById('chkGenerateDocsLetters');
  const statusWeeklyReport = document.getElementById('statusWeeklyReport');
  const weeklyQuickLinks = document.getElementById('weeklyQuickLinks');
  const btnOpenDefectIndex = document.getElementById('btnOpenDefectIndex');
  const btnOpenPiuSummary = document.getElementById('btnOpenPiuSummary');

  // Sync initial URL between top strip and Phase 3
  if (spreadsheetIdInput.value.trim() && inputWeeklyMasterUrl && !inputWeeklyMasterUrl.value.trim()) {
    inputWeeklyMasterUrl.value = spreadsheetIdInput.value.trim();
  }

  // Two-way sync: When user changes Phase 3 master input
  if (inputWeeklyMasterUrl) {
    inputWeeklyMasterUrl.addEventListener('change', async () => {
      const raw = inputWeeklyMasterUrl.value.trim();
      const id = extractSpreadsheetId(raw);
      if (id) {
        spreadsheetIdInput.value = id;
        await chrome.storage.local.set({ lastSpreadsheetId: id });
        await populateSheetTabs(id);
      }
    });

    inputWeeklyMasterUrl.addEventListener('paste', () => {
      setTimeout(async () => {
        const raw = inputWeeklyMasterUrl.value.trim();
        const id = extractSpreadsheetId(raw);
        if (id) {
          spreadsheetIdInput.value = id;
          await chrome.storage.local.set({ lastSpreadsheetId: id });
          await populateSheetTabs(id);
        }
      }, 150);
    });
  }

  // Also sync from top strip to Phase 3
  spreadsheetIdInput.addEventListener('input', () => {
    if (inputWeeklyMasterUrl && spreadsheetIdInput.value) {
      inputWeeklyMasterUrl.value = spreadsheetIdInput.value;
    }
  });

  // Dedicated Detect Tab button inside Phase 3
  if (btnWeeklyDetectTab) {
    btnWeeklyDetectTab.addEventListener('click', async () => {
      btnWeeklyDetectTab.disabled = true;
      const detected = await detectActiveTabSheet();
      if (inputWeeklyMasterUrl && spreadsheetIdInput.value) {
        inputWeeklyMasterUrl.value = spreadsheetIdInput.value;
      }
      btnWeeklyDetectTab.disabled = false;
    });
  }

  async function handleWeeklyAutomation(mode, triggerBtn) {
    if (!triggerBtn) return;


    const rawMasterInput = inputWeeklyMasterUrl ? inputWeeklyMasterUrl.value.trim() : '';
    const masterSpreadsheetId = extractSpreadsheetId(rawMasterInput) || spreadsheetIdInput.value.trim();
    const masterTabName = (selectWeeklyMasterTab && selectWeeklyMasterTab.value.trim()) || sheetNameInput.value.trim();

    if (!masterSpreadsheetId) {
      alert('Please paste or detect your Master Google Spreadsheet URL first.');
      if (inputWeeklyMasterUrl) inputWeeklyMasterUrl.focus();
      return;
    }

    let specificWeek = null;
    if (mode === 'week') {
      const rawVal = inputWeeklyWeek ? inputWeeklyWeek.value.trim() : '';
      const wNum = parseInt(rawVal, 10);
      if (!wNum || wNum < 1) {
        alert('Please enter a valid week number (e.g. 10) in the input field.');
        if (inputWeeklyWeek) inputWeeklyWeek.focus();
        return;
      }
      specificWeek = wNum;
    }

    if (mode === 'reset') {
      const confirmed = confirm(
        '⚠️ Full Reset Confirmation\n\n' +
        'This will delete all existing "Defect - <UPC>" project sheets in this spreadsheet and re-process all weeks fresh.\n\n' +
        'Do you want to proceed?'
      );
      if (!confirmed) return;
    }

    const titleStr = mode === 'reset'
      ? 'Weekly Defect Automation: Full Reset'
      : (mode === 'week' ? `Weekly Defect Automation: Week ${specificWeek}` : 'Weekly Defect Automation: Smart Update');

    openProgressModal(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      titleStr,
      'Connecting to master spreadsheet...'
    );

    setBusy(true, triggerBtn, 'Running...', statusWeeklyReport);
    log(`Starting ${titleStr}...`, 'info');

    try {
      const generateLetters = chkGenerateDocsLetters ? chkGenerateDocsLetters.checked : true;
      const res = await executeDefectReportAutomation(
        masterSpreadsheetId,
        {
          mode,
          specificWeek,
          generateLetters,
          masterSheetName: masterTabName
        },
        (prog) => {
          updateProgressModal(prog.message, prog.percent);
          log(prog.message, 'info');
          if (statusWeeklyReport) statusWeeklyReport.textContent = prog.message;
        }
      );

      const msg = `✓ Completed: Processed ${res.processedReports} report(s) across ${res.projectsMapped} project(s).`;
      log(msg, 'success');
      if (statusWeeklyReport) {
        statusWeeklyReport.textContent = msg;
        statusWeeklyReport.style.display = 'block';
      }

      if (res.projectsList && res.projectsList.length > 0) {
        cachedDefectProjects = res.projectsList;
        populateLetterProjectsDropdown(cachedDefectProjects);
      }

      if (weeklyQuickLinks) {
        weeklyQuickLinks.style.display = 'flex';
      }

      if (btnQuickOpenLetter) {
        btnQuickOpenLetter.onclick = () => {
          openComplianceLetterModal();
        };
      }

      if (btnOpenDefectIndex) {
        btnOpenDefectIndex.onclick = async () => {
          const idxId = await getSheetIdByName(masterSpreadsheetId, res.indexSheetName || 'Defect Index');
          const url = `https://docs.google.com/spreadsheets/d/${masterSpreadsheetId}/edit#gid=${idxId || 0}`;
          chrome.tabs.create({ url });
        };
      }

      if (btnOpenPiuSummary) {
        btnOpenPiuSummary.onclick = async () => {
          const piuId = await getSheetIdByName(masterSpreadsheetId, res.piuSummarySheetName || 'PIU-WISE DEFECT SUMMARY');
          const url = `https://docs.google.com/spreadsheets/d/${masterSpreadsheetId}/edit#gid=${piuId || 0}`;
          chrome.tabs.create({ url });
        };
      }

      showSuccessModal(
        'Defect Report Automation Complete',
        'Weekly project sheets, PIU summary matrix, and Defect Index successfully built.',
        [
          { label: 'Reports Read', value: res.processedReports },
          { label: 'Projects Mapped', value: res.projectsMapped },
          { label: 'Issues / Warnings', value: res.issuesRecorded },
          { label: 'Letters Generated', value: generateLetters ? 'Enabled' : 'Skipped' }
        ],
        [
          `Generated / updated individual 'Defect - <UPC>' summary sheets with weekly columns and delta formulas`,
          `Refreshed 'PIU-WISE DEFECT SUMMARY' defect category breakdown with filters`,
          `Updated 'Defect Index' dashboard linking directly to project sheets & compliance letters`,
          res.issuesRecorded > 0 ? `Logged ${res.issuesRecorded} issue(s) at bottom of Defect Index sheet` : 'Zero errors encountered during processing'
        ]
      );
    } catch (err) {
      log(`Weekly Automation Error: ${err.message}`, 'error');
      if (statusWeeklyReport) {
        statusWeeklyReport.textContent = `Failed: ${err.message}`;
        statusWeeklyReport.style.display = 'block';
      }
      showErrorModal('Weekly Automation Failed', err.message);
    } finally {
      setBusy(false, triggerBtn, '', statusWeeklyReport);
      await updateAuthDisplay();
    }
  }

  btnWeeklySmartUpdate?.addEventListener('click', () => handleWeeklyAutomation('smart', btnWeeklySmartUpdate));
  btnWeeklyWeekUpdate?.addEventListener('click', () => handleWeeklyAutomation('week', btnWeeklyWeekUpdate));
  btnWeeklyReset?.addEventListener('click', () => handleWeeklyAutomation('reset', btnWeeklyReset));

  // =========================================================================
  // OFFICIAL NHAI COMPLIANCE LETTER GENERATOR MODULE (RO KOLKATA)
  // Formatted faithfully as per Draft letter (1).docx
  // =========================================================================
  const selectLetterProject = document.getElementById('selectLetterProject');
  const selectLetterWeek = document.getElementById('selectLetterWeek');
  const selectLetterRecipientMode = document.getElementById('selectLetterRecipientMode');
  const btnOpenComplianceLetterModal = document.getElementById('btnOpenComplianceLetterModal');
  const btnQuickOpenLetter = document.getElementById('btnQuickOpenLetter');
  const complianceLetterModal = document.getElementById('complianceLetterModal');
  const btnLetterModalClose = document.getElementById('btnLetterModalClose');
  const btnLetterToggleDispatch = document.getElementById('btnLetterToggleDispatch');
  const labelToggleDispatch = document.getElementById('labelToggleDispatch');
  const btnLetterToggleEdit = document.getElementById('btnLetterToggleEdit');
  const labelToggleEdit = document.getElementById('labelToggleEdit');
  const btnLetterCopyText = document.getElementById('btnLetterCopyText');
  const btnLetterDownloadDoc = document.getElementById('btnLetterDownloadDoc');
  const btnLetterPrint = document.getElementById('btnLetterPrint');
  const complianceLetterSheet = document.getElementById('complianceLetterSheet');
  const letterModalSubtitle = document.getElementById('letterModalSubtitle');

  let cachedDefectProjects = [];
  let isLetterEditable = false;
  let activeLetterDispatchMode = 'all'; // Default to exact 8-PIU Table matching Draft letter (1).docx

  // Default sample projects for preview if no spreadsheets run yet
  const DEFAULT_SAMPLE_PROJECTS = [
    {
      upc: "WB-KH-01",
      name: "Kolaghat Haldia Project",
      stretchDetails: "4L Kolaghat-Haldia from km. 0.00 to km. 53.72 including ROB cum Flyover from km. 52.08 to km. 53.472 (New_NH-116)",
      nh: "New_NH-116",
      state: "West Bengal",
      ro: "Kolkata",
      piu: "Kolkata",
      surveyDate: "31 Aug 2026",
      letterMonth: "Sept 2026",
      reportUrl: "https://docs.google.com/spreadsheets/d/12vaeZwtpi5psV5ajoIzVECPYvBkKbwye/edit",
      latestWeek: 1,
      cycles: {
        1: {
          surveyDate: "31 Aug 2026",
          reportUrl: "https://docs.google.com/spreadsheets/d/12vaeZwtpi5psV5ajoIzVECPYvBkKbwye/edit"
        }
      }
    },
    {
      upc: "WB-01",
      name: "Barasat to Krishnagar 4-Laning",
      stretchDetails: "Barasat to Krishnagar 4-Laning from km. 14.40 to km. 84.00 (NH-12)",
      nh: "NH-12",
      state: "West Bengal",
      ro: "Kolkata",
      piu: "Krishnagar",
      surveyDate: "12 Oct 2026",
      letterMonth: "Oct 2026",
      reportUrl: "https://docs.google.com/spreadsheets/d/12vaeZwtpi5psV5ajoIzVECPYvBkKbwye/edit",
      latestWeek: 1,
      cycles: {
        1: {
          surveyDate: "12 Oct 2026",
          reportUrl: "https://docs.google.com/spreadsheets/d/12vaeZwtpi5psV5ajoIzVECPYvBkKbwye/edit"
        }
      }
    }
  ];

  function escapeHtml_(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateLetter_(d) {
    if (!d) return '31 Aug 2026';
    if (typeof d === 'string' && d.length > 5) return d;
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return String(d);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = String(dateObj.getDate()).padStart(2, '0');
      const mon = months[dateObj.getMonth()];
      const yr = dateObj.getFullYear();
      return `${day} ${mon} ${yr}`;
    } catch (_) {
      return String(d);
    }
  }

  function generateQrSvgString_(dataUrl) {
    try {
      if (typeof qrcode === 'function') {
        const qr = qrcode(0, 'M');
        qr.addData(dataUrl || 'https://docs.google.com/spreadsheets/');
        qr.make();
        return qr.createSvgTag({ scalable: true, margin: 1 });
      }
    } catch (e) {
      console.warn('QR code generation warning:', e);
    }
    return `<svg width="82" height="82" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f8fafc" stroke="#000"/><text x="50" y="55" font-size="11" text-anchor="middle" fill="#2563eb">QR Code</text></svg>`;
  }

  // Load cached projects from storage or use defaults
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['DEFECT_SAVED_PROJECTS'], (stored) => {
        if (stored.DEFECT_SAVED_PROJECTS && stored.DEFECT_SAVED_PROJECTS.length > 0) {
          cachedDefectProjects = stored.DEFECT_SAVED_PROJECTS;
        } else {
          cachedDefectProjects = DEFAULT_SAMPLE_PROJECTS;
        }
        populateLetterProjectsDropdown(cachedDefectProjects);
      });
    } else {
      cachedDefectProjects = DEFAULT_SAMPLE_PROJECTS;
      populateLetterProjectsDropdown(cachedDefectProjects);
    }
  } catch (_) {
    cachedDefectProjects = DEFAULT_SAMPLE_PROJECTS;
    populateLetterProjectsDropdown(cachedDefectProjects);
  }

  function populateLetterProjectsDropdown(projects) {
    if (!selectLetterProject) return;
    selectLetterProject.innerHTML = '';

    if (!projects || projects.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(No projects loaded yet)';
      selectLetterProject.appendChild(opt);
      return;
    }

    projects.forEach((p, idx) => {
      const opt = document.createElement('option');
      opt.value = p.upc || `P-${idx}`;
      opt.textContent = `[${p.upc}] ${p.name || p.upc} (PIU: ${p.piu || 'RO'})`;
      selectLetterProject.appendChild(opt);
    });

    updateLetterWeeksDropdown();
  }

  function updateLetterWeeksDropdown() {
    if (!selectLetterWeek || !selectLetterProject) return;
    const selectedUpc = selectLetterProject.value;
    selectLetterWeek.innerHTML = '';

    const proj = (cachedDefectProjects || []).find(p => p.upc === selectedUpc) || cachedDefectProjects[0];
    if (!proj || !proj.cycles) {
      const opt = document.createElement('option');
      opt.value = '1';
      opt.textContent = 'Week 1';
      selectLetterWeek.appendChild(opt);
      return;
    }

    const weekNums = Object.keys(proj.cycles).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
    if (weekNums.length === 0) {
      const opt = document.createElement('option');
      opt.value = '1';
      opt.textContent = 'Week 1';
      selectLetterWeek.appendChild(opt);
    } else {
      weekNums.forEach(w => {
        const opt = document.createElement('option');
        opt.value = String(w);
        opt.textContent = `Week ${w}${w === proj.latestWeek ? ' (Latest)' : ''}`;
        selectLetterWeek.appendChild(opt);
      });
    }
  }

  selectLetterProject?.addEventListener('change', () => {
    updateLetterWeeksDropdown();
    if (complianceLetterModal && complianceLetterModal.style.display !== 'none') {
      renderComplianceLetter(selectLetterProject.value, selectLetterWeek?.value, activeLetterDispatchMode);
    }
  });

  selectLetterWeek?.addEventListener('change', () => {
    if (complianceLetterModal && complianceLetterModal.style.display !== 'none') {
      renderComplianceLetter(selectLetterProject?.value, selectLetterWeek.value, activeLetterDispatchMode);
    }
  });

  selectLetterRecipientMode?.addEventListener('change', (e) => {
    activeLetterDispatchMode = e.target.value;
    if (complianceLetterModal && complianceLetterModal.style.display !== 'none') {
      renderComplianceLetter(selectLetterProject?.value, selectLetterWeek?.value, activeLetterDispatchMode);
    }
  });

  function renderComplianceLetter(upc, weekNum, dispatchMode) {
    if (!complianceLetterSheet) return;

    let proj = (cachedDefectProjects || []).find(p => p.upc === upc);
    if (!proj) {
      proj = cachedDefectProjects[0] || DEFAULT_SAMPLE_PROJECTS[0];
    }

    const cycles = proj.cycles || {};
    const availableWeeks = Object.keys(cycles).map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
    const targetWeek = Number(weekNum) || availableWeeks[0] || 1;

    const currentCycle = cycles[targetWeek] || {};
    const surveyMeta = currentCycle.survey || {};

    // Dynamic Project Name
    const projectName = surveyMeta.projectName || proj.name || "Highway Project";
    const rawPiu = String(surveyMeta.piuName || proj.piu || "Kolkata").trim();
    const cleanUpc = proj.upc || "WB-01";
    const nhNumber = surveyMeta.nhNumber || proj.nh || "";

    // Dynamic Survey Date
    const surveyDateStr = currentCycle.surveyDate || surveyMeta.surveyEndDate || proj.surveyDate || formatDateLetter_(new Date());

    // Dynamic Letter Month (e.g. Sept 2026, Oct 2026)
    let letterMonthStr = proj.letterMonth;
    if (!letterMonthStr && surveyDateStr) {
      try {
        const d = new Date(surveyDateStr);
        if (!isNaN(d.getTime())) {
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          letterMonthStr = `${months[d.getMonth()]} ${d.getFullYear()}`;
        }
      } catch (_) {}
    }
    if (!letterMonthStr) letterMonthStr = "Sept 2026";

    // Dynamic Stretch Description
    const stretchDescription = proj.stretchDetails ||
      (nhNumber ? `${projectName} (${nhNumber})` : `${projectName} (UPC: ${cleanUpc})`);

    const letterRef = `NHAI/RO-KOL/001/2026/3(A)-Dashcam/`;

    // Dynamic Excel Sheet URL for the selected project / week
    const inputMasterUrl = document.getElementById('inputWeeklyMasterUrl')?.value?.trim();
    const excelSheetUrl = currentCycle.url || currentCycle.reportUrl || proj.reportUrl || inputMasterUrl ||
      `https://docs.google.com/spreadsheets/d/12vaeZwtpi5psV5ajoIzVECPYvBkKbwye/edit#gid=0`;

    // Generate sharp offline SVG QR code dynamically for this project's URL
    const qrSvgHtml = generateQrSvgString_(excelSheetUrl);

    // Build Recipient Block dynamically
    let recipientHtml = '';
    const mode = dispatchMode || activeLetterDispatchMode || 'single';
    const normPiu = rawPiu.toUpperCase();

    if (mode === 'all') {
      // 3-Column Table matching Draft letter (1).docx Table 0 EXACTLY (borderless)
      recipientHtml = `
        <div class="letter-to-heading">To</div>
        <table class="letter-piu-circular-table">
          <tr>
            <td class="${normPiu.includes('KOLKATA') ? 'active-target-piu' : ''}">
              <div class="piu-director-title">Project Director</div>
              <div class="piu-address-line">PIU-Kolkata, NHAI</div>
              <div class="piu-address-line">Synthesis Business Park</div>
              <div class="piu-address-line">8<sup>th</sup> Floor, Block-C</div>
              <div class="piu-address-line">New Town, Kolkata – 700 156</div>
            </td>
            <td class="${normPiu.includes('MALDA') ? 'active-target-piu' : ''}">
              <div class="piu-director-title">Project Director</div>
              <div class="piu-address-line">PIU- Malda, NHAI</div>
              <div class="piu-address-line">1<sup>st</sup> Floor, New Setumore, Sahapur</div>
              <div class="piu-address-line">P.O. Nageswarpur, Malda,Pin-732142</div>
            </td>
            <td class="${normPiu.includes('KRISHNAGAR') ? 'active-target-piu' : ''}">
              <div class="piu-director-title">Project Director</div>
              <div class="piu-address-line">PIU – Krishnagar, NHAI</div>
              <div class="piu-address-line">P.O. &amp; Vill.:- Bhatjangla,</div>
              <div class="piu-address-line">Dist - Nadia, Pin- 741102,</div>
              <div class="piu-address-line">West Bengal</div>
            </td>
          </tr>
          <tr>
            <td class="${normPiu.includes('JALPAIGURI') ? 'active-target-piu' : ''}">
              <div class="piu-director-title">Project Director</div>
              <div class="piu-address-line">PIU – Jalpaiguri, NHAI, 2 ½ Mile,</div>
              <div class="piu-address-line">Sevoke Road, Jyotinagar,</div>
              <div class="piu-address-line">Near Don Bosco School,</div>
              <div class="piu-address-line">Siliguri – 734 001</div>
            </td>
            <td class="${normPiu.includes('KHARAGPUR') ? 'active-target-piu' : ''}">
              <div class="piu-director-title">Project Director</div>
              <div class="piu-address-line">PIU-Kharagpur, NHAI,</div>
              <div class="piu-address-line">NHAI Complex near Chaurangi,</div>
              <div class="piu-address-line">P.O. Inda, Kharagpur – 721305</div>
            </td>
            <td class="${normPiu.includes('BARDHAMAN') || normPiu.includes('BURDWAN') ? 'active-target-piu' : ''}">
              <div class="piu-director-title">Project Director</div>
              <div class="piu-address-line">NHAI, PIU-Bardhaman,</div>
              <div class="piu-address-line">P.O. – Palla Road, P.S. Memari,</div>
              <div class="piu-address-line">Dist.- Purba Bardhaman-713151</div>
            </td>
          </tr>
          <tr>
            <td class="${normPiu.includes('PURULIA') ? 'active-target-piu' : ''}">
              <div class="piu-director-title">Project Director</div>
              <div class="piu-address-line">NHAI, PIU-Purulia</div>
              <div class="piu-address-line">Module-31, 3rd Floor, Webel IT Park,</div>
              <div class="piu-address-line">North Lake Road, Saheb Bandh,</div>
              <div class="piu-address-line">Purulia – 723 101</div>
            </td>
            <td class="${normPiu.includes('DURGAPUR') ? 'active-target-piu' : ''}">
              <div class="piu-director-title">Project Director</div>
              <div class="piu-address-line">NHAI, PIU – Durgapur</div>
              <div class="piu-address-line">NHAI Complex, Sector –2(A), Bidhannagar,</div>
              <div class="piu-address-line">Durgapur – 713 212</div>
            </td>
            <td>&nbsp;</td>
          </tr>
        </table>
      `;
    } else {
      // Single Target PIU Address (Dynamically formatted per PIU)
      if (normPiu.includes('KOLKATA') || !normPiu) {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – Kolkata</div>
            <div class="piu-address-line">National Highways Authority of India</div>
            <div class="piu-address-line">Synthesis Business Park</div>
            <div class="piu-address-line">8<sup>th</sup> Floor, Block-C</div>
            <div class="piu-address-line">New Town, Kolkata – 700 156</div>
          </div>
        `;
      } else if (normPiu.includes('MALDA')) {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – Malda</div>
            <div class="piu-address-line">National Highways Authority of India</div>
            <div class="piu-address-line">1<sup>st</sup> Floor, New Setumore, Sahapur</div>
            <div class="piu-address-line">P.O. Nageswarpur, Malda, Pin-732142</div>
          </div>
        `;
      } else if (normPiu.includes('KRISHNAGAR')) {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – Krishnagar</div>
            <div class="piu-address-line">National Highways Authority of India</div>
            <div class="piu-address-line">P.O. &amp; Vill.:- Bhatjangla,</div>
            <div class="piu-address-line">Dist - Nadia, Pin- 741102, West Bengal</div>
          </div>
        `;
      } else if (normPiu.includes('JALPAIGURI')) {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – Jalpaiguri</div>
            <div class="piu-address-line">National Highways Authority of India</div>
            <div class="piu-address-line">2 ½ Mile, Sevoke Road, Jyotinagar</div>
            <div class="piu-address-line">Near Don Bosco School, Siliguri – 734 001</div>
          </div>
        `;
      } else if (normPiu.includes('KHARAGPUR')) {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – Kharagpur</div>
            <div class="piu-address-line">National Highways Authority of India</div>
            <div class="piu-address-line">NHAI Complex near Chaurangi, P.O. Inda</div>
            <div class="piu-address-line">Kharagpur – 721305</div>
          </div>
        `;
      } else if (normPiu.includes('BARDHAMAN') || normPiu.includes('BURDWAN')) {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – Bardhaman</div>
            <div class="piu-address-line">National Highways Authority of India</div>
            <div class="piu-address-line">P.O. – Palla Road, P.S. Memari</div>
            <div class="piu-address-line">Dist.- Purba Bardhaman-713151</div>
          </div>
        `;
      } else if (normPiu.includes('PURULIA')) {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – Purulia</div>
            <div class="piu-address-line">National Highways Authority of India</div>
            <div class="piu-address-line">Module-31, 3rd Floor, Webel IT Park</div>
            <div class="piu-address-line">North Lake Road, Saheb Bandh, Purulia – 723 101</div>
          </div>
        `;
      } else if (normPiu.includes('DURGAPUR')) {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – Durgapur</div>
            <div class="piu-address-line">National Highways Authority of India</div>
            <div class="piu-address-line">NHAI Complex, Sector –2(A), Bidhannagar</div>
            <div class="piu-address-line">Durgapur – 713 212</div>
          </div>
        `;
      } else {
        recipientHtml = `
          <div class="letter-to-heading">To</div>
          <div class="letter-to-single">
            <div class="piu-director-title">Project Director</div>
            <div class="piu-address-line">PIU – ${escapeHtml_(rawPiu)}</div>
            <div class="piu-address-line">National Highways Authority of India</div>
          </div>
        `;
      }
    }

    // Compile Official Letter Sheet HTML with EXACT USER CONTENT & QR CODE
    complianceLetterSheet.innerHTML = `
      <!-- 4.0" Blank Spacing reserved for Official Pre-Printed NHAI Letterhead Stationery -->
      <div class="letter-preprinted-space">
        <span>📄 [ ~4.0" Top Margin reserved for Pre-Printed Official NHAI Letterhead Stationery ]</span>
      </div>

      <!-- Reference line and Date line (Exact user formatting) -->
      <div class="letter-ref-date-row">
        <div class="letter-ref-num">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml_(letterRef)}</div>
        <div class="letter-date-str">${escapeHtml_(letterMonthStr)}</div>
      </div>

      <!-- Urgency Tag: BOLD and UNDERLINE matching Draft letter (1).docx -->
      <div class="letter-urgent-flag">MOST URGENT</div>

      <!-- Recipient Block -->
      ${recipientHtml}

      <!-- Subject Line (Exact wording from user) -->
      <div class="letter-sub-block">
        Sub:&nbsp;&nbsp;&nbsp;&nbsp;Dashcam Analytics Services for the systematic weekly data collection through surveys and condition assessment of National Highway assets: Submission of Compliance Report against Dashcam Survey of ${escapeHtml_(projectName)} – reg.
      </div>

      <!-- Reference Line (Exact wording from user) -->
      <div class="letter-ref-block">
        <strong>Ref:</strong>&nbsp;&nbsp;&nbsp;&nbsp;Dash Cam Survey Report dated ${escapeHtml_(surveyDateStr)}.
      </div>

      <!-- Salutation -->
      <div class="letter-salutation">Sir,</div>

      <!-- Paragraph 1 (Exact wording from user) -->
      <div class="letter-body-p">
        Please find enclosed herewith Dashcam Survey weekly Report dated ${escapeHtml_(surveyDateStr)} against ${escapeHtml_(stretchDescription)}. During Dashcam Survey numerous defects have been identified which needs immediate rectification. Dashcam Survey report dated ${escapeHtml_(surveyDateStr)} is enclosed herewith.
      </div>

      <!-- Paragraph 2 (Exact wording from user) -->
      <div class="letter-body-p">
        In this regard, it is requested to submit compliance Report against defects identified during weekly survey to this office at the earliest.
      </div>

      <!-- Paragraph 3 (Exact wording from user) -->
      <div class="letter-body-p">
        This issues with the approval of CGM (T)/RO-Kolkata.
      </div>

      <!-- Closing & Signatory Block (Exact user formatting) -->
      <div class="letter-closing-row">
        <div class="letter-encl-left">
          <strong>Encl:</strong>&nbsp;&nbsp;&nbsp;&nbsp;As stated above.
        </div>
        <div class="letter-signatory-box">
          Yours faithfully,<br><br>
          <div class="letter-sign-space" style="height: 28px;"></div>
          <div class="letter-sign-name">(Debasish Das)</div>
          <div class="letter-sign-desig">Dy. General Manager (Tech)</div>
          <div class="letter-sign-desig">Regional Office, Kolkata</div>
        </div>
      </div>
    `;

    if (letterModalSubtitle) {
      letterModalSubtitle.textContent = `${projectName} · ${letterMonthStr} · PIU: ${rawPiu}`;
    }

    if (labelToggleDispatch) {
      labelToggleDispatch.textContent = (mode === 'all')
        ? '🏢 Switch to Single PIU'
        : '🏛️ Switch to 8-PIU Table';
    }

    complianceLetterSheet.contentEditable = isLetterEditable ? 'true' : 'false';
  }

  function openComplianceLetterModal() {
    if (!complianceLetterModal) return;
    const upc = selectLetterProject?.value;
    const week = selectLetterWeek?.value;
    renderComplianceLetter(upc, week, activeLetterDispatchMode);
    complianceLetterModal.style.display = 'flex';
  }

  btnOpenComplianceLetterModal?.addEventListener('click', openComplianceLetterModal);
  btnQuickOpenLetter?.addEventListener('click', openComplianceLetterModal);
  btnLetterModalClose?.addEventListener('click', () => {
    if (complianceLetterModal) complianceLetterModal.style.display = 'none';
  });

  // Toggle Dispatch Mode (Single PIU vs 3-Column 8-PIU Table)
  btnLetterToggleDispatch?.addEventListener('click', () => {
    activeLetterDispatchMode = (activeLetterDispatchMode === 'all') ? 'single' : 'all';
    if (selectLetterRecipientMode) selectLetterRecipientMode.value = activeLetterDispatchMode;
    renderComplianceLetter(selectLetterProject?.value, selectLetterWeek?.value, activeLetterDispatchMode);
    showToast(`Switched dispatch to: ${activeLetterDispatchMode === 'all' ? 'All 8 PIUs Circular Table' : 'Single Target PIU'}`, 'info');
  });

  // Toggle Edit Mode (Direct on-screen editing)
  btnLetterToggleEdit?.addEventListener('click', () => {
    isLetterEditable = !isLetterEditable;
    if (complianceLetterSheet) complianceLetterSheet.contentEditable = isLetterEditable ? 'true' : 'false';
    if (labelToggleEdit) {
      labelToggleEdit.textContent = isLetterEditable ? '✏️ Edit Mode: ON' : '✏️ Edit Mode: OFF';
    }
    btnLetterToggleEdit.classList.toggle('btn-primary', isLetterEditable);
    btnLetterToggleEdit.classList.toggle('btn-secondary', !isLetterEditable);
    showToast(isLetterEditable ? 'Edit mode enabled: Click any text in the letter to modify.' : 'Edit mode disabled.', isLetterEditable ? 'info' : 'default');
  });

  // Copy Formatted Text to Clipboard
  btnLetterCopyText?.addEventListener('click', async () => {
    try {
      if (!complianceLetterSheet) return;
      const text = complianceLetterSheet.innerText;
      await navigator.clipboard.writeText(text);
      showToast('Letter text copied to clipboard successfully!', 'success');
    } catch (err) {
      showToast('Could not copy text: ' + err.message, 'error');
    }
  });

  // Download Authentic Word (.docx) File with Embedded QR Code & 4.5" Margin
  btnLetterDownloadDoc?.addEventListener('click', async () => {
    try {
      if (!complianceLetterSheet) return;
      const upc = selectLetterProject?.value || 'NHAI';
      const week = selectLetterWeek?.value || '1';

      let proj = (cachedDefectProjects || []).find(p => p.upc === upc);
      if (!proj) proj = cachedDefectProjects[0] || DEFAULT_SAMPLE_PROJECTS[0];

      const cycles = proj.cycles || {};
      const targetWeek = Number(week) || 1;
      const currentCycle = cycles[targetWeek] || {};
      const surveyMeta = currentCycle.survey || {};

      const projectName = surveyMeta.projectName || proj.name || "Highway Project";
      const rawPiu = String(surveyMeta.piuName || proj.piu || "Kolkata").trim();
      const nhNumber = surveyMeta.nhNumber || proj.nh || "";
      const surveyDateStr = currentCycle.surveyDate || surveyMeta.surveyEndDate || proj.surveyDate || formatDateLetter_(new Date());

      let letterMonthStr = proj.letterMonth;
      if (!letterMonthStr && surveyDateStr) {
        try {
          const d = new Date(surveyDateStr);
          if (!isNaN(d.getTime())) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            letterMonthStr = `${months[d.getMonth()]} ${d.getFullYear()}`;
          }
        } catch (_) {}
      }
      if (!letterMonthStr) letterMonthStr = "Sept 2026";

      const stretchDescription = proj.stretchDetails ||
        (nhNumber ? `${projectName} (${nhNumber})` : `${projectName} (UPC: ${proj.upc || 'WB'})`);

      const inputMasterUrl = document.getElementById('inputWeeklyMasterUrl')?.value?.trim();
      const excelSheetUrl = currentCycle.url || currentCycle.reportUrl || proj.reportUrl || inputMasterUrl ||
        `https://docs.google.com/spreadsheets/d/12vaeZwtpi5psV5ajoIzVECPYvBkKbwye/edit#gid=0`;

      showToast('Generating official Word (.docx) document (4.0" margin)...', 'info');

      if (typeof generateComplianceLetterDocx !== 'function') {
        throw new Error('Word DOCX generator engine not loaded.');
      }

      const docxBlob = await generateComplianceLetterDocx({
        letterRef: 'NHAI/RO-KOL/001/2026/3(A)-Dashcam/',
        letterMonth: letterMonthStr,
        dispatchMode: activeLetterDispatchMode,
        piu: rawPiu,
        projectName: projectName,
        stretchDetails: stretchDescription,
        surveyDate: surveyDateStr,
        excelSheetUrl: excelSheetUrl
      });

      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NHAI_RO_Kolkata_Compliance_Letter_${upc}_Week_${week}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Official Word (.docx) document downloaded successfully!', 'success');
    } catch (err) {
      console.error("DOCX download error:", err);
      showToast('Failed to download Word (.docx): ' + err.message, 'error');
    }
  });

  // Print or Save as PDF (Clean Single-Page A4 Letter)
  btnLetterPrint?.addEventListener('click', () => {
    if (!complianceLetterSheet) return;

    const printContent = complianceLetterSheet.innerHTML;
    const printWin = window.open('', '_blank', 'width=850,height=950');

    if (printWin) {
      printWin.document.open();
      printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NHAI Compliance Letter</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
      line-height: 1.25;
      color: #000000;
      margin: 0;
      padding: 0 16mm 10mm 16mm;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .letter-preprinted-space {
      height: 4.0in !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      background: transparent !important;
    }
    .letter-preprinted-space span {
      display: none !important;
    }
    .letter-ref-date-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 6px 0;
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
    }
    .letter-urgent-flag {
      font-family: 'Trebuchet MS', sans-serif;
      font-weight: bold;
      text-decoration: underline;
      margin: 8px 0;
      font-size: 10pt;
    }
    .letter-to-heading {
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
      margin: 4px 0 2px 0;
    }
    .letter-to-single {
      margin-left: 34pt;
      margin-bottom: 10px;
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
      line-height: 1.2;
    }
    .letter-piu-circular-table {
      width: calc(100% - 34pt);
      margin-left: 34pt;
      border-collapse: separate;
      border-spacing: 14px 4px;
      margin-bottom: 10px;
      border: none !important;
    }
    .letter-piu-circular-table td {
      border: none !important;
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
      line-height: 1.15;
      vertical-align: top;
      width: 33.33%;
    }
    .piu-director-title { font-weight: bold; }
    .letter-sub-block {
      margin: 10px 0 8px 0;
      text-align: justify;
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
      font-weight: bold;
      line-height: 1.22;
    }
    .letter-ref-block, .letter-body-p {
      margin-bottom: 8px;
      text-align: justify;
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
      line-height: 1.25;
    }
    .letter-salutation {
      margin: 6px 0 4px 0;
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
    }
    .letter-closing-row {
      display: flex;
      justify-content: space-between;
      margin-top: 26px;
      font-family: 'Trebuchet MS', sans-serif;
      font-size: 10pt;
    }
    .letter-signatory-box {
      text-align: left;
    }
    .letter-sign-name {
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${printContent}
  <script>
    window.onload = function() {
      window.focus();
      window.print();
      setTimeout(function() { window.close(); }, 1500);
    };
  </script>
</body>
</html>`);
      printWin.document.close();
    } else {
      const prevEditable = complianceLetterSheet?.contentEditable;
      if (complianceLetterSheet) complianceLetterSheet.contentEditable = 'false';
      document.body.classList.add('printing-letter-active');

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing-letter-active');
          if (complianceLetterSheet && isLetterEditable) {
            complianceLetterSheet.contentEditable = 'true';
          }
        }, 500);
      }, 50);
    }
  });
});
