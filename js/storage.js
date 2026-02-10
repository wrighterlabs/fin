/**
 * Local storage abstraction. All keys and get/set for rules, history, theme, timestamps.
 * No DOM access.
 */

const KEYS = {
  RULES: 'currency-notifier-rules',
  HISTORY: 'currency-notifier-history',
  THEME: 'currency-notifier-theme',
  LAST_ECB_FETCH: 'currency-notifier-last-ecb-fetch',
  LAST_SCHEDULER_CHECK: 'currency-notifier-last-scheduler-check',
};

function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('storage set failed', key, e);
  }
}

export function getRules() {
  const rules = get(KEYS.RULES);
  return Array.isArray(rules) ? rules : [];
}

export function setRules(rules) {
  set(KEYS.RULES, rules);
}

export function getHistory() {
  const history = get(KEYS.HISTORY);
  return Array.isArray(history) ? history : [];
}

export function appendHistory(entry) {
  const history = getHistory();
  history.push({ ...entry, id: entry.id || String(Date.now()) });
  set(KEYS.HISTORY, history);
}

export function getTheme() {
  const theme = get(KEYS.THEME);
  return theme === 'dark' || theme === 'light' ? theme : 'light';
}

export function setTheme(theme) {
  set(KEYS.THEME, theme);
}

export function getLastECBFetchTime() {
  return get(KEYS.LAST_ECB_FETCH, null);
}

export function setLastECBFetchTime(time) {
  set(KEYS.LAST_ECB_FETCH, time);
}

export function getLastSchedulerCheck() {
  return get(KEYS.LAST_SCHEDULER_CHECK, null);
}

export function setLastSchedulerCheck(time) {
  set(KEYS.LAST_SCHEDULER_CHECK, time);
}
