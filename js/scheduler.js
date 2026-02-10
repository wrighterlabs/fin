/**
 * Scheduler: every 60s check enabled rules; if time matches, fetch rate, evaluate, notify, log history.
 */

import { getRules, setRules, appendHistory, setLastSchedulerCheck } from './storage.js';
import { getExchangeRate, ensureRates } from './exchangeApi.js';
import { evaluateRule } from './rulesEngine.js';
import { sendNotification } from './notifications.js';

/** @type {number|null} */
let intervalId = null;

/**
 * Check if current time matches rule schedule (timeOfDay, and dayOfWeek if weekly).
 * @param {{ frequency: string, timeOfDay: string, dayOfWeek?: number }} rule
 * @returns {boolean}
 */
function timeMatches(rule) {
  const now = new Date();
  const [h, m] = (rule.timeOfDay || '09:00').split(':').map(Number);
  if (now.getHours() !== h || now.getMinutes() !== m) return false;
  if (rule.frequency === 'weekly') {
    const day = rule.dayOfWeek != null ? Number(rule.dayOfWeek) : 0;
    if (now.getDay() !== day) return false;
  }
  return true;
}

/**
 * Run one tick: for each enabled rule that matches current time, fetch rate, evaluate, notify, persist.
 */
async function tick() {
  const rules = getRules();
  const enabled = rules.filter((r) => r.enabled !== false);
  if (enabled.length === 0) {
    setLastSchedulerCheck(Date.now());
    return;
  }

  const toCheck = enabled.filter(timeMatches);
  if (toCheck.length === 0) {
    setLastSchedulerCheck(Date.now());
    return;
  }

  await ensureRates();

  const updated = [...rules];
  let changed = false;

  for (const rule of toCheck) {
    const rate = getExchangeRate(rule.currencyFrom, rule.currencyTo);
    if (rate == null) continue;

    const result = evaluateRule(rule, rate);
    if (!result.shouldNotify || !result.message) {
      const idx = updated.findIndex((r) => r.id === rule.id);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], lastExchangeRate: rate };
        changed = true;
      }
      continue;
    }

    sendNotification('Exchange rate alert', result.message);
    appendHistory({
      date: new Date().toISOString(),
      pair: `${rule.currencyFrom} → ${rule.currencyTo}`,
      rate: result.rate,
      delta: result.delta,
      percent: result.percent,
      message: result.message,
    });

    const idx = updated.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], lastExchangeRate: rate };
      changed = true;
    }
  }

  if (changed) setRules(updated);
  setLastSchedulerCheck(Date.now());
}

/**
 * Start the scheduler (runs every 60 seconds).
 */
export function start() {
  if (intervalId != null) return;
  tick();
  intervalId = window.setInterval(tick, 60 * 1000);
}

/**
 * Stop the scheduler.
 */
export function stop() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
