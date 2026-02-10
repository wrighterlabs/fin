/**
 * App entry: init theme, SW, dashboard; event handlers; render rules, modal, settings.
 */

import { getRules, setRules, getHistory, getTheme, setTheme, getLastSchedulerCheck } from './storage.js';
import { ensureRates, getCurrencyCodes, getLastFetchTime } from './exchangeApi.js';
import { getNextRunPreview } from './rulesEngine.js';
import { requestPermission, sendTestNotification } from './notifications.js';
import { start as startScheduler } from './scheduler.js';

// --- DOM refs ---
const dashboard = document.getElementById('dashboard');
const rulesList = document.getElementById('rules-list');
const emptyState = document.getElementById('empty-state');
const lastCheckedEl = document.getElementById('last-checked');
const lastEcbEl = document.getElementById('last-ecb');
const fabAdd = document.getElementById('fab-add');
const btnAddFirst = document.getElementById('btn-add-first');
const btnSettings = document.getElementById('btn-settings');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const ruleForm = document.getElementById('rule-form');
const currencyFrom = document.getElementById('currency-from');
const currencyTo = document.getElementById('currency-to');
const frequency = document.getElementById('frequency');
const formGroupDay = document.getElementById('form-group-day');
const dayOfWeek = document.getElementById('day-of-week');
const timeOfDay = document.getElementById('time-of-day');
const thresholdPercent = document.getElementById('threshold-percent');
const notifyBetter = document.getElementById('notify-better');
const notifyWorse = document.getElementById('notify-worse');
const ruleEnabled = document.getElementById('rule-enabled');
const settingsPanel = document.getElementById('settings-panel');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsClose = document.getElementById('settings-close');
const themeToggle = document.getElementById('theme-toggle');
const btnTestNotification = document.getElementById('btn-test-notification');
const btnExportRules = document.getElementById('btn-export-rules');
const btnExportHistoryCsv = document.getElementById('btn-export-history-csv');
const btnExportHistoryMd = document.getElementById('btn-export-history-md');
const settingsEcbTime = document.getElementById('settings-ecb-time');

/** Current rule id when editing (null = add mode) */
let editingRuleId = null;

// --- Theme ---
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle?.setAttribute('aria-pressed', theme === 'dark');
}

function initTheme() {
  const theme = getTheme();
  applyTheme(theme);
}

