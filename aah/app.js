(function () {
  'use strict';

  /* ================================================================== */
  /* 1. CONSTANTS & CONFIGURATION                                       */
  /* ================================================================== */
  const STORAGE_KEY = 'COMPLIANCE_DESK_STATE_V1';
  const STATE_SCHEMA_VERSION = 1;

  const OUTCOMES = [
    'Pass',
    'Record Keeping Error (RKE)',
    'TCF Issue (TCF)',
    'Rule Breach (RB)',
    'Observation (OBS)'
  ];

  const OUTCOME_META = {
    'Pass': { short: 'Pass', badgeClass: 'badge-pass' },
    'Record Keeping Error (RKE)': { short: 'RKE', badgeClass: 'badge-rke' },
    'TCF Issue (TCF)': { short: 'TCF', badgeClass: 'badge-tcf' },
    'Rule Breach (RB)': { short: 'RB', badgeClass: 'badge-rb' },
    'Observation (OBS)': { short: 'OBS', badgeClass: 'badge-obs' }
  };

  const AUDIT_ONLY_DOC_IDS = new Set(['file-timeline', 'supervisor-notes']);

  const NON_FINANCE_KEYWORDS = [
    'cash', 'self funded', 'self-funded', 'self fund', 'own funds',
    'bank transfer', 'bacs', 'debit card', 'credit card', 'card',
    'cheque', 'paid in full', 'retail cash', 'no finance', 'none', 'direct'
  ];

  const FINANCE_KEYWORDS = [
    'pcp', 'hp', 'pch', 'bch', 'lp', 'cs', 'finance', 'financed',
    'hire purchase', 'conditional sale', 'personal contract',
    'business contract', 'contract hire', 'lease', 'credit', 'balloon',
    'black horse', 'motonovo', 'santander', 'barclays', 'vwfs', 'bmw',
    'stellantis', 'close brothers', 'alphera', 'northridge', 'ald', 'lex', 'arval'
  ];

  const REGULATED_PRODUCT_COL_HINTS = [
    'tyre', 'alloy', 'minor damage', 'smart', 'mbi', 'gap', 'rti',
    'warranty', 'cosmetic', 'scratch', 'dent', 'paint', 'asset',
    'key cover', 'keycare', 'insurance', 'protect', 'service plan', 'guardx', 'supagard'
  ];

  const DOC_MATCH_RULES = {
    'supplementary-invoice': {
      filePatterns: [/supi/i, /supp[\s._-]*inv/i, /supplementary[\s._-]*inv/i, /additional[\s._-]*inv/i],
      textPatterns: [/supplementary\s+invoice/i, /additional\s+products?\s+invoice/i],
      negativeText: []
    },
    'sales-invoice': {
      filePatterns: [/sales[\s._-]*inv/i, /tax[\s._-]*inv/i, /vehicle[\s._-]*inv/i, /\binvoice\b/i, /(^|[\s._-])si([\s._-]|$)/i],
      textPatterns: [/sales\s+invoice/i, /tax\s+invoice/i, /invoice\s+to/i, /deliver\s+to/i],
      negativeText: [/supplementary\s+invoice/i]
    },
    'order-form': {
      filePatterns: [/order[\s._-]*form/i, /vehicle[\s._-]*order/i, /retail[\s._-]*order/i, /sales[\s._-]*order/i, /(^|[\s._-])of([\s._-]|$)/i],
      textPatterns: [/order\s+form/i, /vehicle\s+order/i, /order\s+confirmation/i, /retail\s+order/i],
      negativeText: []
    },
    'demands-needs-2': {
      filePatterns: [/dn[\s._-]*2/i, /d&n[\s._-]*2/i, /demands[\s._&-]*needs[\s._-]*2/i, /statement[\s._-]*of[\s._-]*demands/i],
      textPatterns: [/demands\s*(&|and)\s*needs\s*2/i, /final\s+purchasing\s+decision/i, /accepted\s+and\s+declined/i, /ineligible\s+products/i],
      negativeText: []
    },
    'customer-declaration': {
      filePatterns: [/customer[\s._-]*decl/i, /declaration/i, /questionnaire/i, /dn[\s._-]*1/i, /d&n[\s._-]*1/i, /(^|[\s._-])cd([\s._-]|$)/i],
      textPatterns: [/customer\s+declaration/i, /demands\s*(&|and)\s*needs\s+questionnaire/i, /qualification\s+questions/i, /expected\s+annual\s+mileage/i],
      negativeText: [/commission\s+disclosure/i]
    },
    'finance-provider-commission-disclosure': {
      filePatterns: [/fpcd/i, /provider[\s._-]*comm/i, /lender[\s._-]*comm/i, /finance[\s._-]*provider[\s._-]*comm/i],
      textPatterns: [/finance\s+provider\s+commission/i, /lender\s+commission\s+disclosure/i, /provider\s+commission\s+disclosure/i],
      negativeText: []
    },
    'commission-disclosure': {
      filePatterns: [/cdis/i, /ewmg[\s._-]*cdd/i, /\bcdd\b/i, /commission[\s._-]*disc/i],
      textPatterns: [/commission\s+disclosure/i, /ewmg\s+cdd/i, /method\s+of\s+calculation/i, /discretionary\s+commission/i],
      negativeText: [/finance\s+provider\s+commission/i, /lender\s+commission\s+disclosure/i]
    },
    'finance-agreement': {
      filePatterns: [/finance[\s._-]*agree/i, /credit[\s._-]*agree/i, /hire[\s._-]*purchase/i, /\bpcp\b/i, /conditional[\s._-]*sale/i, /(^|[\s._-])fa([\s._-]|$)/i],
      textPatterns: [/fixed[\s-]sum\s+loan\s+agreement/i, /hire\s+purchase\s+agreement/i, /conditional\s+sale\s+agreement/i, /regulated\s+by\s+the\s+consumer\s+credit/i, /finance\s+agreement/i, /balance\s+to\s+finance/i],
      negativeText: [/adequate\s+explanations?/i]
    },
    'proof-of-proposal': {
      filePatterns: [/proof[\s._-]*of[\s._-]*prop/i, /proposal/i, /submission/i, /(^|[\s._-])pop([\s._-]|$)/i],
      textPatterns: [/proof\s+of\s+proposal/i, /proposal\s+submitted/i, /submission\s+timestamp/i, /application\s+submitted/i],
      negativeText: []
    },
    'adequate-explanations': {
      filePatterns: [/adequate[\s._-]*exp/i, /pre[\s._-]*contract/i, /(^|[\s._-])ae([\s._-]|$)/i],
      textPatterns: [/adequate\s+explanations?/i, /pre[\s-]contract\s+credit\s+information/i, /key\s+features\s+of\s+the\s+agreement/i],
      negativeText: []
    },
    'insurance-registration': {
      filePatterns: [/insur[\s._-]*reg/i, /policy[\s._-]*(cert|sched|reg|conf)/i, /tis[\s._-]*reg/i, /warranty/i, /tyre/i, /minor[\s._-]*damage/i, /\bgap\b/i, /(^|[\s._-])ir([\s._-]|$)/i],
      textPatterns: [/insurance\s+registration/i, /policy\s+inception\s+date/i, /certificate\s+of\s+insurance/i, /policy\s+schedule/i, /inception\s+date/i],
      negativeText: []
    },
    'file-timeline': {
      filePatterns: [/timeline/i, /audit[\s._-]*trail/i, /file[\s._-]*history/i, /(^|[\s._-])ft([\s._-]|$)/i],
      textPatterns: [/file\s+timeline/i, /istoredocs\s+audit\s+trail/i, /file\s+created/i],
      negativeText: []
    },
    'supervisor-notes': {
      filePatterns: [/supervisor[\s._-]*note/i, /manager[\s._-]*note/i, /file[\s._-]*note/i, /(^|[\s._-])sn([\s._-]|$)/i],
      textPatterns: [/supervisor\s+notes?/i, /manager\s+notes?/i, /compliance\s+notes?/i],
      negativeText: []
    }
  };

  /* ================================================================== */
  /* 2. APPLICATION STATE & RUNTIME CACHE                               */
  /* ================================================================== */
  function createDefaultState() {
    return {
      schemaVersion: STATE_SCHEMA_VERSION,
      lastSavedAt: null,
      reportsMeta: {
        istoredocs: null,
        rwa: null,
        tis: null
      },
      rawData: {
        istoredocs: [],
        rwa: [],
        tis: []
      },
      deals: [],
      selectedSite: '',
      selectedExecutive: '',
      activeDealKey: null,
      audits: {}
    };
  }

  let AppState = createDefaultState();

  // In-memory runtime cache (never persisted to localStorage)
  const RuntimeCache = {
    rules: null,
    currentView: 'ingestion',
    queueSort: { field: 'recommended', dir: 'asc' },
    queueQuickFilter: 'all',
    queueSearch: '',
    queueMonth: 'all',
    queueTier: 'all',
    execSearch: '',
    exportSiteFilter: '__CURRENT__',
    // Map of dealKey -> Map of pdfFilename -> full extracted text
    pdfTextByDeal: {},
    // Map of dealKey -> expanded docCard IDs Set
    expandedDocsByDeal: {},
    // Current PDF viewer text
    activePdfViewerText: ''
  };

  /* ================================================================== */
  /* 3. UTILITY FUNCTIONS                                               */
  /* ================================================================== */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeVrm(raw) {
    if (raw === null || raw === undefined) return '';
    return String(raw).toUpperCase().replace(/\s+/g, '').trim();
  }

  function normalizeHeader(h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function normalizeScopeKey(key) {
    if (key === 'supplementary-invoice') return 'supplementaryInvoice';
    return key;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toIsoDate(year, month1, day) {
    if (!year || !month1 || !day) return '';
    if (month1 < 1 || month1 > 12 || day < 1 || day > 31) return '';
    return `${year}-${pad2(month1)}-${pad2(day)}`;
  }

  function parseFlexibleDate(val) {
    if (val === null || val === undefined || val === '') return null;

    if (val instanceof Date && !Number.isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = val.getMonth() + 1;
      const d = val.getDate();
      const hasTime = val.getHours() !== 0 || val.getMinutes() !== 0 || val.getSeconds() !== 0;
      return {
        iso: toIsoDate(y, m, d),
        monthKey: `${y}-${pad2(m)}`,
        timestamp: val.getTime(),
        hasTime,
        display: `${pad2(d)}/${pad2(m)}/${y}${hasTime ? ' ' + pad2(val.getHours()) + ':' + pad2(val.getMinutes()) : ''}`
      };
    }

    // Excel serial number
    if (typeof val === 'number' && Number.isFinite(val) && val > 20000 && val < 85000) {
      const parsed = XLSX.SSF && XLSX.SSF.parse_date_code ? XLSX.SSF.parse_date_code(val) : null;
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const hasTime = Boolean(parsed.H || parsed.M || parsed.S);
        const dt = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
        return {
          iso: toIsoDate(parsed.y, parsed.m, parsed.d),
          monthKey: `${parsed.y}-${pad2(parsed.m)}`,
          timestamp: dt.getTime(),
          hasTime,
          display: `${pad2(parsed.d)}/${pad2(parsed.m)}/${parsed.y}${hasTime ? ' ' + pad2(parsed.H) + ':' + pad2(parsed.M) : ''}`
        };
      }
      const utcMs = Math.round((val - 25569) * 86400 * 1000);
      const dt = new Date(utcMs);
      if (!Number.isNaN(dt.getTime())) {
        const y = dt.getUTCFullYear();
        const m = dt.getUTCMonth() + 1;
        const d = dt.getUTCDate();
        return {
          iso: toIsoDate(y, m, d),
          monthKey: `${y}-${pad2(m)}`,
          timestamp: new Date(y, m - 1, d).getTime(),
          hasTime: false,
          display: `${pad2(d)}/${pad2(m)}/${y}`
        };
      }
    }

    const str = String(val).trim();
    if (!str) return null;

    // Numeric string that looks like Excel serial
    if (/^\d{5}(\.\d+)?$/.test(str)) {
      return parseFlexibleDate(Number(str));
    }

    // ISO: YYYY-MM-DD (optional time)
    let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      const hh = match[4] !== undefined ? Number(match[4]) : 0;
      const mm = match[5] !== undefined ? Number(match[5]) : 0;
      const ss = match[6] !== undefined ? Number(match[6]) : 0;
      const hasTime = match[4] !== undefined;
      const dt = new Date(y, m - 1, d, hh, mm, ss);
      return {
        iso: toIsoDate(y, m, d),
        monthKey: `${y}-${pad2(m)}`,
        timestamp: dt.getTime(),
        hasTime,
        display: `${pad2(d)}/${pad2(m)}/${y}${hasTime ? ' ' + pad2(hh) + ':' + pad2(mm) : ''}`
      };
    }

    // UK format first: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (optional time)
    match = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      let p1 = Number(match[1]);
      let p2 = Number(match[2]);
      let y = Number(match[3]);
      if (y < 100) y += y >= 70 ? 1900 : 2000;
      let d = p1;
      let m = p2;
      // Fallback if month > 12 (clearly MM/DD/YYYY)
      if (m > 12 && d <= 12) {
        const tmp = d;
        d = m;
        m = tmp;
      }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const hh = match[4] !== undefined ? Number(match[4]) : 0;
        const mm = match[5] !== undefined ? Number(match[5]) : 0;
        const ss = match[6] !== undefined ? Number(match[6]) : 0;
        const hasTime = match[4] !== undefined;
        const dt = new Date(y, m - 1, d, hh, mm, ss);
        return {
          iso: toIsoDate(y, m, d),
          monthKey: `${y}-${pad2(m)}`,
          timestamp: dt.getTime(),
          hasTime,
          display: `${pad2(d)}/${pad2(m)}/${y}${hasTime ? ' ' + pad2(hh) + ':' + pad2(mm) : ''}`
        };
      }
    }

    // Native Date fallback (e.g., "14 Oct 2026")
    const parsedMs = Date.parse(str);
    if (!Number.isNaN(parsedMs)) {
      const dt = new Date(parsedMs);
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      const d = dt.getDate();
      const hasTime = /\d{1,2}:\d{2}/.test(str);
      return {
        iso: toIsoDate(y, m, d),
        monthKey: `${y}-${pad2(m)}`,
        timestamp: dt.getTime(),
        hasTime,
        display: `${pad2(d)}/${pad2(m)}/${y}${hasTime ? ' ' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) : ''}`
      };
    }

    return null;
  }

  function formatMonthLabel(monthKey) {
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || 'Unknown';
    const [y, m] = monthKey.split('-').map(Number);
    const dt = new Date(y, m - 1, 1);
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(dt);
  }

  function daysBetweenIso(startIso, endIso) {
    if (!startIso || !endIso) return null;
    const [sy, sm, sd] = startIso.split('-').map(Number);
    const [ey, em, ed] = endIso.split('-').map(Number);
    const s = Date.UTC(sy, sm - 1, sd);
    const e = Date.UTC(ey, em - 1, ed);
    return Math.round((e - s) / 86400000);
  }

  function hoursBetweenDates(startObj, endObj) {
    if (!startObj || !endObj) return null;
    return (endObj.timestamp - startObj.timestamp) / 3600000;
  }

  function getTodayIso() {
    const now = new Date();
    return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function isFinanceFundingType(fundingType) {
    const s = String(fundingType || '').toLowerCase().trim();
    if (!s) return false;
    for (const kw of NON_FINANCE_KEYWORDS) {
      if (s === kw || s.includes(kw)) {
        // Check if a strong finance keyword also appears (e.g. "Direct Finance")
        const hasExplicitFinance = FINANCE_KEYWORDS.some(fkw => s.includes(fkw));
        if (!hasExplicitFinance) return false;
      }
    }
    return FINANCE_KEYWORDS.some(kw => s.includes(kw));
  }

  function showToast(message, type = 'info', assertive = false) {
    const toastRegion = document.getElementById('toast-region');
    const item = document.createElement('div');
    item.className = `toast-item toast-${type}`;
    item.textContent = message;
    toastRegion.appendChild(item);

    const live = document.getElementById(assertive ? 'live-assertive' : 'live-polite');
    if (live) {
      live.textContent = '';
      setTimeout(() => { live.textContent = message; }, 30);
    }

    setTimeout(() => {
      item.remove();
    }, 4200);
  }

  /* ================================================================== */
  /* 4. STORAGE & PERSISTENCE                                           */
  /* ================================================================== */
  function saveStateToLocalStorage() {
    AppState.lastSavedAt = new Date().toISOString();
    try {
      const serialized = JSON.stringify(AppState);
      localStorage.setItem(STORAGE_KEY, serialized);
      updateAutoSaveIndicators('Saved locally at ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      return true;
    } catch (err) {
      console.error('LocalStorage save failed:', err);
      updateAutoSaveIndicators('Storage full: use Excel Export to save');
      showToast('Browser storage quota exceeded. Please export your audit workbook (.xlsx) to preserve your session.', 'warning', true);
      return false;
    }
  }

  function loadStateFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;
      AppState = Object.assign(createDefaultState(), parsed);
      if (!AppState.audits) AppState.audits = {};
      if (!AppState.deals) AppState.deals = [];
      if (!AppState.rawData) AppState.rawData = { istoredocs: [], rwa: [], tis: [] };
      if (!AppState.reportsMeta) AppState.reportsMeta = { istoredocs: null, rwa: null, tis: null };
      return true;
    } catch (err) {
      console.error('Failed to restore localStorage state:', err);
      return false;
    }
  }

  function updateAutoSaveIndicators(text) {
    const headerEl = document.getElementById('header-autosave');
    const wsEl = document.getElementById('ws-autosave-pill');
    if (headerEl) headerEl.textContent = text;
    if (wsEl) {
      wsEl.textContent = text;
      wsEl.className = 'badge badge-pass';
    }
  }

  /* ================================================================== */
  /* 5. RULES ENGINE (documents.json)                                   */
  /* ================================================================== */
  function validateRulesSchema(data) {
    return Boolean(
      data &&
      typeof data === 'object' &&
      data.meta &&
      Array.isArray(data.meta.scopeQuestions) &&
      Array.isArray(data.documents) &&
      Array.isArray(data.reconciliations)
    );
  }

  function applyRulesData(data, sourceLabel) {
    if (!validateRulesSchema(data)) {
      throw new Error('Invalid documents.json structure. Expected meta.scopeQuestions, documents[], and reconciliations[].');
    }
    RuntimeCache.rules = data;
    const pill = document.getElementById('header-rule-meta');
    pill.textContent = `${data.meta.toolTitle || 'Compliance Rules'} v${data.meta.version || '1.0.0'}`;
    pill.classList.remove('is-error');
    document.getElementById('rules-fallback-banner').hidden = true;
    showToast(`Loaded rules: ${data.meta.toolTitle} v${data.meta.version} (${sourceLabel})`, 'success');

    // Re-render current view if needed
    if (RuntimeCache.currentView === 'workspace' && AppState.activeDealKey) {
      renderWorkspace();
    } else if (RuntimeCache.currentView === 'export') {
      renderExportView();
    }
  }

  async function fetchRulesFile() {
    const pill = document.getElementById('header-rule-meta');
    try {
      const response = await fetch('/aah/documents.json?v=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      applyRulesData(json, 'auto-fetched');
    } catch (err) {
      console.warn('Auto-fetch of /aah/documents.json failed:', err);
      pill.textContent = 'Rules not loaded';
      pill.classList.add('is-error');
      const banner = document.getElementById('rules-fallback-banner');
      const reason = document.getElementById('rules-fallback-reason');
      reason.textContent = `Could not auto-load /aah/documents.json (${err.message || 'blocked under file://'}). Select your local documents.json file to continue.`;
      banner.hidden = false;
    }
  }

  function handleRulesFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        applyRulesData(parsed, file.name);
      } catch (err) {
        showToast('Failed to parse documents.json: ' + err.message, 'error', true);
      }
    };
    reader.readAsText(file);
  }

  function matchesWhen(whenObj, scopeState) {
    if (!whenObj || typeof whenObj !== 'object') return true;
    for (const [rawKey, expected] of Object.entries(whenObj)) {
      const key = normalizeScopeKey(rawKey);
      if (Boolean(scopeState[key]) !== Boolean(expected)) {
        return false;
      }
    }
    return true;
  }

  function isDocumentInScope(doc, scopeState) {
    if (!doc || !Array.isArray(doc.scope)) return false;
    return doc.scope.some(tag => {
      if (tag === 'core') return true;
      const key = normalizeScopeKey(tag);
      return Boolean(scopeState[key]);
    });
  }

  function getInScopeDocuments(scopeState) {
    if (!RuntimeCache.rules) return [];
    return RuntimeCache.rules.documents.filter(doc => isDocumentInScope(doc, scopeState));
  }

  function getActiveChecks(doc, scopeState) {
    if (!doc || !Array.isArray(doc.checks)) return [];
    return doc.checks.filter(chk => matchesWhen(chk.when, scopeState));
  }

  function getActiveTextItems(items, scopeState) {
    if (!Array.isArray(items)) return [];
    const result = [];
    for (const item of items) {
      if (typeof item === 'string') {
        if (item.trim()) result.push(item);
      } else if (item && typeof item === 'object' && item.text) {
        if (matchesWhen(item.when, scopeState)) {
          result.push(item.text);
        }
      }
    }
    return result;
  }

  function getActiveReconciliations(scopeState) {
    if (!RuntimeCache.rules) return [];
    const inScopeIds = new Set(getInScopeDocuments(scopeState).map(d => d.id));
    return RuntimeCache.rules.reconciliations
      .map((rec, idx) => Object.assign({ _index: idx, _id: `recon-${idx}-${rec.from}-${rec.to}` }, rec))
      .filter(rec => matchesWhen(rec.when, scopeState) && inScopeIds.has(rec.from) && inScopeIds.has(rec.to));
  }

  function getDocById(docId) {
    if (!RuntimeCache.rules) return null;
    return RuntimeCache.rules.documents.find(d => d.id === docId) || null;
  }

  /* ================================================================== */
  /* 6. SPREADSHEET PARSING & RELATIONAL JOIN ENGINE                    */
  /* ================================================================== */
  function findMatchingColumn(headers, matchGroups) {
    const normalized = headers.map(h => ({ raw: h, norm: normalizeHeader(h) }));
    for (const group of matchGroups) {
      for (const candidate of group) {
        // Exact normalized match first
        const exact = normalized.find(h => h.norm === candidate);
        if (exact) return exact.raw;
      }
      for (const candidate of group) {
        // Substring match
        const partial = normalized.find(h => h.norm.includes(candidate));
        if (partial) return partial.raw;
      }
    }
    return null;
  }

  function readSpreadsheetFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array', cellDates: false });
          const firstSheetName = wb.SheetNames[0];
          if (!firstSheetName) throw new Error('Workbook contains no sheets.');
          const sheet = wb.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
          resolve({ rows, headers, sheetName: firstSheetName, workbook: wb });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function parseIStoreDocsRows(rows, headers) {
    const cols = {
      vrm: findMatchingColumn(headers, [
        ['vrm', 'registration', 'reg no', 'reg number', 'vehicle reg', 'registration number'],
        ['reg', 'plate']
      ]),
      deliveryDate: findMatchingColumn(headers, [
        ['delivery date', 'handover date', 'delivered date', 'date delivered', 'handover'],
        ['delivery']
      ]),
      orderDate: findMatchingColumn(headers, [
        ['order confirmed date', 'order confirmation date', 'order date', 'confirmed date', 'date ordered'],
        ['order']
      ]),
      customerName: findMatchingColumn(headers, [
        ['customer name', 'customer full name', 'buyer name', 'client name'],
        ['customer', 'buyer', 'client', 'name']
      ]),
      site: findMatchingColumn(headers, [
        ['dealership site', 'dealer site', 'dealership', 'site name', 'branch name'],
        ['site', 'branch', 'location', 'retailer', 'centre', 'center', 'dealer']
      ]),
      salesExecutive: findMatchingColumn(headers, [
        ['sales executive', 'sales exec', 'salesperson', 'sales person', 'sales consultant', 'sales advisor'],
        ['executive', 'exec', 'consultant', 'advisor', 'seller', 'owner']
      ]),
      fundingType: findMatchingColumn(headers, [
        ['funding type', 'funding method', 'finance type', 'payment method', 'purchase type', 'payment type'],
        ['funding', 'finance', 'method']
      ]),
      fileCreatedDate: findMatchingColumn(headers, [
        ['file created date', 'file created', 'created date', 'date created', 'file opened date', 'opened date'],
        ['created', 'opened']
      ]),
      fileClosedDate: findMatchingColumn(headers, [
        ['file closed date', 'file closed', 'closed date', 'date closed', 'completed date', 'completion date'],
        ['closed', 'completed']
      ]),
      fileStatus: findMatchingColumn(headers, [
        ['file status', 'file state', 'deal status', 'audit status'],
        ['status', 'state', 'overdue']
      ]),
      vehicleDetails: findMatchingColumn(headers, [
        ['vehicle description', 'vehicle details', 'make and model', 'model'],
        ['vehicle', 'make']
      ]),
      dealRef: findMatchingColumn(headers, [
        ['deal number', 'deal no', 'deal id', 'order number', 'file id', 'stock number', 'stock no'],
        ['reference', 'ref']
      ])
    };

    if (!cols.vrm) {
      throw new Error('Could not locate a VRM / Registration column in the iStoreDocs report.');
    }

    const records = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const vrm = normalizeVrm(row[cols.vrm]);
      if (!vrm) continue;

      const delivery = parseFlexibleDate(cols.deliveryDate ? row[cols.deliveryDate] : '');
      const order = parseFlexibleDate(cols.orderDate ? row[cols.orderDate] : '');
      const created = parseFlexibleDate(cols.fileCreatedDate ? row[cols.fileCreatedDate] : '');
      const closed = parseFlexibleDate(cols.fileClosedDate ? row[cols.fileClosedDate] : '');

      records.push({
        rowIndex: i,
        vrm,
        vrmRaw: String(row[cols.vrm] || '').trim(),
        customerName: String(cols.customerName ? row[cols.customerName] : '').trim() || 'Unknown Customer',
        site: String(cols.site ? row[cols.site] : '').trim() || 'Unassigned Site',
        salesExecutive: String(cols.salesExecutive ? row[cols.salesExecutive] : '').trim() || 'Unassigned Executive',
        fundingType: String(cols.fundingType ? row[cols.fundingType] : '').trim() || 'Unknown',
        deliveryDate: delivery,
        orderDate: order,
        fileCreatedDate: created,
        fileClosedDate: closed,
        fileStatus: String(cols.fileStatus ? row[cols.fileStatus] : '').trim(),
        vehicleDetails: String(cols.vehicleDetails ? row[cols.vehicleDetails] : '').trim(),
        dealRef: String(cols.dealRef ? row[cols.dealRef] : '').trim()
      });
    }

    return { records, cols };
  }

  function parseRwaRows(rows, headers) {
    const cols = {
      vrm: findMatchingColumn(headers, [
        ['vrm', 'registration', 'reg no', 'reg number', 'vehicle reg', 'registration number'],
        ['reg', 'plate']
      ]),
      product: findMatchingColumn(headers, [
        ['product name', 'regulated product', 'service name', 'insurance product', 'policy type', 'addon', 'add on', 'add-on', 'cover type', 'plan name'],
        ['product', 'service', 'insurance', 'policy', 'cover', 'description', 'item', 'plan']
      ]),
      price: findMatchingColumn(headers, [
        ['retail price', 'premium', 'sale price', 'gross price', 'product price'],
        ['price', 'value', 'amount', 'cost', 'fee']
      ]),
      status: findMatchingColumn(headers, [
        ['policy status', 'product status', 'sale status'],
        ['status', 'state']
      ]),
      funding: findMatchingColumn(headers, [
        ['funding method', 'funding type', 'payment method'],
        ['funding', 'payment']
      ]),
      saleDate: findMatchingColumn(headers, [
        ['sale date', 'sold date', 'date sold', 'delivery date'],
        ['date']
      ])
    };

    if (!cols.vrm) {
      throw new Error('Could not locate a VRM / Registration column in the RWA report.');
    }

    // Detect wide-format product columns as fallback if no single product column exists
    const wideProductCols = [];
    if (!cols.product) {
      for (const h of headers) {
        if (h === cols.vrm) continue;
        const nh = normalizeHeader(h);
        if (REGULATED_PRODUCT_COL_HINTS.some(hint => nh.includes(hint))) {
          wideProductCols.push(h);
        }
      }
    }

    const records = [];
    for (const row of rows) {
      const vrm = normalizeVrm(row[cols.vrm]);
      if (!vrm) continue;

      const statusRaw = String(cols.status ? row[cols.status] : '').trim();
      const isCancelled = /cancel|void|declin|refund|revers/i.test(statusRaw);

      if (cols.product) {
        const prodRaw = String(row[cols.product] || '').trim();
        if (!prodRaw || /^(none|n\/a|nil|0|-)$/i.test(prodRaw)) continue;
        // Support comma or semicolon separated product lists in a single cell
        const parts = prodRaw.split(/[;,|]+/).map(s => s.trim()).filter(Boolean);
        for (const part of parts) {
          records.push({
            vrm,
            productName: part,
            price: cols.price ? String(row[cols.price] ?? '').trim() : '',
            funding: cols.funding ? String(row[cols.funding] ?? '').trim() : '',
            status: statusRaw || 'Sold',
            isCancelled,
            saleDate: parseFlexibleDate(cols.saleDate ? row[cols.saleDate] : '')
          });
        }
      } else if (wideProductCols.length > 0) {
        for (const pCol of wideProductCols) {
          const cell = row[pCol];
          const strCell = String(cell ?? '').trim().toLowerCase();
          const numVal = Number(String(cell ?? '').replace(/[£$,]/g, ''));
          const isPresent = (
            strCell === 'yes' || strCell === 'y' || strCell === 'true' || strCell === 'sold' ||
            (Number.isFinite(numVal) && numVal > 0)
          );
          if (isPresent) {
            records.push({
              vrm,
              productName: pCol.trim(),
              price: Number.isFinite(numVal) && numVal > 0 ? String(cell).trim() : '',
              funding: '',
              status: statusRaw || 'Sold',
              isCancelled,
              saleDate: parseFlexibleDate(cols.saleDate ? row[cols.saleDate] : '')
            });
          }
        }
      }
    }

    return { records, cols, wideProductCols };
  }

  function parseTisRows(rows, headers) {
    const cols = {
      vrm: findMatchingColumn(headers, [
        ['vrm', 'registration', 'reg no', 'reg number', 'vehicle reg', 'registration number'],
        ['reg', 'plate']
      ]),
      product: findMatchingColumn(headers, [
        ['product name', 'policy type', 'cover type', 'scheme', 'insurance type', 'plan'],
        ['product', 'cover', 'policy', 'description']
      ]),
      policyNumber: findMatchingColumn(headers, [
        ['policy number', 'policy no', 'policy ref', 'certificate number', 'cert no'],
        ['reference', 'ref', 'certificate']
      ]),
      status: findMatchingColumn(headers, [
        ['registration status', 'policy status', 'tis status'],
        ['status', 'state', 'registered']
      ]),
      inceptionDate: findMatchingColumn(headers, [
        ['inception date', 'policy inception', 'cover start date', 'start date', 'effective date', 'policy start'],
        ['inception', 'start']
      ]),
      registrationDate: findMatchingColumn(headers, [
        ['registration date', 'date registered', 'registered date', 'reg date', 'issue date', 'created date'],
        ['registered', 'created']
      ])
    };

    if (!cols.vrm) {
      throw new Error('Could not locate a VRM / Registration column in the TIS report.');
    }

    const records = [];
    for (const row of rows) {
      const vrm = normalizeVrm(row[cols.vrm]);
      if (!vrm) continue;

      records.push({
        vrm,
        productName: String(cols.product ? row[cols.product] : '').trim() || 'Insurance Policy',
        policyNumber: String(cols.policyNumber ? row[cols.policyNumber] : '').trim(),
        registrationStatus: String(cols.status ? row[cols.status] : '').trim() || 'Recorded',
        inceptionDate: parseFlexibleDate(cols.inceptionDate ? row[cols.inceptionDate] : ''),
        registrationDate: parseFlexibleDate(cols.registrationDate ? row[cols.registrationDate] : '')
      });
    }

    return { records, cols };
  }

  function rebuildJoinedDeals() {
    const rwaByVrm = new Map();
    for (const item of AppState.rawData.rwa) {
      if (!rwaByVrm.has(item.vrm)) rwaByVrm.set(item.vrm, []);
      rwaByVrm.get(item.vrm).push(item);
    }

    const tisByVrm = new Map();
    for (const item of AppState.rawData.tis) {
      if (!tisByVrm.has(item.vrm)) tisByVrm.set(item.vrm, []);
      tisByVrm.get(item.vrm).push(item);
    }

    // Count VRM frequency in iStoreDocs to assign stable dealKeys
    const vrmCounts = new Map();
    for (const rec of AppState.rawData.istoredocs) {
      vrmCounts.set(rec.vrm, (vrmCounts.get(rec.vrm) || 0) + 1);
    }

    const seenKeys = new Map();
    const deals = AppState.rawData.istoredocs.map((rec) => {
      let baseKey = vrmCounts.get(rec.vrm) > 1
        ? `${rec.vrm}__${rec.deliveryDate ? rec.deliveryDate.iso : rec.rowIndex}`
        : rec.vrm;
      const dupCount = seenKeys.get(baseKey) || 0;
      seenKeys.set(baseKey, dupCount + 1);
      const dealKey = dupCount > 0 ? `${baseKey}__${dupCount}` : baseKey;

      const allRwa = rwaByVrm.get(rec.vrm) || [];
      const activeRwa = allRwa.filter(r => !r.isCancelled);
      const tisPolicies = tisByVrm.get(rec.vrm) || [];
      const isFinance = isFinanceFundingType(rec.fundingType);

      // Risk Tier Calculation:
      // Tier 1: Finance + 2 or more insurances sold (RWA)
      // Tier 2: Finance + 1 insurance sold
      // Tier 3: Finance + 0 insurances sold
      // Tier 4: Non-finance / Cash
      let riskTier = 4;
      if (isFinance) {
        if (activeRwa.length >= 2) riskTier = 1;
        else if (activeRwa.length === 1) riskTier = 2;
        else riskTier = 3;
      }

      return {
        dealKey,
        vrm: rec.vrm,
        vrmRaw: rec.vrmRaw || rec.vrm,
        customerName: rec.customerName,
        site: rec.site,
        salesExecutive: rec.salesExecutive,
        fundingType: rec.fundingType,
        isFinance,
        deliveryDate: rec.deliveryDate,
        orderDate: rec.orderDate,
        fileCreatedDate: rec.fileCreatedDate,
        fileClosedDate: rec.fileClosedDate,
        fileStatus: rec.fileStatus,
        vehicleDetails: rec.vehicleDetails,
        dealRef: rec.dealRef,
        rwaProducts: activeRwa,
        rwaCancelled: allRwa.filter(r => r.isCancelled),
        tisPolicies,
        riskTier
      };
    });

    AppState.deals = deals;

    // Reconcile selectedSite and selectedExecutive
    const sites = getUniqueSites();
    if (sites.length > 0 && !sites.includes(AppState.selectedSite)) {
      AppState.selectedSite = sites[0];
    } else if (sites.length === 0) {
      AppState.selectedSite = '';
      AppState.selectedExecutive = '';
    }

    if (AppState.selectedSite) {
      const execs = getExecutivesForSite(AppState.selectedSite);
      if (execs.length > 0 && !execs.includes(AppState.selectedExecutive)) {
        AppState.selectedExecutive = execs[0];
      }
    }

    // Refresh non-manual scopes for existing audits if new RWA/TIS data arrived
    for (const deal of AppState.deals) {
      const audit = AppState.audits[deal.dealKey];
      if (audit && !audit.scopeManual) {
        audit.scope = getDefaultScopeForDeal(deal);
      }
    }
  }

  function getUniqueSites() {
    return Array.from(new Set(AppState.deals.map(d => d.site))).sort((a, b) => a.localeCompare(b));
  }

  function getExecutivesForSite(site) {
    return Array.from(new Set(AppState.deals.filter(d => d.site === site).map(d => d.salesExecutive))).sort((a, b) => a.localeCompare(b));
  }

  /* ================================================================== */
  /* 7. AUTOMATED RISK PRIORITIZATION (6-DEAL SAMPLE PER EXECUTIVE)     */
  /* ================================================================== */
  function computeExecutiveRiskSample(site, executive) {
    const execDeals = AppState.deals.filter(d => d.site === site && d.salesExecutive === executive);

    // Identify the two most recent calendar months present in this executive's delivery dates
    const monthSet = new Set();
    for (const d of execDeals) {
      if (d.deliveryDate && d.deliveryDate.monthKey) {
        monthSet.add(d.deliveryDate.monthKey);
      }
    }
    const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
    const monthA = sortedMonths[0] || null;
    const monthB = sortedMonths[1] || null;

    const compareByRisk = (a, b) => {
      if (a.riskTier !== b.riskTier) return a.riskTier - b.riskTier;
      if (b.rwaProducts.length !== a.rwaProducts.length) return b.rwaProducts.length - a.rwaProducts.length;
      const aTs = a.deliveryDate ? a.deliveryDate.timestamp : 0;
      const bTs = b.deliveryDate ? b.deliveryDate.timestamp : 0;
      if (bTs !== aTs) return bTs - aTs;
      return a.vrm.localeCompare(b.vrm);
    };

    const recommendedMap = new Map();
    let countMonthA = 0;
    let countMonthB = 0;

    if (monthA) {
      const dealsA = execDeals.filter(d => d.deliveryDate && d.deliveryDate.monthKey === monthA).sort(compareByRisk);
      dealsA.slice(0, 3).forEach((d, idx) => {
        recommendedMap.set(d.dealKey, { slot: 'Month A', monthKey: monthA, rank: idx + 1 });
        countMonthA++;
      });
    }

    if (monthB) {
      const dealsB = execDeals.filter(d => d.deliveryDate && d.deliveryDate.monthKey === monthB).sort(compareByRisk);
      dealsB.slice(0, 3).forEach((d, idx) => {
        recommendedMap.set(d.dealKey, { slot: 'Month B', monthKey: monthB, rank: idx + 1 });
        countMonthB++;
      });
    }

    const auditedCount = execDeals.filter(d => {
      const audit = AppState.audits[d.dealKey];
      return audit && Boolean(audit.outcome);
    }).length;

    const targetCount = Math.min(6, Math.max(recommendedMap.size, Math.min(6, execDeals.length)));

    return {
      deals: execDeals,
      allMonths: sortedMonths,
      monthA,
      monthB,
      countMonthA,
      countMonthB,
      recommendedMap,
      auditedCount,
      targetCount
    };
  }

  /* ================================================================== */
  /* 8. AUDIT RECORD MANAGEMENT & AUTOMATED PRE-CHECKS                  */
  /* ================================================================== */
  function getDefaultScopeForDeal(deal) {
    return {
      finance: Boolean(deal.isFinance),
      insurance: Boolean(deal.rwaProducts.length > 0 || deal.tisPolicies.length > 0),
      supplementaryInvoice: false
    };
  }

  function ensureAuditRecord(deal) {
    if (!AppState.audits[deal.dealKey]) {
      AppState.audits[deal.dealKey] = {
        dealKey: deal.dealKey,
        vrm: deal.vrm,
        scope: getDefaultScopeForDeal(deal),
        scopeManual: false,
        checks: {},
        reconciliations: {},
        zipScan: null,
        outcome: '',
        notes: '',
        updatedAt: null
      };
    }
    return AppState.audits[deal.dealKey];
  }

  function computeAutomatedPreChecks(deal, audit) {
    const checkHints = {};
    const reconHints = {};
    const alerts = [];
    const todayIso = getTodayIso();

    // 1. File Timeline: 24-hour creation check
    if (deal.orderDate && deal.fileCreatedDate) {
      const hrs = hoursBetweenDates(deal.orderDate, deal.fileCreatedDate);
      const days = daysBetweenIso(deal.orderDate.iso, deal.fileCreatedDate.iso);
      const within24h = (deal.orderDate.hasTime && deal.fileCreatedDate.hasTime)
        ? (hrs !== null && hrs <= 24 && hrs >= -1)
        : (days !== null && days <= 1 && days >= 0);

      if (within24h) {
        const detail = (deal.orderDate.hasTime && deal.fileCreatedDate.hasTime)
          ? `Created ${hrs.toFixed(1)}h after order confirmed (${deal.orderDate.display} -> ${deal.fileCreatedDate.display}).`
          : `Created within 1 day of order date (${deal.orderDate.display} -> ${deal.fileCreatedDate.display}).`;
        checkHints['ft-created'] = { status: 'pass', message: detail };
        reconHints['file-timeline::order-form'] = { status: 'pass', message: detail };
      } else {
        const detail = (deal.orderDate.hasTime && deal.fileCreatedDate.hasTime)
          ? `File created ${hrs.toFixed(1)}h after order date (${deal.orderDate.display} -> ${deal.fileCreatedDate.display}). Exceeds 24-hour rule.`
          : `File created ${days} day(s) after order date (${deal.orderDate.display} -> ${deal.fileCreatedDate.display}). Exceeds 24-hour rule.`;
        checkHints['ft-created'] = { status: 'flag', message: detail };
        reconHints['file-timeline::order-form'] = { status: 'flag', message: detail };
        alerts.push({ level: 'warning', text: 'File Creation (>24h): ' + detail });
      }
    } else if (deal.fileCreatedDate) {
      checkHints['ft-created'] = {
        status: 'info',
        message: `iStoreDocs File Created: ${deal.fileCreatedDate.display}. Verify against Order Form confirmed date.`
      };
    }

    // 2. File Timeline: 7-day closure, overdue, and 21-day open checks
    const statusLower = (deal.fileStatus || '').toLowerCase();
    const statusSaysOpen = /open|pending|overdue|in progress|active|awaiting/i.test(statusLower);
    const statusSaysOverdue = /overdue/i.test(statusLower);

    if (deal.deliveryDate) {
      if (deal.fileClosedDate) {
        const daysToClose = daysBetweenIso(deal.deliveryDate.iso, deal.fileClosedDate.iso);
        if (daysToClose !== null) {
          if (daysToClose <= 7 && daysToClose >= 0) {
            checkHints['ft-closed'] = {
              status: 'pass',
              message: `Closed ${daysToClose} day(s) after handover (${deal.deliveryDate.display} -> ${deal.fileClosedDate.display}).`
            };
          } else if (daysToClose > 7) {
            const msg = `Closed ${daysToClose} days after handover (${deal.deliveryDate.display} -> ${deal.fileClosedDate.display}). Exceeds 7-day target.`;
            checkHints['ft-closed'] = { status: 'flag', message: msg };
            alerts.push({ level: 'warning', text: 'Late File Closure (>7 days): ' + msg });
          } else {
            checkHints['ft-closed'] = {
              status: 'warn',
              message: `Closed date (${deal.fileClosedDate.display}) is before delivery date (${deal.deliveryDate.display}). Verify dates.`
            };
          }

          if (statusSaysOverdue || daysToClose > 7) {
            checkHints['ft-overdue'] = {
              status: 'flag',
              message: `File went overdue (closed ${daysToClose} days post-handover; status: ${deal.fileStatus || 'N/A'}). Potential Record Keeping Error (RKE).`
            };
          } else {
            checkHints['ft-overdue'] = {
              status: 'pass',
              message: `Not overdue (closed within ${daysToClose} day(s); status: ${deal.fileStatus || 'Closed'}).`
            };
          }

          if (daysToClose > 21) {
            const msg21 = `File remained open ${daysToClose} days after handover (>21 days). Potential TCF Issue (TCF).`;
            checkHints['ft-open-21'] = { status: 'flag', message: msg21 };
            alerts.push({ level: 'danger', text: '21-Day Open File Breach (TCF): ' + msg21 });
          } else {
            checkHints['ft-open-21'] = {
              status: 'pass',
              message: `Closed within ${daysToClose} day(s) (under 21-day TCF threshold).`
            };
          }
        }
      } else {
        // File has no closed date recorded
        const daysSinceDelivery = daysBetweenIso(deal.deliveryDate.iso, todayIso);
        if (daysSinceDelivery !== null) {
          if (daysSinceDelivery > 21) {
            const msg = `No closure date recorded; file is ${daysSinceDelivery} days past delivery (${deal.deliveryDate.display}). Still open >21 days is a TCF Issue.`;
            checkHints['ft-closed'] = { status: 'flag', message: msg };
            checkHints['ft-overdue'] = { status: 'flag', message: `Overdue (${daysSinceDelivery} days open; status: ${deal.fileStatus || 'Open'}).` };
            checkHints['ft-open-21'] = { status: 'flag', message: msg };
            alerts.push({ level: 'danger', text: 'File Still Open >21 Days (TCF): ' + msg });
          } else if (daysSinceDelivery > 7 || statusSaysOverdue) {
            const msg = `No closure date recorded; ${daysSinceDelivery} days since delivery (${deal.deliveryDate.display}). Exceeds 7-day closure window (RKE).`;
            checkHints['ft-closed'] = { status: 'flag', message: msg };
            checkHints['ft-overdue'] = { status: 'flag', message: msg };
            checkHints['ft-open-21'] = { status: 'pass', message: `${daysSinceDelivery} days since handover (currently under 21-day threshold).` };
            alerts.push({ level: 'warning', text: 'Overdue Open File (>7 days, RKE): ' + msg });
          } else if (statusSaysOpen) {
            checkHints['ft-closed'] = { status: 'info', message: `File currently open (${daysSinceDelivery} day(s) since delivery ${deal.deliveryDate.display}).` };
            checkHints['ft-overdue'] = { status: 'pass', message: `Within 7-day window (${daysSinceDelivery} day(s) since delivery).` };
            checkHints['ft-open-21'] = { status: 'pass', message: `Within 21-day threshold (${daysSinceDelivery} day(s) since delivery).` };
          }
        }
      }
    }

    // 3. DN2 Signature Date vs iStoreDocs Delivery Date
    if (deal.deliveryDate) {
      const dn2Files = (audit.zipScan && audit.zipScan.files || []).filter(f => f.matchedDocId === 'demands-needs-2');
      if (dn2Files.length > 0) {
        const dealTexts = RuntimeCache.pdfTextByDeal[deal.dealKey] || {};
        const combinedDn2Text = dn2Files.map(f => dealTexts[f.fileName] || '').join(' ');
        const hasImageOnly = dn2Files.every(f => f.isImagePdf);
        if (hasImageOnly) {
          checkHints['dn2-date'] = {
            status: 'warn',
            message: `DN2 PDF is scanned image-only. Manually verify signature date matches iStoreDocs delivery date (${deal.deliveryDate.display}).`
          };
        } else if (combinedDn2Text) {
          const foundMatch = textContainsDate(combinedDn2Text, deal.deliveryDate.iso);
          if (foundMatch) {
            checkHints['dn2-date'] = {
              status: 'pass',
              message: `iStoreDocs delivery date (${deal.deliveryDate.display}) detected in DN2 PDF text. Confirm it is the customer signature date.`
            };
          } else {
            checkHints['dn2-date'] = {
              status: 'warn',
              message: `iStoreDocs delivery date (${deal.deliveryDate.display}) not found verbatim in DN2 text. Verify DN2 signature date manually.`
            };
          }
        } else {
          checkHints['dn2-date'] = {
            status: 'info',
            message: `Compare DN2 signature date against iStoreDocs delivery date: ${deal.deliveryDate.display}.`
          };
        }
      } else {
        checkHints['dn2-date'] = {
          status: 'info',
          message: `iStoreDocs delivery date is ${deal.deliveryDate.display}. Upload ZIP or check DN2 signature date against this date.`
        };
      }
    }

    // 4. RWA Sold Products vs TIS Registered Policies & TIS Inception vs Delivery Date
    const rwaCount = deal.rwaProducts.length;
    const tisCount = deal.tisPolicies.length;

    if (audit.scope.insurance || rwaCount > 0 || tisCount > 0) {
      if (rwaCount > 0 && tisCount === 0) {
        const msg = `RWA shows ${rwaCount} regulated product(s) sold (${deal.rwaProducts.map(p => p.productName).join(', ')}), but 0 policies found in TIS.`;
        checkHints['ir-registration'] = { status: 'flag', message: msg };
        alerts.push({ level: 'danger', text: 'RWA vs TIS Mismatch: ' + msg });
      } else if (rwaCount > tisCount) {
        const msg = `RWA lists ${rwaCount} product(s), while TIS lists ${tisCount} policy record(s). Verify all sold products are registered.`;
        checkHints['ir-registration'] = { status: 'flag', message: msg };
        alerts.push({ level: 'warning', text: 'RWA vs TIS Count Discrepancy: ' + msg });
      } else if (tisCount > 0) {
        const unregistered = deal.tisPolicies.filter(p => /unreg|pending|fail|cancel|not\s+reg|error|reject/i.test(p.registrationStatus));
        if (unregistered.length > 0) {
          const msg = `${unregistered.length} TIS policy record(s) show non-active status: ${unregistered.map(p => `${p.productName} (${p.registrationStatus})`).join(', ')}.`;
          checkHints['ir-registration'] = { status: 'flag', message: msg };
          alerts.push({ level: 'danger', text: 'TIS Registration Status Issue: ' + msg });
        } else {
          checkHints['ir-registration'] = {
            status: 'pass',
            message: `${tisCount} TIS policy record(s) matched against ${rwaCount} RWA product(s).`
          };
        }
      }

      // Check TIS inception date vs iStoreDocs delivery date
      if (deal.deliveryDate && tisCount > 0) {
        const mismatches = [];
        const matched = [];
        const missingInception = [];
        for (const pol of deal.tisPolicies) {
          if (!pol.inceptionDate) {
            missingInception.push(pol.productName);
          } else if (pol.inceptionDate.iso !== deal.deliveryDate.iso) {
            mismatches.push(`${pol.productName} (Inception: ${pol.inceptionDate.display} vs Delivery: ${deal.deliveryDate.display})`);
          } else {
            matched.push(pol.productName);
          }
        }

        if (mismatches.length > 0) {
          const msg = `Inception date differs from delivery date: ${mismatches.join('; ')}. If sold after handover, verify clear supervisor notes.`;
          checkHints['ir-inception'] = { status: 'flag', message: msg };
          reconHints['insurance-registration::demands-needs-2'] = { status: 'flag', message: msg };
          alerts.push({ level: 'warning', text: 'TIS Inception vs Handover Date: ' + msg });
        } else if (missingInception.length > 0) {
          checkHints['ir-inception'] = {
            status: 'warn',
            message: `Inception date missing in TIS for: ${missingInception.join(', ')}. Verify against delivery date (${deal.deliveryDate.display}).`
          };
        } else if (matched.length > 0) {
          const msg = `All ${matched.length} TIS policy inception date(s) match iStoreDocs delivery date (${deal.deliveryDate.display}).`;
          checkHints['ir-inception'] = { status: 'pass', message: msg };
          reconHints['insurance-registration::demands-needs-2'] = { status: 'pass', message: msg };
        }
      }
    }

    // 5. ZIP Missing Required Docs alert
    if (audit.zipScan && RuntimeCache.rules) {
      const inScopeDocs = getInScopeDocuments(audit.scope);
      const matchedIds = new Set((audit.zipScan.files || []).map(f => f.matchedDocId).filter(Boolean));
      const missingRequired = inScopeDocs.filter(d => !AUDIT_ONLY_DOC_IDS.has(d.id) && !matchedIds.has(d.id));
      if (missingRequired.length > 0) {
        alerts.push({
          level: 'warning',
          text: `Missing from ZIP (${missingRequired.length}): ${missingRequired.map(d => `${d.name} (${d.shortName})`).join(', ')}.`
        });
      }
      const imagePdfs = (audit.zipScan.files || []).filter(f => f.isImagePdf);
      if (imagePdfs.length > 0) {
        alerts.push({
          level: 'info',
          text: `Manual Review Required - Image PDF (${imagePdfs.length}): ${imagePdfs.map(f => f.fileName).join(', ')}.`
        });
      }
    }

    return { checkHints, reconHints, alerts };
  }

  function textContainsDate(text, isoDate) {
    if (!text || !isoDate) return false;
    const [y, m, d] = isoDate.split('-');
    const dNum = String(Number(d));
    const mNum = String(Number(m));
    const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(Number(y), Number(m) - 1, 1));
    const monthLong = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(Number(y), Number(m) - 1, 1));
    const variants = [
      `${d}/${m}/${y}`,
      `${d}-${m}-${y}`,
      `${d}.${m}.${y}`,
      `${dNum}/${mNum}/${y}`,
      `${d}/${m}/${y.slice(2)}`,
      `${y}-${m}-${d}`,
      `${d} ${monthShort} ${y}`,
      `${dNum} ${monthShort} ${y}`,
      `${d} ${monthLong} ${y}`,
      `${dNum} ${monthLong} ${y}`
    ];
    const lower = text.toLowerCase();
    return variants.some(v => lower.includes(v.toLowerCase()));
  }

  function applyAutoPreCheckDefaults(deal, audit, forceOverwriteAuto = false) {
    const { checkHints, reconHints } = computeAutomatedPreChecks(deal, audit);
    for (const [checkId, hint] of Object.entries(checkHints)) {
      if (hint.status !== 'pass' && hint.status !== 'flag') continue;
      const existing = audit.checks[checkId];
      if (!existing || (forceOverwriteAuto && existing.source === 'auto')) {
        audit.checks[checkId] = { state: hint.status, source: 'auto' };
      }
    }
    if (RuntimeCache.rules) {
      const activeRecons = getActiveReconciliations(audit.scope);
      for (const rec of activeRecons) {
        const hintKey = `${rec.from}::${rec.to}`;
        const hint = reconHints[hintKey];
        if (!hint || (hint.status !== 'pass' && hint.status !== 'flag')) continue;
        const existing = audit.reconciliations[rec._id];
        if (!existing || (forceOverwriteAuto && existing.source === 'auto')) {
          audit.reconciliations[rec._id] = { state: hint.status, source: 'auto' };
        }
      }
    }
  }

  /* ================================================================== */
  /* 9. TRANSACTION ZIP UNPACKING & PDF.JS EXTRACTION                   */
  /* ================================================================== */
  function matchPdfToDocument(fileName, extractedText) {
    if (!RuntimeCache.rules) return null;
    const cleanFile = fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
    const textSample = (extractedText || '').slice(0, 6000);

    let bestId = null;
    let bestScore = 0;

    for (const doc of RuntimeCache.rules.documents) {
      let score = 0;
      const rule = DOC_MATCH_RULES[doc.id];

      if (rule) {
        if (rule.negativeText && rule.negativeText.some(rx => rx.test(textSample) || rx.test(cleanFile))) {
          score -= 10;
        }
        for (const rx of rule.filePatterns) {
          if (rx.test(fileName) || rx.test(cleanFile)) score += 6;
        }
        for (const rx of rule.textPatterns) {
          if (rx.test(textSample)) score += 5;
        }
      }

      // Generic schema-driven matching against name, shortName, and id
      const nameLower = doc.name.toLowerCase();
      const shortLower = (doc.shortName || '').toLowerCase();
      const idSpaced = doc.id.replace(/-/g, ' ');

      if (cleanFile.toLowerCase().includes(nameLower) || cleanFile.toLowerCase().includes(idSpaced)) {
        score += 8;
      }
      if (textSample.toLowerCase().includes(nameLower)) {
        score += 6;
      }
      if (shortLower && new RegExp(`(^|[^a-z0-9])${shortLower}([^a-z0-9]|$)`, 'i').test(cleanFile)) {
        score += 4;
      }

      if (score > bestScore) {
        bestScore = score;
        bestId = doc.id;
      }
    }

    return bestScore >= 4 ? bestId : null;
  }

  async function extractPdfTextFromArrayBuffer(arrayBuffer) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library failed to load from CDN.');
    }
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    let pdfDoc;
    try {
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    } catch (workerErr) {
      // Graceful fallback if worker CORS is blocked under file://
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0), disableWorker: true }).promise;
    }

    const pageTexts = [];
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageStr = content.items.map(item => item.str || '').join(' ');
      pageTexts.push(`--- Page ${pageNum} ---\n${pageStr}`);
    }
    const fullText = pageTexts.join('\n\n');
    const meaningfulChars = fullText.replace(/---\s*Page\s+\d+\s*---/g, '').replace(/\s+/g, '').length;
    return {
      pageCount: pdfDoc.numPages,
      text: fullText,
      charCount: meaningfulChars,
      isImagePdf: meaningfulChars < 20
    };
  }

  async function processDealArchiveUpload(file) {
    const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
    if (!deal || !file) return;

    const audit = ensureAuditRecord(deal);
    const progressWrap = document.getElementById('ws-zip-progress-wrap');
    const progressBar = document.getElementById('ws-zip-progress');
    const progressLabel = document.getElementById('ws-zip-progress-label');

    progressWrap.hidden = false;
    progressBar.value = 5;
    progressLabel.textContent = `Reading ${file.name}...`;

    try {
      const pdfEntries = [];
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.zip')) {
        if (typeof JSZip === 'undefined') {
          throw new Error('JSZip library failed to load from CDN.');
        }
        const zip = await JSZip.loadAsync(file);
        zip.forEach((relativePath, entry) => {
          if (entry.dir) return;
          if (relativePath.startsWith('__MACOSX/') || relativePath.split('/').pop().startsWith('.')) return;
          if (relativePath.toLowerCase().endsWith('.pdf')) {
            pdfEntries.push({
              fileName: relativePath.split('/').pop(),
              fullPath: relativePath,
              getArrayBuffer: () => entry.async('arraybuffer')
            });
          }
        });
      } else if (lowerName.endsWith('.pdf')) {
        pdfEntries.push({
          fileName: file.name,
          fullPath: file.name,
          getArrayBuffer: () => file.arrayBuffer()
        });
      } else {
        throw new Error('Please upload a .zip transaction pack (or a .pdf file).');
      }

      if (pdfEntries.length === 0) {
        throw new Error('No PDF files were found inside the uploaded archive.');
      }

      const scannedFiles = [];
      if (!RuntimeCache.pdfTextByDeal[deal.dealKey]) {
        RuntimeCache.pdfTextByDeal[deal.dealKey] = {};
      }

      for (let i = 0; i < pdfEntries.length; i++) {
        const entry = pdfEntries[i];
        const pct = Math.round(((i + 0.5) / pdfEntries.length) * 90) + 5;
        progressBar.value = pct;
        progressLabel.textContent = `Extracting PDF ${i + 1} of ${pdfEntries.length}: ${entry.fileName}`;

        try {
          const buffer = await entry.getArrayBuffer();
          const extracted = await extractPdfTextFromArrayBuffer(buffer);
          const matchedDocId = matchPdfToDocument(entry.fileName, extracted.text);

          RuntimeCache.pdfTextByDeal[deal.dealKey][entry.fileName] = extracted.text;
          scannedFiles.push({
            fileName: entry.fileName,
            pageCount: extracted.pageCount,
            charCount: extracted.charCount,
            isImagePdf: extracted.isImagePdf,
            matchedDocId,
            extractError: null
          });
        } catch (pdfErr) {
          scannedFiles.push({
            fileName: entry.fileName,
            pageCount: 0,
            charCount: 0,
            isImagePdf: true,
            matchedDocId: matchPdfToDocument(entry.fileName, ''),
            extractError: pdfErr.message || 'Could not extract text'
          });
        }
      }

      progressBar.value = 100;
      progressLabel.textContent = `Completed: ${scannedFiles.length} PDF(s) processed.`;

      // Store lightweight JSON metadata only (never raw PDF/ZIP binaries or full text)
      audit.zipScan = {
        archiveName: file.name,
        scannedAt: new Date().toISOString(),
        files: scannedFiles
      };

      // Auto-notice if Supplementary Invoice was detected in the ZIP while scope is off
      const foundSupi = scannedFiles.some(f => f.matchedDocId === 'supplementary-invoice');
      if (foundSupi && !audit.scope.supplementaryInvoice && !audit.scopeManual) {
        audit.scope.supplementaryInvoice = true;
        showToast('Supplementary Invoice detected in ZIP: Supplementary Invoice scope enabled automatically.', 'info');
      }

      audit.updatedAt = new Date().toISOString();
      applyAutoPreCheckDefaults(deal, audit, false);
      saveStateToLocalStorage();
      renderWorkspace();
      showToast(`Processed ${scannedFiles.length} PDF(s) from ${file.name}.`, 'success');
    } catch (err) {
      console.error('ZIP processing error:', err);
      showToast('ZIP scan error: ' + err.message, 'error', true);
    } finally {
      setTimeout(() => { progressWrap.hidden = true; }, 600);
    }
  }

  /* ================================================================== */
  /* 10. VIEW RENDERING: VIEW 1 (DATA INGESTION)                        */
  /* ================================================================== */
  function renderIngestionView() {
    const reportTypes = ['istoredocs', 'rwa', 'tis'];
    for (const type of reportTypes) {
      const meta = AppState.reportsMeta[type];
      const dz = document.getElementById(`dz-${type}`);
      const statusEl = document.getElementById(`status-${type}`);
      const metaEl = document.getElementById(`meta-${type}`);

      if (meta) {
        dz.classList.add('is-loaded');
        statusEl.textContent = `${meta.rowCount} rows`;
        statusEl.className = 'badge badge-pass';
        metaEl.innerHTML = `<strong>${escapeHtml(meta.fileName)}</strong><br><span class="muted">Loaded ${escapeHtml(new Date(meta.loadedAt).toLocaleString('en-GB'))} | Columns matched: ${escapeHtml(meta.matchedCols.join(', '))}</span>`;
      } else {
        dz.classList.remove('is-loaded');
        statusEl.textContent = 'Not Loaded';
        statusEl.className = 'badge badge-neutral';
        metaEl.textContent = 'Drop .xlsx or .csv file here, or click Browse.';
      }
    }

    const sites = getUniqueSites();
    const uniqueExecs = new Set(AppState.deals.map(d => `${d.site}::${d.salesExecutive}`));
    const rwaMatched = AppState.deals.filter(d => d.rwaProducts.length > 0).length;
    const tisMatched = AppState.deals.filter(d => d.tisPolicies.length > 0).length;
    const auditedDeals = AppState.deals.filter(d => AppState.audits[d.dealKey] && AppState.audits[d.dealKey].outcome).length;

    document.getElementById('stat-total-deals').textContent = String(AppState.deals.length);
    document.getElementById('stat-total-sites').textContent = String(sites.length);
    document.getElementById('stat-total-execs').textContent = String(uniqueExecs.size);
    document.getElementById('stat-rwa-matched').textContent = String(rwaMatched);
    document.getElementById('stat-tis-matched').textContent = String(tisMatched);
    document.getElementById('stat-audited-deals').textContent = String(auditedDeals);

    const gotoQueueBtn = document.getElementById('btn-goto-queue');
    gotoQueueBtn.disabled = AppState.deals.length === 0;

    const summaryEl = document.getElementById('session-summary-text');
    if (AppState.deals.length > 0) {
      summaryEl.textContent = `Active local session: ${AppState.deals.length} deals across ${sites.length} site(s), ${auditedDeals} deal(s) classified. Last saved: ${AppState.lastSavedAt ? new Date(AppState.lastSavedAt).toLocaleString('en-GB') : 'Unsaved'}.`;
    } else {
      summaryEl.textContent = 'No master data loaded yet. Upload the iStoreDocs, RWA, and TIS reports below, or restore a previously exported Compliance Desk workbook.';
    }
  }

  /* ================================================================== */
  /* 11. VIEW RENDERING: VIEW 2 (SITE & EXECUTIVE RISK QUEUE)           */
  /* ================================================================== */
  function renderQueueView() {
    const emptyEl = document.getElementById('queue-empty-state');
    const contentEl = document.getElementById('queue-content');

    if (AppState.deals.length === 0) {
      emptyEl.hidden = false;
      contentEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    contentEl.hidden = false;

    // Populate Site Dropdown
    const sites = getUniqueSites();
    if (!sites.includes(AppState.selectedSite)) {
      AppState.selectedSite = sites[0] || '';
    }
    const siteSelect = document.getElementById('site-select');
    siteSelect.innerHTML = sites.map(s => {
      const count = AppState.deals.filter(d => d.site === s).length;
      return `<option value="${escapeHtml(s)}"${s === AppState.selectedSite ? ' selected' : ''}>${escapeHtml(s)} (${count} deals)</option>`;
    }).join('');

    // Populate Executive List for Selected Site
    const execs = getExecutivesForSite(AppState.selectedSite);
    if (!execs.includes(AppState.selectedExecutive)) {
      AppState.selectedExecutive = execs[0] || '';
    }

    const filteredExecs = execs.filter(ex => !RuntimeCache.execSearch || ex.toLowerCase().includes(RuntimeCache.execSearch.toLowerCase()));
    document.getElementById('exec-count-label').textContent = String(execs.length);

    const execListEl = document.getElementById('exec-list');
    execListEl.innerHTML = filteredExecs.map(ex => {
      const info = computeExecutiveRiskSample(AppState.selectedSite, ex);
      const isSelected = ex === AppState.selectedExecutive;
      const doneClass = info.auditedCount >= info.targetCount && info.targetCount > 0 ? ' is-done' : '';
      return `
        <li>
          <button type="button" class="exec-item-btn" data-exec="${escapeHtml(ex)}" aria-pressed="${isSelected ? 'true' : 'false'}">
            <span class="exec-item-top">
              <span>${escapeHtml(ex)}</span>
              <span class="exec-progress-badge${doneClass}">${info.auditedCount}/${info.targetCount} Audited</span>
            </span>
            <span class="exec-item-sub">
              <span>${info.deals.length} total deal(s)</span>
              <span>${info.recommendedMap.size} sampled</span>
            </span>
          </button>
        </li>
      `;
    }).join('');

    renderExecutiveDealsTable();
  }

  function renderExecutiveDealsTable() {
    const headingEl = document.getElementById('selected-exec-heading');
    const subEl = document.getElementById('selected-exec-sub');
    const badgesEl = document.getElementById('selected-exec-badges');
    const bannerEl = document.getElementById('sample-summary-banner');
    const tbody = document.getElementById('deals-table-body');
    const monthSelect = document.getElementById('deal-month-filter');

    if (!AppState.selectedSite || !AppState.selectedExecutive) {
      headingEl.textContent = 'Select a Sales Executive';
      subEl.textContent = '';
      badgesEl.innerHTML = '';
      bannerEl.hidden = true;
      tbody.innerHTML = '';
      return;
    }

    const info = computeExecutiveRiskSample(AppState.selectedSite, AppState.selectedExecutive);
    headingEl.textContent = AppState.selectedExecutive;
    subEl.textContent = `Site: ${AppState.selectedSite} | ${info.deals.length} total deals in dataset`;
    badgesEl.innerHTML = `
      <span class="badge ${info.auditedCount >= info.targetCount && info.targetCount > 0 ? 'badge-pass' : 'badge-navy'}">${info.auditedCount}/${info.targetCount} Audited</span>
      <span class="badge badge-sample">${info.recommendedMap.size} Recommended Sample</span>
    `;

    // Sample Months Banner
    const parts = [];
    if (info.monthA) parts.push(`Month A: ${formatMonthLabel(info.monthA)} (${info.countMonthA}/3 flagged)`);
    if (info.monthB) parts.push(`Month B: ${formatMonthLabel(info.monthB)} (${info.countMonthB}/3 flagged)`);
    if (parts.length > 0) {
      bannerEl.hidden = false;
      bannerEl.innerHTML = `
        <div><strong>Automated 6-Deal Risk Sample:</strong> ${escapeHtml(parts.join(' | '))}</div>
        <div class="text-small muted">Tier 1: Fin + 2+ Ins | Tier 2: Fin + 1 Ins | Tier 3: Fin + 0 Ins | Tier 4: Cash</div>
      `;
    } else {
      bannerEl.hidden = true;
    }

    // Populate Month Filter
    const currentMonthVal = RuntimeCache.queueMonth;
    monthSelect.innerHTML = `<option value="all">All Months (${info.allMonths.length})</option>` +
      info.allMonths.map(mk => `<option value="${escapeHtml(mk)}"${mk === currentMonthVal ? ' selected' : ''}>${escapeHtml(formatMonthLabel(mk))}</option>`).join('');
    if (currentMonthVal !== 'all' && !info.allMonths.includes(currentMonthVal)) {
      RuntimeCache.queueMonth = 'all';
      monthSelect.value = 'all';
    }

    // Update Quick Filter Pill states
    document.querySelectorAll('#queue-filter-pills .pill-btn').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.qfilter === RuntimeCache.queueQuickFilter ? 'true' : 'false');
    });

    // Filter Deals
    const query = RuntimeCache.queueSearch.toLowerCase().trim();
    let rows = info.deals.filter(deal => {
      const rec = info.recommendedMap.get(deal.dealKey);
      const audit = AppState.audits[deal.dealKey];
      const isAudited = Boolean(audit && audit.outcome);

      if (RuntimeCache.queueQuickFilter === 'recommended' && !rec) return false;
      if (RuntimeCache.queueQuickFilter === 'audited' && !isAudited) return false;
      if (RuntimeCache.queueQuickFilter === 'pending' && isAudited) return false;

      if (RuntimeCache.queueMonth !== 'all') {
        if (!deal.deliveryDate || deal.deliveryDate.monthKey !== RuntimeCache.queueMonth) return false;
      }
      if (RuntimeCache.queueTier !== 'all' && String(deal.riskTier) !== RuntimeCache.queueTier) return false;

      if (query) {
        const hay = [
          deal.vrm,
          deal.vrmRaw,
          deal.customerName,
          deal.fundingType,
          deal.rwaProducts.map(p => p.productName).join(' '),
          audit && audit.outcome ? audit.outcome : ''
        ].join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    // Sort Deals
    const { field, dir } = RuntimeCache.queueSort;
    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const recA = info.recommendedMap.get(a.dealKey);
      const recB = info.recommendedMap.get(b.dealKey);
      const audA = (AppState.audits[a.dealKey] && AppState.audits[a.dealKey].outcome) || '';
      const audB = (AppState.audits[b.dealKey] && AppState.audits[b.dealKey].outcome) || '';

      if (field === 'recommended') {
        const rA = recA ? 0 : 1;
        const rB = recB ? 0 : 1;
        if (rA !== rB) return (rA - rB) * mult;
        if (a.riskTier !== b.riskTier) return (a.riskTier - b.riskTier) * mult;
        const tsA = a.deliveryDate ? a.deliveryDate.timestamp : 0;
        const tsB = b.deliveryDate ? b.deliveryDate.timestamp : 0;
        return (tsB - tsA);
      }
      if (field === 'deliveryDate') {
        const tsA = a.deliveryDate ? a.deliveryDate.timestamp : 0;
        const tsB = b.deliveryDate ? b.deliveryDate.timestamp : 0;
        return (tsA - tsB) * mult;
      }
      if (field === 'vrm') return a.vrm.localeCompare(b.vrm) * mult;
      if (field === 'customerName') return a.customerName.localeCompare(b.customerName) * mult;
      if (field === 'fundingType') return a.fundingType.localeCompare(b.fundingType) * mult;
      if (field === 'rwaCount') return (a.rwaProducts.length - b.rwaProducts.length) * mult;
      if (field === 'outcome') return audA.localeCompare(audB) * mult;
      return 0;
    });

    // Update aria-sort indicators
    document.querySelectorAll('#deals-table thead th').forEach(th => {
      const btn = th.querySelector('.sort-btn');
      if (!btn) return;
      const ind = btn.querySelector('.sort-indicator');
      if (btn.dataset.sort === field) {
        th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
        if (ind) ind.textContent = dir === 'asc' ? '▲' : '▼';
      } else {
        th.setAttribute('aria-sort', 'none');
        if (ind) ind.textContent = '';
      }
    });

    document.getElementById('deals-table-caption').textContent =
      `Showing ${rows.length} of ${info.deals.length} deal(s) for ${AppState.selectedExecutive}`;

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center; padding: 24px;">No deals match the current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(deal => {
      const rec = info.recommendedMap.get(deal.dealKey);
      const audit = AppState.audits[deal.dealKey];
      const outcome = audit && audit.outcome ? audit.outcome : '';
      const outcomeMeta = OUTCOME_META[outcome];
      const rwaList = deal.rwaProducts.length > 0
        ? `${deal.rwaProducts.length}: ${deal.rwaProducts.map(p => p.productName).join(', ')}`
        : 'None (0)';
      const tisSummary = deal.tisPolicies.length > 0
        ? `${deal.tisPolicies.length} policy/policies`
        : (deal.rwaProducts.length > 0 ? '0 in TIS (Check)' : 'None');

      const tierLabel = `Tier ${deal.riskTier}`;

      return `
        <tr class="row-clickable${rec ? ' row-recommended' : ''}" data-open-deal="${escapeHtml(deal.dealKey)}">
          <td>
            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
              ${rec ? `<span class="badge badge-sample">Recommended Sample (${escapeHtml(rec.slot)})</span>` : ''}
              <span class="badge badge-tier-${deal.riskTier}">${tierLabel}</span>
            </div>
          </td>
          <td class="num-cell">${escapeHtml(deal.deliveryDate ? deal.deliveryDate.display : 'Missing')}</td>
          <td><span class="vrm-plate">${escapeHtml(deal.vrm)}</span></td>
          <td>${escapeHtml(deal.customerName)}</td>
          <td>
            <span class="badge ${deal.isFinance ? 'badge-navy' : 'badge-neutral'}">${escapeHtml(deal.fundingType)}</span>
          </td>
          <td class="text-small">${escapeHtml(rwaList)}</td>
          <td class="text-small">${escapeHtml(tisSummary)}</td>
          <td>
            ${outcomeMeta
              ? `<span class="badge ${outcomeMeta.badgeClass}">${escapeHtml(outcome)}</span>`
              : `<span class="badge badge-neutral">${audit && audit.updatedAt ? 'In Progress' : 'Not Audited'}</span>`}
          </td>
          <td>
            <button type="button" class="btn btn-primary btn-sm" data-audit-deal="${escapeHtml(deal.dealKey)}">
              ${outcome ? 'Review Audit' : 'Audit Deal'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* ================================================================== */
  /* 12. VIEW RENDERING: VIEW 3 (SINGLE-DEAL AUDIT WORKSPACE)           */
  /* ================================================================== */
  function openDealWorkspace(dealKey) {
    const deal = AppState.deals.find(d => d.dealKey === dealKey);
    if (!deal) {
      showToast('Selected deal could not be found.', 'error', true);
      return;
    }
    AppState.activeDealKey = dealKey;
    const audit = ensureAuditRecord(deal);
    applyAutoPreCheckDefaults(deal, audit, false);
    saveStateToLocalStorage();
    switchView('workspace');
  }

  function renderWorkspace() {
    const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
    if (!deal) {
      switchView('queue');
      return;
    }

    const audit = ensureAuditRecord(deal);
    const execInfo = computeExecutiveRiskSample(deal.site, deal.salesExecutive);
    const recInfo = execInfo.recommendedMap.get(deal.dealKey);
    const preChecks = computeAutomatedPreChecks(deal, audit);

    // Top Bar
    document.getElementById('v3-heading').textContent = `${deal.customerName} (${deal.salesExecutive})`;
    document.getElementById('ws-vrm-plate').textContent = deal.vrm;
    const tierBadge = document.getElementById('ws-tier-badge');
    tierBadge.textContent = `Tier ${deal.riskTier}`;
    tierBadge.className = `badge badge-tier-${deal.riskTier}`;
    document.getElementById('ws-sample-badge').hidden = !recInfo;

    // Cross-Reference Panel (iStoreDocs, RWA, TIS side-by-side)
    const daysToClose = (deal.deliveryDate && deal.fileClosedDate)
      ? daysBetweenIso(deal.deliveryDate.iso, deal.fileClosedDate.iso)
      : null;
    const daysOpen = (deal.deliveryDate && !deal.fileClosedDate)
      ? daysBetweenIso(deal.deliveryDate.iso, getTodayIso())
      : null;

    document.getElementById('ws-xref-panel').innerHTML = `
      <article class="xref-card">
        <h2>
          <span>iStoreDocs Deal &amp; Timeline</span>
          <span class="badge ${deal.isFinance ? 'badge-navy' : 'badge-neutral'}">${escapeHtml(deal.fundingType)}</span>
        </h2>
        <dl class="kv-list">
          <dt>VRM</dt><dd><span class="vrm-plate">${escapeHtml(deal.vrm)}</span></dd>
          <dt>Customer</dt><dd>${escapeHtml(deal.customerName)}</dd>
          <dt>Dealership Site</dt><dd>${escapeHtml(deal.site)}</dd>
          <dt>Sales Executive</dt><dd>${escapeHtml(deal.salesExecutive)}</dd>
          <dt>Delivery Date</dt><dd>${escapeHtml(deal.deliveryDate ? deal.deliveryDate.display : 'Not Recorded')}</dd>
          ${deal.orderDate ? `<dt>Order Date</dt><dd>${escapeHtml(deal.orderDate.display)}</dd>` : ''}
          <dt>File Created</dt><dd>${escapeHtml(deal.fileCreatedDate ? deal.fileCreatedDate.display : 'Not Recorded')}</dd>
          <dt>File Closed</dt><dd>${escapeHtml(deal.fileClosedDate ? deal.fileClosedDate.display : 'Not Closed')}${daysToClose !== null ? ` (${daysToClose}d post-handover)` : (daysOpen !== null ? ` (Open ${daysOpen}d)` : '')}</dd>
          <dt>File Status</dt><dd>${escapeHtml(deal.fileStatus || 'Not Recorded')}</dd>
          ${deal.vehicleDetails ? `<dt>Vehicle</dt><dd>${escapeHtml(deal.vehicleDetails)}</dd>` : ''}
        </dl>
      </article>

      <article class="xref-card">
        <h2>
          <span>RWA Regulated Products</span>
          <span class="badge ${deal.rwaProducts.length > 0 ? 'badge-navy' : 'badge-neutral'}">${deal.rwaProducts.length} Sold</span>
        </h2>
        ${deal.rwaProducts.length > 0
          ? `<ul class="mini-item-list" role="list">${deal.rwaProducts.map(p => `
              <li>
                <strong>${escapeHtml(p.productName)}</strong>
                <div class="text-small muted">
                  ${p.price ? `Value: ${escapeHtml(p.price)}` : ''}
                  ${p.funding ? ` | Funding: ${escapeHtml(p.funding)}` : ''}
                  ${p.status ? ` | Status: ${escapeHtml(p.status)}` : ''}
                </div>
              </li>
            `).join('')}</ul>`
          : `<p class="text-small muted">No active regulated products recorded in RWA for VRM ${escapeHtml(deal.vrm)}.</p>`}
        ${deal.rwaCancelled.length > 0
          ? `<p class="text-small muted" style="margin-top:8px;">Cancelled/Declined in RWA: ${escapeHtml(deal.rwaCancelled.map(p => p.productName).join(', '))}</p>`
          : ''}
      </article>

      <article class="xref-card">
        <h2>
          <span>TIS Insurance Registrations</span>
          <span class="badge ${deal.tisPolicies.length > 0 ? 'badge-pass' : 'badge-neutral'}">${deal.tisPolicies.length} Policy/Policies</span>
        </h2>
        ${deal.tisPolicies.length > 0
          ? `<ul class="mini-item-list" role="list">${deal.tisPolicies.map(p => {
              const incMatch = deal.deliveryDate && p.inceptionDate
                ? (p.inceptionDate.iso === deal.deliveryDate.iso)
                : null;
              return `
                <li>
                  <div style="display:flex; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                    <strong>${escapeHtml(p.productName)}</strong>
                    <span class="badge ${/unreg|pending|fail|cancel|error/i.test(p.registrationStatus) ? 'badge-tcf' : 'badge-pass'}">${escapeHtml(p.registrationStatus)}</span>
                  </div>
                  <div class="text-small muted" style="margin-top:3px;">
                    ${p.policyNumber ? `Policy: ${escapeHtml(p.policyNumber)} | ` : ''}
                    Inception: ${escapeHtml(p.inceptionDate ? p.inceptionDate.display : 'Missing')}
                    ${incMatch === true ? ' (Matches Delivery)' : (incMatch === false ? ' (Differs from Delivery)' : '')}
                    | Reg Date: ${escapeHtml(p.registrationDate ? p.registrationDate.display : 'Missing')}
                  </div>
                </li>
              `;
            }).join('')}</ul>`
          : `<p class="text-small muted">No policy registrations recorded in TIS for VRM ${escapeHtml(deal.vrm)}.</p>`}
      </article>
    `;

    // Dynamic Scope Bar
    const scopeBar = document.getElementById('ws-scope-bar');
    const scopeQuestions = RuntimeCache.rules ? RuntimeCache.rules.meta.scopeQuestions : [
      { id: 'finance', label: 'Is the customer taking finance?' },
      { id: 'insurance', label: 'Is the customer taking insurance?' },
      { id: 'supplementaryInvoice', label: 'Is a supplementary invoice required?' }
    ];

    const autoScope = getDefaultScopeForDeal(deal);
    scopeBar.innerHTML = scopeQuestions.map(sq => {
      const isOn = Boolean(audit.scope[sq.id]);
      const autoHintText = sq.id === 'finance'
        ? `Auto from iStoreDocs (${deal.fundingType}): ${autoScope.finance ? 'Yes' : 'No'}`
        : (sq.id === 'insurance'
          ? `Auto from RWA/TIS (${deal.rwaProducts.length} RWA / ${deal.tisPolicies.length} TIS): ${autoScope.insurance ? 'Yes' : 'No'}`
          : 'Manual or auto-detected from ZIP');
      return `
        <div class="scope-toggle${isOn ? ' is-active' : ''}">
          <div>
            <span class="scope-toggle-label">${escapeHtml(sq.label)}</span>
            <span class="scope-toggle-sub">${escapeHtml(autoHintText)}</span>
          </div>
          <button type="button" class="switch-btn" data-scope-toggle="${escapeHtml(sq.id)}" aria-pressed="${isOn ? 'true' : 'false'}">
            ${isOn ? 'YES' : 'NO'}
          </button>
        </div>
      `;
    }).join('');

    const activeDocs = getInScopeDocuments(audit.scope);
    const activeRecons = getActiveReconciliations(audit.scope);
    document.getElementById('ws-scope-summary').textContent =
      `${activeDocs.length} in-scope document(s) | ${activeRecons.length} active reconciliation(s)`;

    // ZIP Status & Alerts
    const zipStatusEl = document.getElementById('ws-zip-status');
    const clearZipBtn = document.getElementById('btn-clear-zip');
    const zipInvEl = document.getElementById('ws-zip-inventory');

    if (audit.zipScan) {
      zipStatusEl.textContent = `Loaded archive: ${audit.zipScan.archiveName} (${audit.zipScan.files.length} PDF file(s), scanned ${new Date(audit.zipScan.scannedAt).toLocaleString('en-GB')}). Drop another ZIP to replace.`;
      clearZipBtn.hidden = false;

      const allDocs = RuntimeCache.rules ? RuntimeCache.rules.documents : [];
      const hasRuntimeText = Boolean(RuntimeCache.pdfTextByDeal[deal.dealKey]);

      zipInvEl.innerHTML = `
        <ul class="pdf-inventory-list" role="list">
          ${audit.zipScan.files.map((f, idx) => `
            <li class="pdf-inventory-item">
              <div>
                <strong>${escapeHtml(f.fileName)}</strong>
                <span class="text-small muted">(${f.pageCount} page(s))</span>
                ${f.isImagePdf ? `<span class="badge badge-rke">Manual Review Required - Image PDF</span>` : `<span class="badge badge-pass">Text Extracted</span>`}
                ${f.extractError ? `<span class="badge badge-tcf">${escapeHtml(f.extractError)}</span>` : ''}
              </div>
              <div class="btn-group">
                <label for="pdf-map-${idx}" class="visually-hidden">Assign ${escapeHtml(f.fileName)} to document type</label>
                <select id="pdf-map-${idx}" class="form-select" style="min-block-size:30px; padding:4px 8px; width:auto; font-size:0.8rem;" data-pdf-reassign="${idx}">
                  <option value="">-- Unmatched PDF --</option>
                  ${allDocs.map(d => `<option value="${escapeHtml(d.id)}"${f.matchedDocId === d.id ? ' selected' : ''}>${escapeHtml(d.name)} (${escapeHtml(d.shortName)})</option>`).join('')}
                </select>
                <button type="button" class="btn btn-sm" data-view-pdf="${escapeHtml(f.fileName)}" ${hasRuntimeText && RuntimeCache.pdfTextByDeal[deal.dealKey][f.fileName] !== undefined ? '' : 'disabled'}>
                  View Text
                </button>
              </div>
            </li>
          `).join('')}
        </ul>
      `;
    } else {
      zipStatusEl.textContent = 'Drop the deal .zip file here to unpack PDFs in memory, extract text via PDF.js, and match against in-scope documents.';
      clearZipBtn.hidden = true;
      zipInvEl.innerHTML = '';
    }

    // Automated Pre-Check Alerts
    const alertsEl = document.getElementById('ws-auto-alerts');
    if (preChecks.alerts.length > 0) {
      alertsEl.innerHTML = preChecks.alerts.map(a =>
        `<div class="alert-box alert-${escapeHtml(a.level)}">${escapeHtml(a.text)}</div>`
      ).join('');
    } else if (audit.zipScan) {
      alertsEl.innerHTML = `<div class="alert-box alert-success">Automated pre-checks found no spreadsheet timeline, RWA/TIS, or missing-document alerts for the current scope.</div>`;
    } else {
      alertsEl.innerHTML = '';
    }

    // Render Document Checklist Cards
    document.getElementById('ws-doc-count').textContent = String(activeDocs.length);
    const docChecklistEl = document.getElementById('ws-doc-checklist');

    if (!RuntimeCache.rules) {
      docChecklistEl.innerHTML = `<div class="empty-state">Load documents.json to render the compliance document checklist.</div>`;
    } else {
      if (!RuntimeCache.expandedDocsByDeal[deal.dealKey]) {
        // Default expand first document or any document with flags/missing
        const initialSet = new Set();
        activeDocs.forEach((d, idx) => {
          if (idx === 0) initialSet.add(d.id);
        });
        RuntimeCache.expandedDocsByDeal[deal.dealKey] = initialSet;
      }
      const expandedSet = RuntimeCache.expandedDocsByDeal[deal.dealKey];

      docChecklistEl.innerHTML = activeDocs.map(doc => {
        const activeChecks = getActiveChecks(doc, audit.scope);
        const matchedPdfs = (audit.zipScan && audit.zipScan.files || []).filter(f => f.matchedDocId === doc.id);
        const isAuditDoc = AUDIT_ONLY_DOC_IDS.has(doc.id);
        const isDetected = matchedPdfs.length > 0;
        const hasImagePdf = matchedPdfs.some(f => f.isImagePdf);

        let checkedCount = 0;
        let flagCount = 0;
        for (const chk of activeChecks) {
          const st = audit.checks[chk.id] && audit.checks[chk.id].state;
          if (st) checkedCount++;
          if (st === 'flag') flagCount++;
        }

        let statusBadge = '';
        let cardClass = 'doc-card';
        if (isDetected) {
          statusBadge = hasImagePdf
            ? `<span class="badge badge-rke">Detected (${matchedPdfs.length}) - Image PDF</span>`
            : `<span class="badge badge-pass">Detected in ZIP (${matchedPdfs.length})</span>`;
          cardClass += ' is-detected';
        } else if (isAuditDoc) {
          statusBadge = `<span class="badge badge-obs">Audit/Timeline Check</span>`;
          cardClass += ' is-audit-type';
        } else if (audit.zipScan) {
          statusBadge = `<span class="badge badge-tcf">Missing from ZIP</span>`;
          cardClass += ' is-missing';
        } else {
          statusBadge = `<span class="badge badge-neutral">Awaiting ZIP</span>`;
        }

        if (flagCount > 0) cardClass += ' has-flag';

        const importanceBadgeClass = doc.importance === 'critical'
          ? 'badge-rb'
          : (doc.importance === 'high' ? 'badge-rke' : 'badge-neutral');

        const isExpanded = expandedSet.has(doc.id);
        const activeRules = getActiveTextItems(doc.rules, audit.scope);
        const activeErrors = getActiveTextItems(doc.commonErrors, audit.scope);
        const activeXrefs = (doc.crossReference || []).filter(x => matchesWhen(x.when, audit.scope));

        return `
          <article class="${cardClass}" data-doc-card="${escapeHtml(doc.id)}">
            <h3 class="doc-card-heading">
              <button type="button" class="doc-card-toggle" data-toggle-doc="${escapeHtml(doc.id)}" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-controls="doc-body-${escapeHtml(doc.id)}">
                <span class="doc-card-toggle-left">
                  <span class="doc-chevron" aria-hidden="true">&gt;</span>
                  <span>${escapeHtml(doc.name)}</span>
                  <span class="badge badge-navy">${escapeHtml(doc.shortName)}</span>
                  <span class="badge ${importanceBadgeClass}">${escapeHtml(doc.importance)}</span>
                  <span class="badge badge-neutral">${escapeHtml(doc.category)}</span>
                </span>
                <span class="doc-card-toggle-right">
                  ${statusBadge}
                  <span class="badge ${flagCount > 0 ? 'badge-tcf' : (checkedCount === activeChecks.length && activeChecks.length > 0 ? 'badge-pass' : 'badge-neutral')}">
                    ${checkedCount}/${activeChecks.length} Checked${flagCount > 0 ? ` (${flagCount} Flagged)` : ''}
                  </span>
                </span>
              </button>
            </h3>
            <div id="doc-body-${escapeHtml(doc.id)}" class="doc-card-body"${isExpanded ? '' : ' hidden'}>
              ${isDetected ? `
                <div class="matched-pdf-bar">
                  <div>
                    <strong>Matched PDF(s):</strong> ${matchedPdfs.map(f => `${escapeHtml(f.fileName)}${f.isImagePdf ? ' [Manual Review Required - Image PDF]' : ''}`).join(', ')}
                  </div>
                  <div class="btn-group">
                    ${matchedPdfs.map(f => {
                      const canView = Boolean(RuntimeCache.pdfTextByDeal[deal.dealKey] && RuntimeCache.pdfTextByDeal[deal.dealKey][f.fileName] !== undefined);
                      return `<button type="button" class="btn btn-sm" data-view-pdf="${escapeHtml(f.fileName)}"${canView ? '' : ' disabled'}>Inspect ${escapeHtml(f.fileName)}</button>`;
                    }).join('')}
                  </div>
                </div>
              ` : (!isAuditDoc && audit.zipScan ? `
                <div class="alert-box alert-warning" style="margin-top:0; margin-bottom:12px;">
                  Required in-scope document not detected in the uploaded ZIP pack. Verify whether it is missing or merged inside another PDF.
                </div>
              ` : '')}

              <ul class="check-list" role="list">
                ${activeChecks.map(chk => {
                  const entry = audit.checks[chk.id] || { state: '', source: '' };
                  const hint = preChecks.checkHints[chk.id];
                  const rowStateClass = entry.state ? ` state-${entry.state}` : '';
                  return `
                    <li class="check-row${rowStateClass}">
                      <div class="check-text-col">
                        <div>
                          <span class="check-id">${escapeHtml(chk.id)}</span>
                          <span class="check-label">${escapeHtml(chk.text)}</span>
                          ${entry.source === 'auto' ? `<span class="badge badge-obs" style="margin-left:6px;">Auto</span>` : ''}
                        </div>
                        ${hint ? `<div class="auto-hint hint-${escapeHtml(hint.status)}">${escapeHtml(hint.message)}</div>` : ''}
                      </div>
                      <div class="tri-toggle" role="group" aria-label="Status for ${escapeHtml(chk.id)}">
                        <button type="button" class="tri-btn" data-check-id="${escapeHtml(chk.id)}" data-val="pass" aria-pressed="${entry.state === 'pass' ? 'true' : 'false'}">Pass</button>
                        <button type="button" class="tri-btn" data-check-id="${escapeHtml(chk.id)}" data-val="flag" aria-pressed="${entry.state === 'flag' ? 'true' : 'false'}">Flag</button>
                        <button type="button" class="tri-btn" data-check-id="${escapeHtml(chk.id)}" data-val="na" aria-pressed="${entry.state === 'na' ? 'true' : 'false'}">N/A</button>
                      </div>
                    </li>
                  `;
                }).join('')}
              </ul>

              <details class="ref-drawer">
                <summary>Reference Guide: Rules (${activeRules.length}), Common Errors (${activeErrors.length}), Cross-References &amp; Best Practice</summary>
                <div class="ref-drawer-content">
                  <div>
                    <p class="ref-block-title">Compliance Rules</p>
                    ${activeRules.length > 0
                      ? `<ul class="ref-list">${activeRules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
                      : `<p class="muted">No specific rules listed.</p>`}
                  </div>
                  <div>
                    <p class="ref-block-title">Common Errors</p>
                    ${activeErrors.length > 0
                      ? `<ul class="ref-list">${activeErrors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
                      : `<p class="muted">No common errors listed.</p>`}
                    ${doc.bestPractice ? `
                      <p class="ref-block-title" style="margin-top:10px;">Best Practice</p>
                      <p style="margin:0;">${escapeHtml(doc.bestPractice)}</p>
                    ` : ''}
                  </div>
                  ${activeXrefs.length > 0 ? `
                    <div>
                      <p class="ref-block-title">Cross-References</p>
                      <ul class="ref-list">
                        ${activeXrefs.map(xr => {
                          const targetDoc = getDocById(xr.documentId);
                          const targetLabel = targetDoc ? `${targetDoc.name} (${targetDoc.shortName})` : xr.documentId;
                          return `<li><strong>${escapeHtml(targetLabel)}:</strong> ${escapeHtml(xr.what)} (${escapeHtml(xr.where)})</li>`;
                        }).join('')}
                      </ul>
                    </div>
                  ` : ''}
                </div>
              </details>
            </div>
          </article>
        `;
      }).join('');
    }

    // Render Cross-Document Reconciliations
    document.getElementById('ws-recon-count').textContent = String(activeRecons.length);
    const reconListEl = document.getElementById('ws-recon-list');

    if (!RuntimeCache.rules || activeRecons.length === 0) {
      reconListEl.innerHTML = `<div class="muted text-small">No active reconciliations for the selected scope.</div>`;
    } else {
      reconListEl.innerHTML = activeRecons.map(rec => {
        const fromDoc = getDocById(rec.from);
        const toDoc = getDocById(rec.to);
        const entry = audit.reconciliations[rec._id] || { state: '', source: '' };
        const hint = preChecks.reconHints[`${rec.from}::${rec.to}`];
        const rowStateClass = entry.state ? ` state-${entry.state}` : '';
        const sevClass = rec.severity === 'critical' ? 'badge-rb' : 'badge-rke';

        return `
          <div class="check-row${rowStateClass}">
            <div class="check-text-col">
              <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-bottom:4px;">
                <span class="badge ${sevClass}">${escapeHtml(rec.severity.toUpperCase())}</span>
                <span class="badge badge-navy">${escapeHtml(fromDoc ? fromDoc.shortName : rec.from)}</span>
                <span class="muted" aria-hidden="true">-&gt;</span>
                <span class="badge badge-navy">${escapeHtml(toDoc ? toDoc.shortName : rec.to)}</span>
                <span class="text-small muted">(${escapeHtml(fromDoc ? fromDoc.name : rec.from)} to ${escapeHtml(toDoc ? toDoc.name : rec.to)})</span>
                ${entry.source === 'auto' ? `<span class="badge badge-obs">Auto</span>` : ''}
              </div>
              <div class="check-label">${escapeHtml(rec.check)}</div>
              ${hint ? `<div class="auto-hint hint-${escapeHtml(hint.status)}">${escapeHtml(hint.message)}</div>` : ''}
            </div>
            <div class="tri-toggle" role="group" aria-label="Reconciliation status for ${escapeHtml(rec.check)}">
              <button type="button" class="tri-btn" data-recon-id="${escapeHtml(rec._id)}" data-val="pass" aria-pressed="${entry.state === 'pass' ? 'true' : 'false'}">Pass</button>
              <button type="button" class="tri-btn" data-recon-id="${escapeHtml(rec._id)}" data-val="flag" aria-pressed="${entry.state === 'flag' ? 'true' : 'false'}">Flag</button>
              <button type="button" class="tri-btn" data-recon-id="${escapeHtml(rec._id)}" data-val="na" aria-pressed="${entry.state === 'na' ? 'true' : 'false'}">N/A</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Outcome Selector & Notes
    const outcomeSelect = document.getElementById('ws-outcome-select');
    outcomeSelect.value = audit.outcome || '';
    updateOutcomePreviewBadge(audit.outcome || '');

    const notesArea = document.getElementById('ws-notes-textarea');
    if (notesArea.value !== (audit.notes || '')) {
      notesArea.value = audit.notes || '';
    }
  }

  function updateOutcomePreviewBadge(outcome) {
    const badge = document.getElementById('ws-outcome-badge');
    const meta = OUTCOME_META[outcome];
    if (meta) {
      badge.textContent = outcome;
      badge.className = `badge ${meta.badgeClass}`;
    } else {
      badge.textContent = 'Not Classified';
      badge.className = 'badge badge-neutral';
    }
  }

  /* ================================================================== */
  /* 13. VIEW RENDERING: VIEW 4 (MASTER EXPORT & REPORTING)             */
  /* ================================================================== */
  function getExportFilteredDeals() {
    const siteVal = RuntimeCache.exportSiteFilter;
    if (siteVal === '__ALL__') return AppState.deals;
    const targetSite = siteVal === '__CURRENT__' ? AppState.selectedSite : siteVal;
    if (!targetSite) return AppState.deals;
    return AppState.deals.filter(d => d.site === targetSite);
  }

  function getFailedChecksForDeal(audit) {
    const failed = [];
    if (!audit || !audit.checks) return failed;
    const activeDocs = getInScopeDocuments(audit.scope);
    const checkLookup = new Map();
    for (const doc of activeDocs) {
      for (const chk of getActiveChecks(doc, audit.scope)) {
        checkLookup.set(chk.id, { docName: doc.name, docShort: doc.shortName, text: chk.text });
      }
    }
    for (const [id, entry] of Object.entries(audit.checks)) {
      if (entry && entry.state === 'flag') {
        if (RuntimeCache.rules && !checkLookup.has(id)) continue;
        const info = checkLookup.get(id);
        failed.push({
          id,
          description: info ? `[${info.docShort}] ${info.text}` : id
        });
      }
    }
    return failed;
  }

  function getFailedReconsForDeal(audit) {
    const failed = [];
    if (!audit || !audit.reconciliations) return failed;
    const activeRecons = getActiveReconciliations(audit.scope);
    for (const rec of activeRecons) {
      const entry = audit.reconciliations[rec._id];
      if (entry && entry.state === 'flag') {
        const fromDoc = getDocById(rec.from);
        const toDoc = getDocById(rec.to);
        failed.push({
          id: rec._id,
          severity: rec.severity,
          description: `[${rec.severity.toUpperCase()}] ${fromDoc ? fromDoc.shortName : rec.from} -> ${toDoc ? toDoc.shortName : rec.to}: ${rec.check}`
        });
      }
    }
    return failed;
  }

  function renderExportView() {
    const sites = getUniqueSites();
    const siteFilterSelect = document.getElementById('export-site-filter');
    const currentSiteLabel = AppState.selectedSite ? `Current Site (${AppState.selectedSite})` : 'All Sites';

    const options = [];
    if (AppState.selectedSite) {
      options.push(`<option value="__CURRENT__"${RuntimeCache.exportSiteFilter === '__CURRENT__' ? ' selected' : ''}>${escapeHtml(currentSiteLabel)}</option>`);
    }
    options.push(`<option value="__ALL__"${RuntimeCache.exportSiteFilter === '__ALL__' || !AppState.selectedSite ? ' selected' : ''}>All Dealership Sites (${sites.length})</option>`);
    for (const s of sites) {
      options.push(`<option value="${escapeHtml(s)}"${RuntimeCache.exportSiteFilter === s ? ' selected' : ''}>${escapeHtml(s)}</option>`);
    }
    siteFilterSelect.innerHTML = options.join('');

    const deals = getExportFilteredDeals();
    const auditedDeals = deals.filter(d => AppState.audits[d.dealKey] && AppState.audits[d.dealKey].outcome);

    const counts = {
      totalAudited: auditedDeals.length,
      'Pass': 0,
      'Record Keeping Error (RKE)': 0,
      'TCF Issue (TCF)': 0,
      'Rule Breach (RB)': 0,
      'Observation (OBS)': 0
    };

    for (const deal of auditedDeals) {
      const out = AppState.audits[deal.dealKey].outcome;
      if (counts[out] !== undefined) counts[out]++;
    }

    const pct = (n) => counts.totalAudited > 0 ? `${Math.round((n / counts.totalAudited) * 100)}%` : '0%';

    document.getElementById('export-kpi-row').innerHTML = `
      <div class="stat-tile">
        <div class="stat-label">Total Audited</div>
        <div class="stat-value">${counts.totalAudited}</div>
      </div>
      <div class="stat-tile tile-pass">
        <div class="stat-label">Pass (${pct(counts['Pass'])})</div>
        <div class="stat-value">${counts['Pass']}</div>
      </div>
      <div class="stat-tile tile-rke">
        <div class="stat-label">RKE (${pct(counts['Record Keeping Error (RKE)'])})</div>
        <div class="stat-value">${counts['Record Keeping Error (RKE)']}</div>
      </div>
      <div class="stat-tile tile-tcf">
        <div class="stat-label">TCF (${pct(counts['TCF Issue (TCF)'])})</div>
        <div class="stat-value">${counts['TCF Issue (TCF)']}</div>
      </div>
      <div class="stat-tile tile-rb">
        <div class="stat-label">Rule Breach (${pct(counts['Rule Breach (RB)'])})</div>
        <div class="stat-value">${counts['Rule Breach (RB)']}</div>
      </div>
      <div class="stat-tile tile-obs">
        <div class="stat-label">Observation (${pct(counts['Observation (OBS)'])})</div>
        <div class="stat-value">${counts['Observation (OBS)']}</div>
      </div>
    `;

    // Executive Summary Table
    const execGroups = new Map();
    for (const deal of deals) {
      const key = `${deal.site}|||${deal.salesExecutive}`;
      if (!execGroups.has(key)) {
        execGroups.set(key, {
          site: deal.site,
          executive: deal.salesExecutive,
          totalDeals: 0,
          audited: 0,
          pass: 0,
          rke: 0,
          tcf: 0,
          rb: 0,
          obs: 0
        });
      }
      const g = execGroups.get(key);
      g.totalDeals++;
      const audit = AppState.audits[deal.dealKey];
      if (audit && audit.outcome) {
        g.audited++;
        if (audit.outcome === 'Pass') g.pass++;
        else if (audit.outcome === 'Record Keeping Error (RKE)') g.rke++;
        else if (audit.outcome === 'TCF Issue (TCF)') g.tcf++;
        else if (audit.outcome === 'Rule Breach (RB)') g.rb++;
        else if (audit.outcome === 'Observation (OBS)') g.obs++;
      }
    }

    const execRows = Array.from(execGroups.values()).sort((a, b) =>
      a.site.localeCompare(b.site) || a.executive.localeCompare(b.executive)
    );

    const execTbody = document.getElementById('export-exec-tbody');
    if (execRows.length === 0) {
      execTbody.innerHTML = `<tr><td colspan="10" class="muted" style="text-align:center; padding:20px;">No deals loaded yet.</td></tr>`;
    } else {
      execTbody.innerHTML = execRows.map(g => {
        const passRate = g.audited > 0 ? `${Math.round((g.pass / g.audited) * 100)}%` : 'N/A';
        return `
          <tr>
            <td>${escapeHtml(g.site)}</td>
            <td><strong>${escapeHtml(g.executive)}</strong></td>
            <td class="num-cell">${g.totalDeals}</td>
            <td class="num-cell"><strong>${g.audited}</strong></td>
            <td class="num-cell">${g.pass}</td>
            <td class="num-cell">${g.rke}</td>
            <td class="num-cell">${g.tcf}</td>
            <td class="num-cell">${g.rb}</td>
            <td class="num-cell">${g.obs}</td>
            <td class="num-cell">${passRate}</td>
          </tr>
        `;
      }).join('');
    }

    // Detailed Audit Log Preview
    document.getElementById('export-log-count').textContent = `${auditedDeals.length} classified deal(s)`;
    const dealsTbody = document.getElementById('export-deals-tbody');

    if (auditedDeals.length === 0) {
      dealsTbody.innerHTML = `<tr><td colspan="10" class="muted" style="text-align:center; padding:24px;">No deals have been classified yet. Complete deal audits in the Deal Workspace to populate the audit log.</td></tr>`;
    } else {
      dealsTbody.innerHTML = auditedDeals.map(deal => {
        const audit = AppState.audits[deal.dealKey];
        const failedChecks = getFailedChecksForDeal(audit);
        const failedRecons = getFailedReconsForDeal(audit);
        const meta = OUTCOME_META[audit.outcome] || { badgeClass: 'badge-neutral' };
        return `
          <tr>
            <td>${escapeHtml(deal.site)}</td>
            <td>${escapeHtml(deal.salesExecutive)}</td>
            <td><span class="vrm-plate">${escapeHtml(deal.vrm)}</span></td>
            <td>${escapeHtml(deal.customerName)}</td>
            <td class="num-cell">${escapeHtml(deal.deliveryDate ? deal.deliveryDate.display : '')}</td>
            <td><span class="badge ${meta.badgeClass}">${escapeHtml(audit.outcome)}</span></td>
            <td class="num-cell">${failedChecks.length}</td>
            <td class="num-cell">${failedRecons.length}</td>
            <td class="text-small">${escapeHtml((audit.notes || '').slice(0, 120))}${(audit.notes || '').length > 120 ? '...' : ''}</td>
            <td><button type="button" class="btn btn-sm" data-audit-deal="${escapeHtml(deal.dealKey)}">Open</button></td>
          </tr>
        `;
      }).join('');
    }
  }

  /* ================================================================== */
  /* 14. EXCEL EXPORT (.xlsx WITH HIDDEN _SessionState) & RESTORE       */
  /* ================================================================== */
  function exportAuditWorkbook() {
    if (typeof XLSX === 'undefined') {
      showToast('SheetJS (xlsx) library is not loaded.', 'error', true);
      return;
    }
    if (AppState.deals.length === 0) {
      showToast('No dataset loaded to export.', 'warning', true);
      return;
    }

    const deals = getExportFilteredDeals();
    const auditedDeals = deals.filter(d => AppState.audits[d.dealKey] && AppState.audits[d.dealKey].outcome);
    const rulesVersion = RuntimeCache.rules ? `${RuntimeCache.rules.meta.toolTitle} v${RuntimeCache.rules.meta.version}` : 'Not Loaded';
    const siteLabel = RuntimeCache.exportSiteFilter === '__ALL__'
      ? 'All Sites'
      : (RuntimeCache.exportSiteFilter === '__CURRENT__' ? (AppState.selectedSite || 'All Sites') : RuntimeCache.exportSiteFilter);

    // Precompute recommended map per executive
    const sampleCache = new Map();
    const isRecommendedDeal = (deal) => {
      const k = `${deal.site}|||${deal.salesExecutive}`;
      if (!sampleCache.has(k)) {
        sampleCache.set(k, computeExecutiveRiskSample(deal.site, deal.salesExecutive).recommendedMap);
      }
      return sampleCache.get(k).has(deal.dealKey);
    };

    // Tab 1: Executive Summary
    const execMap = new Map();
    for (const deal of deals) {
      const k = `${deal.site}|||${deal.salesExecutive}`;
      if (!execMap.has(k)) {
        execMap.set(k, { site: deal.site, exec: deal.salesExecutive, total: 0, audited: 0, pass: 0, rke: 0, tcf: 0, rb: 0, obs: 0 });
      }
      const g = execMap.get(k);
      g.total++;
      const audit = AppState.audits[deal.dealKey];
      if (audit && audit.outcome) {
        g.audited++;
        if (audit.outcome === 'Pass') g.pass++;
        else if (audit.outcome === 'Record Keeping Error (RKE)') g.rke++;
        else if (audit.outcome === 'TCF Issue (TCF)') g.tcf++;
        else if (audit.outcome === 'Rule Breach (RB)') g.rb++;
        else if (audit.outcome === 'Observation (OBS)') g.obs++;
      }
    }

    const summaryAoa = [
      ['Compliance Desk - Audit Executive Summary'],
      ['Scope / Site', siteLabel, 'Exported At', new Date().toLocaleString('en-GB'), 'Rules Version', rulesVersion],
      [],
      ['Dealership Site', 'Sales Executive', 'Total Deals', 'Audited Deals', 'Pass', 'Record Keeping Error (RKE)', 'TCF Issue (TCF)', 'Rule Breach (RB)', 'Observation (OBS)', 'Pass Rate (%)']
    ];

    const totals = { total: 0, audited: 0, pass: 0, rke: 0, tcf: 0, rb: 0, obs: 0 };
    const sortedExecs = Array.from(execMap.values()).sort((a, b) => a.site.localeCompare(b.site) || a.exec.localeCompare(b.exec));
    for (const g of sortedExecs) {
      totals.total += g.total;
      totals.audited += g.audited;
      totals.pass += g.pass;
      totals.rke += g.rke;
      totals.tcf += g.tcf;
      totals.rb += g.rb;
      totals.obs += g.obs;
      summaryAoa.push([
        g.site,
        g.exec,
        g.total,
        g.audited,
        g.pass,
        g.rke,
        g.tcf,
        g.rb,
        g.obs,
        g.audited > 0 ? Number(((g.pass / g.audited) * 100).toFixed(1)) : 0
      ]);
    }
    summaryAoa.push([
      'TOTAL',
      '',
      totals.total,
      totals.audited,
      totals.pass,
      totals.rke,
      totals.tcf,
      totals.rb,
      totals.obs,
      totals.audited > 0 ? Number(((totals.pass / totals.audited) * 100).toFixed(1)) : 0
    ]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
    wsSummary['!cols'] = [
      { wch: 24 }, { wch: 24 }, { wch: 12 }, { wch: 14 },
      { wch: 10 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }
    ];

    // Tab 2: Detailed Audit Log
    const detailRows = auditedDeals.map(deal => {
      const audit = AppState.audits[deal.dealKey];
      const failedChecks = getFailedChecksForDeal(audit);
      const failedRecons = getFailedReconsForDeal(audit);
      const inScopeDocs = getInScopeDocuments(audit.scope);
      const matchedDocIds = new Set((audit.zipScan && audit.zipScan.files || []).map(f => f.matchedDocId).filter(Boolean));
      const missingDocs = audit.zipScan
        ? inScopeDocs.filter(d => !AUDIT_ONLY_DOC_IDS.has(d.id) && !matchedDocIds.has(d.id)).map(d => d.name)
        : [];
      const imagePdfs = audit.zipScan
        ? (audit.zipScan.files || []).filter(f => f.isImagePdf).map(f => f.fileName)
        : [];

      return {
        'Dealership Site': deal.site,
        'Sales Executive': deal.salesExecutive,
        'VRM': deal.vrm,
        'Customer Name': deal.customerName,
        'Delivery Date': deal.deliveryDate ? deal.deliveryDate.display : '',
        'Funding Type': deal.fundingType,
        'Risk Tier': `Tier ${deal.riskTier}`,
        'Recommended Sample': isRecommendedDeal(deal) ? 'Yes' : 'No',
        'Scope: Finance': audit.scope.finance ? 'Yes' : 'No',
        'Scope: Insurance': audit.scope.insurance ? 'Yes' : 'No',
        'Scope: Supplementary Invoice': audit.scope.supplementaryInvoice ? 'Yes' : 'No',
        'RWA Products Sold': deal.rwaProducts.map(p => p.productName).join('; '),
        'TIS Policies Registered': deal.tisPolicies.map(p => `${p.productName} [${p.registrationStatus}, Inc: ${p.inceptionDate ? p.inceptionDate.display : 'N/A'}]`).join('; '),
        'iStoreDocs File Created': deal.fileCreatedDate ? deal.fileCreatedDate.display : '',
        'iStoreDocs File Closed': deal.fileClosedDate ? deal.fileClosedDate.display : '',
        'iStoreDocs File Status': deal.fileStatus || '',
        'ZIP Pack Uploaded': audit.zipScan ? audit.zipScan.archiveName : 'No',
        'Missing Required Docs': missingDocs.join('; '),
        'Image PDFs (Manual Review)': imagePdfs.join('; '),
        'Overall Deal Outcome': audit.outcome,
        'Failed Checks Count': failedChecks.length,
        'Failed Check IDs': failedChecks.map(c => c.id).join(', '),
        'Failed Check Descriptions': failedChecks.map(c => c.description).join(' | '),
        'Failed Reconciliations Count': failedRecons.length,
        'Failed Reconciliation Descriptions': failedRecons.map(r => r.description).join(' | '),
        'Auditor Notes / Remedial Action': audit.notes || '',
        'Audit Updated At': audit.updatedAt ? new Date(audit.updatedAt).toLocaleString('en-GB') : '',
        'Rules Version': RuntimeCache.rules ? RuntimeCache.rules.meta.version : 'Unknown'
      };
    });

    const wsDetail = detailRows.length > 0
      ? XLSX.utils.json_to_sheet(detailRows)
      : XLSX.utils.aoa_to_sheet([['No audited deals yet. Complete deal audits in Compliance Desk to populate this sheet.']]);

    // Tab 3: Hidden _SessionState (chunked to stay safely below Excel's 32,767 char per cell limit)
    const stateSnapshot = JSON.stringify(AppState);
    const CHUNK_SIZE = 28000;
    const totalChunks = Math.max(1, Math.ceil(stateSnapshot.length / CHUNK_SIZE));
    const sessionAoa = [['ChunkIndex', 'ChunkTotal', 'SchemaVersion', 'SavedAt', 'Payload']];
    for (let i = 0; i < totalChunks; i++) {
      sessionAoa.push([
        i,
        totalChunks,
        STATE_SCHEMA_VERSION,
        new Date().toISOString(),
        stateSnapshot.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      ]);
    }
    const wsSession = XLSX.utils.aoa_to_sheet(sessionAoa);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detailed Audit Log');
    XLSX.utils.book_append_sheet(wb, wsSession, '_SessionState');

    // Hide _SessionState tab in Excel
    wb.Workbook = {
      Sheets: [
        { name: 'Executive Summary', Hidden: 0 },
        { name: 'Detailed Audit Log', Hidden: 0 },
        { name: '_SessionState', Hidden: 1 }
      ]
    };

    const safeSite = siteLabel.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
    const dateStamp = getTodayIso();
    const fileName = `ComplianceDesk_Audit_${safeSite}_${dateStamp}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast(`Downloaded ${fileName} (includes hidden _SessionState for restore).`, 'success');
  }

  async function restoreSessionFromExportXlsx(file) {
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
      const sheet = wb.Sheets['_SessionState'];
      if (!sheet) {
        throw new Error('This workbook does not contain a hidden _SessionState sheet.');
      }
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows || rows.length === 0) {
        throw new Error('_SessionState sheet is empty.');
      }

      rows.sort((a, b) => Number(a.ChunkIndex) - Number(b.ChunkIndex));
      const serialized = rows.map(r => String(r.Payload || '')).join('');
      const restored = JSON.parse(serialized);
      if (!restored || !Array.isArray(restored.deals)) {
        throw new Error('Invalid session snapshot inside _SessionState.');
      }

      AppState = Object.assign(createDefaultState(), restored);
      RuntimeCache.pdfTextByDeal = {};
      RuntimeCache.expandedDocsByDeal = {};
      saveStateToLocalStorage();
      renderIngestionView();
      updateNavButtons();
      showToast(`Session restored from ${file.name}: ${AppState.deals.length} deals and ${Object.keys(AppState.audits).length} audit record(s).`, 'success');
    } catch (err) {
      console.error('Restore error:', err);
      showToast('Restore failed: ' + err.message, 'error', true);
    }
  }

  /* ================================================================== */
  /* 15. MODALS (NATIVE <dialog>) & NAVIGATION                          */
  /* ================================================================== */
  let pendingConfirmCallback = null;

  function openConfirmDialog(title, message, confirmLabel, onConfirm) {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-dialog-title').textContent = title;
    document.getElementById('confirm-dialog-message').textContent = message;
    document.getElementById('confirm-dialog-ok').textContent = confirmLabel || 'Confirm';
    pendingConfirmCallback = onConfirm;
    dialog.showModal();
  }

  function openPdfViewerDialog(fileName) {
    const dealTextMap = RuntimeCache.pdfTextByDeal[AppState.activeDealKey] || {};
    const text = dealTextMap[fileName];
    if (text === undefined) {
      showToast('Extracted PDF text is only held in active session memory. Re-upload the ZIP to inspect text.', 'info');
      return;
    }
    RuntimeCache.activePdfViewerText = text;
    document.getElementById('pdf-viewer-title').textContent = `Extracted Text: ${fileName}`;
    document.getElementById('pdf-viewer-meta').textContent = `Characters extracted: ${text.length.toLocaleString('en-GB')} (kept strictly in local browser memory)`;
    document.getElementById('pdf-text-search').value = '';
    renderPdfViewerContent('');
    document.getElementById('pdf-viewer-dialog').showModal();
  }

  function renderPdfViewerContent(keyword) {
    const codeEl = document.querySelector('#pdf-viewer-content code');
    const text = RuntimeCache.activePdfViewerText || '(No extractable text found in this PDF)';
    const q = (keyword || '').trim();
    if (!q) {
      codeEl.textContent = text;
      return;
    }
    const safeText = escapeHtml(text);
    const safeRx = new RegExp(escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    codeEl.innerHTML = safeText.replace(safeRx, match => `<mark style="background:#fde047; color:#111;">${match}</mark>`);
  }

  function updateNavButtons() {
    const wsBtn = document.getElementById('nav-workspace-btn');
    wsBtn.disabled = !AppState.activeDealKey || !AppState.deals.some(d => d.dealKey === AppState.activeDealKey);

    document.querySelectorAll('.primary-nav .nav-btn').forEach(btn => {
      if (btn.dataset.view === RuntimeCache.currentView) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });
  }

  function switchView(viewName) {
    const viewMap = {
      ingestion: { elId: 'view-ingestion', headingId: 'v1-heading', title: 'Data Ingestion | Compliance Desk' },
      queue: { elId: 'view-queue', headingId: 'v2-heading', title: 'Executive Queue | Compliance Desk' },
      workspace: { elId: 'view-workspace', headingId: 'v3-heading', title: 'Deal Audit Workspace | Compliance Desk' },
      export: { elId: 'view-export', headingId: 'v4-heading', title: 'Review & Export | Compliance Desk' }
    };

    if (!viewMap[viewName]) return;
    RuntimeCache.currentView = viewName;

    for (const [key, cfg] of Object.entries(viewMap)) {
      document.getElementById(cfg.elId).hidden = key !== viewName;
    }

    document.title = viewMap[viewName].title;
    updateNavButtons();

    if (viewName === 'ingestion') renderIngestionView();
    else if (viewName === 'queue') renderQueueView();
    else if (viewName === 'workspace') renderWorkspace();
    else if (viewName === 'export') renderExportView();

    window.scrollTo({ top: 0, behavior: 'instant' });
    const heading = document.getElementById(viewMap[viewName].headingId);
    if (heading) heading.focus();
  }

  /* ================================================================== */
  /* 16. REPORT UPLOAD HANDLERS                                         */
  /* ================================================================== */
  async function handleReportFile(reportType, file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      showToast('SheetJS (xlsx) library failed to load from CDN.', 'error', true);
      return;
    }
    try {
      const { rows, headers } = await readSpreadsheetFile(file);
      if (rows.length === 0) {
        throw new Error('The uploaded spreadsheet has no data rows.');
      }

      let parsed;
      if (reportType === 'istoredocs') {
        parsed = parseIStoreDocsRows(rows, headers);
        AppState.rawData.istoredocs = parsed.records;
      } else if (reportType === 'rwa') {
        parsed = parseRwaRows(rows, headers);
        AppState.rawData.rwa = parsed.records;
      } else if (reportType === 'tis') {
        parsed = parseTisRows(rows, headers);
        AppState.rawData.tis = parsed.records;
      }

      const matchedCols = Object.entries(parsed.cols)
        .filter(([, colName]) => Boolean(colName))
        .map(([field, colName]) => `${field}: ${colName}`);

      if (parsed.wideProductCols && parsed.wideProductCols.length > 0) {
        matchedCols.push(`wideProducts(${parsed.wideProductCols.length})`);
      }

      AppState.reportsMeta[reportType] = {
        fileName: file.name,
        rowCount: parsed.records.length,
        loadedAt: new Date().toISOString(),
        matchedCols
      };

      rebuildJoinedDeals();
      saveStateToLocalStorage();
      renderIngestionView();
      updateNavButtons();

      const labelMap = { istoredocs: 'iStoreDocs', rwa: 'RWA', tis: 'TIS' };
      showToast(`Ingested ${labelMap[reportType]} report (${parsed.records.length} record(s) normalized).`, 'success');
    } catch (err) {
      console.error(`Report upload failed (${reportType}):`, err);
      showToast(`Failed to import ${reportType.toUpperCase()} report: ${err.message}`, 'error', true);
    }
  }

  /* ================================================================== */
  /* 17. EVENT WIRING & INITIALIZATION                                  */
  /* ================================================================== */
  function wireDragAndDrop(zoneEl, onFile) {
    zoneEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      zoneEl.classList.add('is-dragover');
    });
    zoneEl.addEventListener('dragleave', () => {
      zoneEl.classList.remove('is-dragover');
    });
    zoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      zoneEl.classList.remove('is-dragover');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) onFile(file);
    });
  }

  function setupDialogLightDismissFallback() {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const isOutside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => { pressedOutside = isOutside(e, dialog); });
        dialog.addEventListener('pointerup', (e) => {
          if (pressedOutside && isOutside(e, dialog)) dialog.close();
        });
      }
    }
  }

  function initEventListeners() {
    // Primary Navigation
    document.querySelector('.primary-nav').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn || btn.disabled) return;
      switchView(btn.dataset.view);
    });

    // Generic view jump buttons
    document.addEventListener('click', (e) => {
      const gotoBtn = e.target.closest('button[data-goto]');
      if (gotoBtn) {
        switchView(gotoBtn.dataset.goto);
      }
    });

    // Fallback & manual documents.json loading
    const rulesFileInput = document.getElementById('rules-file-input');
    document.getElementById('btn-load-rules-fallback').addEventListener('click', () => rulesFileInput.click());
    rulesFileInput.addEventListener('change', (e) => {
      handleRulesFileUpload(e.target.files[0]);
      e.target.value = '';
    });

    const rulesReloadInput = document.getElementById('rules-reload-input');
    document.getElementById('btn-reload-rules-manual').addEventListener('click', () => rulesReloadInput.click());
    rulesReloadInput.addEventListener('change', (e) => {
      handleRulesFileUpload(e.target.files[0]);
      e.target.value = '';
    });

    // View 1: Report Upload Buttons & Dropzones
    document.querySelectorAll('button[data-browse]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.browse);
        if (input) input.click();
      });
    });

    ['istoredocs', 'rwa', 'tis'].forEach(type => {
      const input = document.getElementById(`file-${type}`);
      const dz = document.getElementById(`dz-${type}`);
      input.addEventListener('change', (e) => {
        handleReportFile(type, e.target.files[0]);
        e.target.value = '';
      });
      wireDragAndDrop(dz, (file) => handleReportFile(type, file));
    });

    // View 1: Proceed to Queue
    document.getElementById('btn-goto-queue').addEventListener('click', () => switchView('queue'));

    // View 1: Restore from Export (.xlsx)
    const restoreInput = document.getElementById('restore-xlsx-input');
    document.getElementById('btn-restore-xlsx').addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', (e) => {
      restoreSessionFromExportXlsx(e.target.files[0]);
      e.target.value = '';
    });

    // View 1: Reset Controls with Confirmation Modals
    document.getElementById('btn-clear-site-audit').addEventListener('click', () => {
      const site = AppState.selectedSite;
      const targetLabel = site ? `site "${site}"` : 'all sites';
      openConfirmDialog(
        'Clear Current Site/Audit (Keep Master Data)',
        `This will clear all audit outcomes, check statuses, reconciliation states, ZIP scan summaries, and auditor notes for ${targetLabel}. Your uploaded iStoreDocs, RWA, and TIS master reports will be preserved.`,
        'Clear Audit Progress',
        () => {
          if (site) {
            const siteKeys = new Set(AppState.deals.filter(d => d.site === site).map(d => d.dealKey));
            for (const key of siteKeys) {
              delete AppState.audits[key];
              delete RuntimeCache.pdfTextByDeal[key];
            }
            if (AppState.activeDealKey && siteKeys.has(AppState.activeDealKey)) {
              AppState.activeDealKey = null;
            }
          } else {
            AppState.audits = {};
            AppState.activeDealKey = null;
            RuntimeCache.pdfTextByDeal = {};
          }
          saveStateToLocalStorage();
          renderIngestionView();
          updateNavButtons();
          showToast(`Cleared audit progress for ${targetLabel} (master data kept).`, 'info');
        }
      );
    });

    document.getElementById('btn-clear-all').addEventListener('click', () => {
      openConfirmDialog(
        'Clear All Stored Data (Full Reset)',
        'This will permanently remove all uploaded master spreadsheets (iStoreDocs, RWA, TIS), all audit progress, notes, and local browser storage data. Have you exported your Excel workbook first?',
        'Full Reset',
        () => {
          AppState = createDefaultState();
          RuntimeCache.pdfTextByDeal = {};
          RuntimeCache.expandedDocsByDeal = {};
          try { localStorage.removeItem(STORAGE_KEY); } catch (err) { console.error(err); }
          updateAutoSaveIndicators('Local storage cleared');
          renderIngestionView();
          updateNavButtons();
          showToast('All stored master data and audit progress have been cleared.', 'warning');
        }
      );
    });

    // Confirm Dialog close hook (always reset returnValue per modern-web-guidance)
    const confirmDialog = document.getElementById('confirm-dialog');
    confirmDialog.addEventListener('close', () => {
      const choice = confirmDialog.returnValue;
      confirmDialog.returnValue = '';
      const cb = pendingConfirmCallback;
      pendingConfirmCallback = null;
      if (choice === 'confirm' && typeof cb === 'function') {
        cb();
      }
    });

    // PDF Viewer Search
    document.getElementById('pdf-text-search').addEventListener('input', (e) => {
      renderPdfViewerContent(e.target.value);
    });

    // View 2: Navigation & Filters
    document.getElementById('btn-v2-back-ingest').addEventListener('click', () => switchView('ingestion'));
    document.getElementById('btn-v2-export').addEventListener('click', () => switchView('export'));

    document.getElementById('site-select').addEventListener('change', (e) => {
      AppState.selectedSite = e.target.value;
      const execs = getExecutivesForSite(AppState.selectedSite);
      AppState.selectedExecutive = execs[0] || '';
      RuntimeCache.queueMonth = 'all';
      saveStateToLocalStorage();
      renderQueueView();
    });

    document.getElementById('exec-search').addEventListener('input', (e) => {
      RuntimeCache.execSearch = e.target.value;
      renderQueueView();
    });

    document.getElementById('exec-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-exec]');
      if (!btn) return;
      AppState.selectedExecutive = btn.dataset.exec;
      RuntimeCache.queueMonth = 'all';
      saveStateToLocalStorage();
      renderQueueView();
    });

    document.getElementById('deal-search-input').addEventListener('input', (e) => {
      RuntimeCache.queueSearch = e.target.value;
      renderExecutiveDealsTable();
    });

    document.getElementById('deal-month-filter').addEventListener('change', (e) => {
      RuntimeCache.queueMonth = e.target.value;
      renderExecutiveDealsTable();
    });

    document.getElementById('deal-tier-filter').addEventListener('change', (e) => {
      RuntimeCache.queueTier = e.target.value;
      renderExecutiveDealsTable();
    });

    document.getElementById('queue-filter-pills').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-qfilter]');
      if (!btn) return;
      RuntimeCache.queueQuickFilter = btn.dataset.qfilter;
      renderExecutiveDealsTable();
    });

    document.querySelector('#deals-table thead').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-sort]');
      if (!btn) return;
      const field = btn.dataset.sort;
      if (RuntimeCache.queueSort.field === field) {
        RuntimeCache.queueSort.dir = RuntimeCache.queueSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        RuntimeCache.queueSort.field = field;
        RuntimeCache.queueSort.dir = field === 'deliveryDate' ? 'desc' : 'asc';
      }
      renderExecutiveDealsTable();
    });

    document.getElementById('deals-table-body').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-audit-deal]');
      if (btn) {
        openDealWorkspace(btn.dataset.auditDeal);
        return;
      }
      const row = e.target.closest('tr[data-open-deal]');
      if (row) {
        openDealWorkspace(row.dataset.openDeal);
      }
    });

    // View 3: Workspace Controls
    const returnToQueue = () => {
      saveStateToLocalStorage();
      switchView('queue');
    };
    document.getElementById('btn-back-to-queue').addEventListener('click', returnToQueue);
    document.getElementById('btn-save-return-top').addEventListener('click', () => {
      saveStateToLocalStorage();
      showToast('Deal audit saved locally.', 'success');
      switchView('queue');
    });
    document.getElementById('btn-back-queue-bottom').addEventListener('click', returnToQueue);
    document.getElementById('btn-save-return-bottom').addEventListener('click', () => {
      saveStateToLocalStorage();
      showToast('Deal audit saved locally.', 'success');
      switchView('queue');
    });

    // Dynamic Scope Bar Toggles
    document.getElementById('ws-scope-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-scope-toggle]');
      if (!btn) return;
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      const key = btn.dataset.scopeToggle;
      audit.scope[key] = !audit.scope[key];
      audit.scopeManual = true;
      audit.updatedAt = new Date().toISOString();
      applyAutoPreCheckDefaults(deal, audit, false);
      saveStateToLocalStorage();
      renderWorkspace();
    });

    document.getElementById('btn-reset-scope-auto').addEventListener('click', () => {
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      audit.scope = getDefaultScopeForDeal(deal);
      audit.scopeManual = false;
      audit.updatedAt = new Date().toISOString();
      applyAutoPreCheckDefaults(deal, audit, false);
      saveStateToLocalStorage();
      renderWorkspace();
      showToast('Scope reset to auto-detected values from iStoreDocs / RWA / TIS.', 'info');
    });

    // Transaction ZIP Upload & Re-run Pre-checks
    const zipInput = document.getElementById('ws-zip-input');
    document.getElementById('btn-browse-zip').addEventListener('click', () => zipInput.click());
    zipInput.addEventListener('change', (e) => {
      processDealArchiveUpload(e.target.files[0]);
      e.target.value = '';
    });
    wireDragAndDrop(document.getElementById('ws-zip-dropzone'), (file) => processDealArchiveUpload(file));

    document.getElementById('btn-rerun-prechecks').addEventListener('click', () => {
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      applyAutoPreCheckDefaults(deal, audit, true);
      audit.updatedAt = new Date().toISOString();
      saveStateToLocalStorage();
      renderWorkspace();
      showToast('Automated pre-checks refreshed.', 'info');
    });

    document.getElementById('btn-clear-zip').addEventListener('click', () => {
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      audit.zipScan = null;
      delete RuntimeCache.pdfTextByDeal[deal.dealKey];
      audit.updatedAt = new Date().toISOString();
      saveStateToLocalStorage();
      renderWorkspace();
      showToast('ZIP scan cleared for this deal.', 'info');
    });

    // PDF Reassign & Inspect Text in Inventory
    document.getElementById('ws-zip-inventory').addEventListener('change', (e) => {
      const sel = e.target.closest('select[data-pdf-reassign]');
      if (!sel) return;
      const idx = Number(sel.dataset.pdfReassign);
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      if (audit.zipScan && audit.zipScan.files[idx]) {
        audit.zipScan.files[idx].matchedDocId = sel.value || null;
        audit.updatedAt = new Date().toISOString();
        saveStateToLocalStorage();
        renderWorkspace();
      }
    });

    document.getElementById('ws-zip-inventory').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view-pdf]');
      if (btn) openPdfViewerDialog(btn.dataset.viewPdf);
    });

    // Document Checklist Expand/Collapse & Check Toggles & Inspect PDF
    document.getElementById('btn-expand-all-docs').addEventListener('click', () => {
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      const set = new Set(getInScopeDocuments(audit.scope).map(d => d.id));
      RuntimeCache.expandedDocsByDeal[deal.dealKey] = set;
      renderWorkspace();
    });

    document.getElementById('btn-collapse-all-docs').addEventListener('click', () => {
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      RuntimeCache.expandedDocsByDeal[deal.dealKey] = new Set();
      renderWorkspace();
    });

    document.getElementById('ws-doc-checklist').addEventListener('click', (e) => {
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;

      const toggleBtn = e.target.closest('button[data-toggle-doc]');
      if (toggleBtn) {
        const docId = toggleBtn.dataset.toggleDoc;
        if (!RuntimeCache.expandedDocsByDeal[deal.dealKey]) {
          RuntimeCache.expandedDocsByDeal[deal.dealKey] = new Set();
        }
        const set = RuntimeCache.expandedDocsByDeal[deal.dealKey];
        if (set.has(docId)) set.delete(docId);
        else set.add(docId);
        renderWorkspace();
        return;
      }

      const pdfBtn = e.target.closest('button[data-view-pdf]');
      if (pdfBtn) {
        openPdfViewerDialog(pdfBtn.dataset.viewPdf);
        return;
      }

      const checkBtn = e.target.closest('button[data-check-id]');
      if (checkBtn) {
        const audit = ensureAuditRecord(deal);
        const checkId = checkBtn.dataset.checkId;
        const val = checkBtn.dataset.val;
        const current = audit.checks[checkId] && audit.checks[checkId].state;
        if (current === val) {
          delete audit.checks[checkId];
        } else {
          audit.checks[checkId] = { state: val, source: 'manual' };
        }
        audit.updatedAt = new Date().toISOString();
        saveStateToLocalStorage();
        renderWorkspace();
      }
    });

    // Reconciliations Toggles
    document.getElementById('ws-recon-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-recon-id]');
      if (!btn) return;
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      const reconId = btn.dataset.reconId;
      const val = btn.dataset.val;
      const current = audit.reconciliations[reconId] && audit.reconciliations[reconId].state;
      if (current === val) {
        delete audit.reconciliations[reconId];
      } else {
        audit.reconciliations[reconId] = { state: val, source: 'manual' };
      }
      audit.updatedAt = new Date().toISOString();
      saveStateToLocalStorage();
      renderWorkspace();
    });

    // Outcome Selector & Auditor Notes Auto-Save
    document.getElementById('ws-outcome-select').addEventListener('change', (e) => {
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      audit.outcome = e.target.value;
      audit.updatedAt = new Date().toISOString();
      updateOutcomePreviewBadge(audit.outcome);
      saveStateToLocalStorage();
    });

    document.getElementById('ws-notes-textarea').addEventListener('input', (e) => {
      const deal = AppState.deals.find(d => d.dealKey === AppState.activeDealKey);
      if (!deal) return;
      const audit = ensureAuditRecord(deal);
      audit.notes = e.target.value;
      audit.updatedAt = new Date().toISOString();
      saveStateToLocalStorage();
    });

    // View 4: Export Controls
    document.getElementById('btn-export-back-queue').addEventListener('click', () => switchView('queue'));
    document.getElementById('btn-download-excel').addEventListener('click', exportAuditWorkbook);
    document.getElementById('export-site-filter').addEventListener('change', (e) => {
      RuntimeCache.exportSiteFilter = e.target.value;
      renderExportView();
    });
    document.getElementById('export-deals-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-audit-deal]');
      if (btn) openDealWorkspace(btn.dataset.auditDeal);
    });
  }

  /* ================================================================== */
  /* 18. BOOTSTRAP ON DOMContentLoaded                                  */
  /* ================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    setupDialogLightDismissFallback();
    initEventListeners();

    const restored = loadStateFromLocalStorage();
    if (restored && AppState.deals.length > 0) {
      updateAutoSaveIndicators(
        AppState.lastSavedAt
          ? 'Session restored (' + new Date(AppState.lastSavedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ')'
          : 'Session restored'
      );
      showToast(`Restored local session with ${AppState.deals.length} deal(s).`, 'info');
    }

    renderIngestionView();
    updateNavButtons();
    fetchRulesFile();
  });
})();
