/**
 * ECB exchange rates: fetch XML, parse, expose getExchangeRate(from, to).
 * Uses EUR as pivot. Caches in memory and persists last fetch time via storage.
 */

import { getLastECBFetchTime, setLastECBFetchTime } from './storage.js';

const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
// ECB does not send CORS headers; use a proxy that returns the raw XML.
const ECB_FETCH_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(ECB_URL);

/** @type {Record<string, number>} currency code -> rate vs EUR (EUR = 1) */
let ratesByCurrency = {};
/** @type {string[]} */
let currencyCodes = ['EUR'];

/**
 * Parse ECB XML and return map of currency -> rate vs EUR.
 * @param {string} xml
 * @returns {{ rates: Record<string, number>, currencies: string[] }}
 */
function parseECBXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const rates = { EUR: 1 };
  const currencies = ['EUR'];
  const cubes = doc.querySelectorAll('Cube[currency][rate]');
  cubes.forEach((cube) => {
    const currency = cube.getAttribute('currency');
    const rate = parseFloat(cube.getAttribute('rate'), 10);
    if (currency && !Number.isNaN(rate)) {
      rates[currency] = rate;
      currencies.push(currency);
    }
  });
  return { rates, currencies };
}

/**
 * Fetch latest rates from ECB and update cache.
 * @returns {Promise<boolean>} true if successful
 */
export async function fetchRates() {
  try {
    const res = await fetch(ECB_FETCH_URL);
    if (!res.ok) return false;
    const xml = await res.text();
    const { rates, currencies } = parseECBXml(xml);
    ratesByCurrency = rates;
    currencyCodes = [...currencies].sort();
    setLastECBFetchTime(Date.now());
    return true;
  } catch (e) {
    console.warn('ECB fetch failed', e);
    return false;
  }
}

/**
 * Get exchange rate from one currency to another (cross-rate via EUR).
 * @param {string} from - e.g. 'EUR', 'USD'
 * @param {string} to - e.g. 'ZAR', 'GBP'
 * @returns {number|null} rate (units of `to` per one unit of `from`), or null if unavailable
 */
export function getExchangeRate(from, to) {
  const fromUpper = (from || '').toUpperCase();
  const toUpper = (to || '').toUpperCase();
  if (fromUpper === toUpper) return 1;
  const rateFrom = ratesByCurrency[fromUpper];
  const rateTo = ratesByCurrency[toUpper];
  if (rateFrom == null || rateTo == null) return null;
  if (fromUpper === 'EUR') return rateTo;
  if (toUpper === 'EUR') return 1 / rateFrom;
  return rateTo / rateFrom;
}

/**
 * Ensure rates are loaded (fetch if cache empty or stale).
 * @param {number} maxAgeMs - max age of cache before refetch (default 24h)
 */
export async function ensureRates(maxAgeMs = 24 * 60 * 60 * 1000) {
  const last = getLastECBFetchTime();
  const hasStaleCache = Object.keys(ratesByCurrency).length === 0 ||
    (last != null && Date.now() - last > maxAgeMs);
  if (hasStaleCache) await fetchRates();
}

/** @returns {string[]} sorted currency codes including EUR */
export function getCurrencyCodes() {
  return currencyCodes.length > 0 ? currencyCodes : ['EUR'];
}

/** @returns {number|null} last fetch timestamp */
export function getLastFetchTime() {
  return getLastECBFetchTime();
}