// --- Format timestamps ---
function formatTime(ts) {
  if (ts == null) return '—';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

// --- Currency dropdowns ---
function fillCurrencySelect(select) {
  const codes = getCurrencyCodes();
  select.innerHTML = codes.map((c) => `<option value="${c}">${c}</option>`).join('');
}

async function ensureCurrencies() {
  await ensureRates();
  fillCurrencySelect(currencyFrom);
  fillCurrencySelect(currencyTo);
}

// --- Dashboard render ---
function renderRules() {
  const rules = getRules();
  const lastCheck = getLastSchedulerCheck();
  const lastEcb = getLastFetchTime();

  lastCheckedEl.textContent = `Last checked: ${formatTime(lastCheck)}`;
  lastEcbEl.textContent = `Last ECB fetch: ${formatTime(lastEcb)}`;
  if (settingsEcbTime) settingsEcbTime.textContent = `Last ECB fetch: ${formatTime(lastEcb)}`;

  if (rules.length === 0) {
    rulesList.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  rulesList.classList.remove('hidden');
  rulesList.innerHTML = rules.map((rule) => {
    const nextRun = getNextRunPreview(rule);
    const pair = `${rule.currencyFrom} → ${rule.currencyTo}`;
    const enabled = rule.enabled !== false;
    return `
      <li class="card rule-card ${enabled ? '' : 'disabled'}" data-rule-id="${rule.id}">
        <div class="rule-card-main">
          <div class="rule-card-pair">${pair}</div>
          <div class="rule-card-meta">Next: ${nextRun}${rule.lastExchangeRate != null ? ` · Last rate: ${Number(rule.lastExchangeRate).toFixed(4)}` : ''}</div>
        </div>
        <div class="rule-card-actions">
          <button type="button" class="toggle rule-toggle" role="switch" aria-pressed="${enabled}" aria-label="Toggle rule"> </button>
          <button type="button" class="btn-icon rule-edit" aria-label="Edit rule">✎</button>
          <button type="button" class="btn-icon rule-delete" aria-label="Delete rule">🗑</button>
        </div>
      </li>`;
  }).join('');
}

// --- Modal ---
function openModal(rule = null) {
  editingRuleId = rule ? rule.id : null;
  modalTitle.textContent = rule ? 'Edit Rule' : 'Add Rule';
  ensureCurrencies();

  if (rule) {
    currencyFrom.value = rule.currencyFrom || 'EUR';
    currencyTo.value = rule.currencyTo || 'USD';
    frequency.value = rule.frequency || 'daily';
    dayOfWeek.value = String(rule.dayOfWeek ?? 1);
    timeOfDay.value = rule.timeOfDay || '09:00';
    thresholdPercent.value = rule.thresholdPercent != null ? rule.thresholdPercent : '';
    notifyBetter.setAttribute('aria-pressed', rule.notifyIfBetter !== false);
    notifyWorse.setAttribute('aria-pressed', rule.notifyIfWorse !== false);
    ruleEnabled.setAttribute('aria-pressed', rule.enabled !== false);
  } else {
    currencyFrom.value = 'EUR';
    currencyTo.value = 'USD';
    frequency.value = 'daily';
    dayOfWeek.value = '1';
    timeOfDay.value = '09:00';
    thresholdPercent.value = '';
    notifyBetter.setAttribute('aria-pressed', 'true');
    notifyWorse.setAttribute('aria-pressed', 'true');
    ruleEnabled.setAttribute('aria-pressed', 'true');
  }

  formGroupDay.classList.toggle('visible', frequency.value === 'weekly');
  modalOverlay.classList.add('is-open');
  modalOverlay.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modalOverlay.classList.remove('is-open');
  modalOverlay.setAttribute('aria-hidden', 'true');
  editingRuleId = null;
}

function getToggleState(btn) {
  return btn.getAttribute('aria-pressed') === 'true';
}

function saveRuleFromForm() {
  const rules = getRules();
  const threshold = thresholdPercent.value.trim();
  const payload = {
    currencyFrom: currencyFrom.value,
    currencyTo: currencyTo.value,
    frequency: frequency.value,
    timeOfDay: timeOfDay.value,
    dayOfWeek: frequency.value === 'weekly' ? Number(dayOfWeek.value) : undefined,
    thresholdPercent: threshold === '' ? undefined : parseFloat(threshold, 10),
    notifyIfBetter: getToggleState(notifyBetter),
    notifyIfWorse: getToggleState(notifyWorse),
    enabled: getToggleState(ruleEnabled),
  };

  if (editingRuleId) {
    const idx = rules.findIndex((r) => r.id === editingRuleId);
    if (idx >= 0) {
      const existing = rules[idx];
      rules[idx] = { ...existing, ...payload, id: existing.id, lastExchangeRate: existing.lastExchangeRate };
      setRules(rules);
    }
  } else {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rule-${Date.now()}`;
    setRules([...rules, { ...payload, id }]);
  }
  closeModal();
  renderRules();
}

// --- Toggle buttons (form and card) ---
function setupToggles() {
  [notifyBetter, notifyWorse, ruleEnabled].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = !(btn.getAttribute('aria-pressed') === 'true');
      btn.setAttribute('aria-pressed', next);
    });
  });

  frequency.addEventListener('change', () => {
    formGroupDay.classList.toggle('visible', frequency.value === 'weekly');
  });
}

// --- Export ---
function exportRulesCsv() {
  const rules = getRules();
  const headers = ['id', 'currencyFrom', 'currencyTo', 'frequency', 'timeOfDay', 'dayOfWeek', 'lastExchangeRate', 'thresholdPercent', 'notifyIfBetter', 'notifyIfWorse', 'enabled'];
  const rows = [headers.join(',')].concat(
    rules.map((r) =>
      headers.map((h) => {
        const v = r[h];
        if (v === undefined || v === null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    )
  );
  downloadBlob(rows.join('\n'), 'rules.csv', 'text/csv;charset=utf-8');
}

function exportHistoryCsv() {
  const history = getHistory();
  const headers = ['id', 'date', 'pair', 'rate', 'delta', 'percent', 'message'];
  const rows = [headers.join(',')].concat(
    history.map((e) =>
      headers.map((h) => {
        const v = e[h];
        if (v === undefined || v === null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    )
  );
  downloadBlob('\uFEFF' + rows.join('\n'), 'history.csv', 'text/csv;charset=utf-8');
}

function exportHistoryMarkdown() {
  const history = getHistory();
  const lines = ['# Notification History', '', '| Date | Pair | Rate | Delta | % | Message |', '| --- | --- | --- | --- | --- | --- |'];
  history.slice().reverse().forEach((e) => {
    const date = e.date ? new Date(e.date).toLocaleString() : '—';
    const rate = e.rate != null ? Number(e.rate).toFixed(4) : '—';
    const delta = e.delta != null ? Number(e.delta).toFixed(4) : '—';
    const pct = e.percent != null ? Number(e.percent).toFixed(2) + '%' : '—';
    const msg = (e.message || '—').replace(/\|/g, '\\|');
    lines.push(`| ${date} | ${e.pair || '—'} | ${rate} | ${delta} | ${pct} | ${msg} |`);
  });
  downloadBlob(lines.join('\n'), 'history.md', 'text/markdown;charset=utf-8');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Event delegation ---
function setupDelegation() {
  dashboard.addEventListener('click', (e) => {
    const card = e.target.closest('.rule-card');
    if (!card) return;
    const id = card.getAttribute('data-rule-id');
    const rules = getRules();
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;

    if (e.target.closest('.rule-toggle')) {
      rule.enabled = !(rule.enabled !== false);
      setRules(rules.map((r) => (r.id === id ? { ...r, enabled: rule.enabled } : r)));
      renderRules();
    } else if (e.target.closest('.rule-edit')) {
      openModal(rule);
    } else if (e.target.closest('.rule-delete')) {
      if (confirm('Delete this rule?')) {
        setRules(rules.filter((r) => r.id !== id));
        renderRules();
      }
    }
  });
}

// --- Service worker ---
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// --- Init ---
function init() {
  initTheme();
  registerSW();
  setupToggles();
  setupDelegation();

  fabAdd.addEventListener('click', () => openModal());
  btnAddFirst?.addEventListener('click', () => openModal());

  function openSettings() {
    settingsPanel.classList.add('is-open');
    settingsBackdrop.classList.remove('hidden');
    settingsBackdrop.classList.add('is-visible');
  }
  function closeSettings() {
    settingsPanel.classList.remove('is-open');
    settingsBackdrop.classList.remove('is-visible');
    settingsBackdrop.classList.add('hidden');
  }
  btnSettings.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', closeSettings);

  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  ruleForm.addEventListener('submit', (e) => { e.preventDefault(); saveRuleFromForm(); });

  themeToggle.addEventListener('click', () => {
    const next = getTheme() === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  });

  btnTestNotification.addEventListener('click', async () => {
    const perm = await requestPermission();
    if (perm === 'granted') sendTestNotification();
    else alert('Notification permission denied.');
  });

  btnExportRules.addEventListener('click', exportRulesCsv);
  btnExportHistoryCsv.addEventListener('click', exportHistoryCsv);
  btnExportHistoryMd.addEventListener('click', exportHistoryMarkdown);

  ensureCurrencies().then(() => renderRules());
  startScheduler();
  renderRules();
}

init();
