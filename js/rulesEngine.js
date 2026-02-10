/**
 * Rule engine: evaluate rule against current rate, return whether to notify and message.
 * Better = rate went up (more units of currencyTo per currencyFrom).
 * Worse = rate went down.
 */

/**
 * @typedef {Object} Rule
 * @property {string} id
 * @property {string} currencyFrom
 * @property {string} currencyTo
 * @property {number} [lastExchangeRate]
 * @property {number} [thresholdPercent]
 * @property {boolean} [notifyIfBetter]
 * @property {boolean} [notifyIfWorse]
 */

/**
 * @typedef {Object} EvaluateResult
 * @property {boolean} shouldNotify
 * @property {'better'|'worse'|null} kind
 * @property {string} [message]
 * @property {number} [delta]
 * @property {number} [percent]
 * @property {number} [rate]
 */

/**
 * Evaluate a rule against the current exchange rate.
 * @param {Rule} rule
 * @param {number} currentRate
 * @returns {EvaluateResult}
 */
export function evaluateRule(rule, currentRate) {
  const last = rule.lastExchangeRate;
  const notifyIfBetter = rule.notifyIfBetter !== false;
  const notifyIfWorse = rule.notifyIfWorse !== false;
  const thresholdPercent = rule.thresholdPercent != null ? Number(rule.thresholdPercent) : null;
  const pair = `${rule.currencyFrom} → ${rule.currencyTo}`;

  if (last == null || typeof last !== 'number' || !Number.isFinite(last)) {
    return { shouldNotify: false, kind: null, rate: currentRate };
  }

  const delta = currentRate - last;
  const percent = last === 0 ? 0 : (delta / last) * 100;
  const rateWentUp = delta > 0;
  const rateWentDown = delta < 0;

  const overThreshold =
    thresholdPercent == null ||
    !Number.isFinite(thresholdPercent) ||
    Math.abs(percent) >= thresholdPercent;

  if (rateWentUp && notifyIfBetter && overThreshold) {
    const message = `${pair} is now ${formatRate(currentRate)} (was ${formatRate(last)}). Good time to exchange 💱`;
    return { shouldNotify: true, kind: 'better', message, delta, percent, rate: currentRate };
  }

  if (rateWentDown && notifyIfWorse && overThreshold) {
    const message = `${pair} dropped to ${formatRate(currentRate)} (last ${formatRate(last)})`;
    return { shouldNotify: true, kind: 'worse', message, delta, percent, rate: currentRate };
  }

  return { shouldNotify: false, kind: null, delta, percent, rate: currentRate };
}

function formatRate(rate) {
  if (rate == null || !Number.isFinite(rate)) return '—';
  if (Math.abs(rate) >= 1000 || (rate !== 0 && Math.abs(rate) < 0.01)) {
    return rate.toExponential(2);
  }
  return rate.toFixed(2);
}

/**
 * Compute next scheduled run for a rule (for display).
 * @param {{ frequency: string, timeOfDay: string, dayOfWeek?: number }} rule
 * @returns {string} human-readable next run, e.g. "Mon 09:00" or "Daily 09:00"
 */
export function getNextRunPreview(rule) {
  const time = rule.timeOfDay || '09:00';
  if (rule.frequency === 'weekly' && rule.dayOfWeek != null) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[Number(rule.dayOfWeek)] || '?';
    return `${day} ${time}`;
  }
  return `Daily ${time}`;
}
