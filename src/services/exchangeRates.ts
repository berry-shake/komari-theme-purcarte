import { DAY_MS, type CnyRates } from "../utils/valuation.ts";

export const FX_CACHE_KEY = "purcarte:exchange-rates:v1";
export const FX_ENDPOINT = "https://api.frankfurter.dev/v2/rates?base=CNY";
export const FX_TTL = DAY_MS;
const RETRY_DELAY = 15 * 60_000;
const CORE_CURRENCIES = ["USD", "EUR", "GBP", "RUB", "CHF", "INR", "VND", "THB"];

export interface ExchangeCache {
  version: 1;
  provider: "frankfurter-v2";
  fetchedAt: number;
  rates: CnyRates;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validDate(value: unknown, now: number): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now + DAY_MS
    && new Date(timestamp).toISOString().slice(0, 10) === value;
}

const validRate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 1e-12 && value <= 1e12;

export function parseRateResponse(payload: unknown, now: number): ExchangeCache {
  if (!Array.isArray(payload) || payload.length === 0 || payload.length > 500) throw new Error("Invalid exchange rates");
  const rates: CnyRates = {};
  for (const row of payload) {
    if (!isRecord(row) || row.base !== "CNY" || typeof row.quote !== "string"
      || !/^[A-Z]{3}$/.test(row.quote) || !validRate(row.rate) || !validDate(row.date, now)
      || rates[row.quote]) throw new Error("Invalid exchange rate row");
    // The API returns source units per CNY. Valuation needs CNY per source unit.
    rates[row.quote] = { rate: 1 / row.rate, date: row.date };
  }
  if (!CORE_CURRENCIES.every(code => rates[code])) throw new Error("Incomplete exchange rates");
  return { version: 1, provider: "frankfurter-v2", fetchedAt: now, rates };
}

export function parseRateCache(raw: string | null, now: number): ExchangeCache | null {
  if (!raw || raw.length > 128_000) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || data.provider !== "frankfurter-v2"
      || typeof data.fetchedAt !== "number" || !Number.isFinite(data.fetchedAt)
      || data.fetchedAt <= 0 || data.fetchedAt > now + 60_000 || !isRecord(data.rates)) return null;
    const rates: CnyRates = {};
    const entries = Object.entries(data.rates);
    if (entries.length > 500) return null;
    for (const [code, item] of entries) {
      if (!/^[A-Z]{3}$/.test(code) || !isRecord(item) || !validRate(item.rate) || !validDate(item.date, now)) return null;
      rates[code] = { rate: item.rate, date: item.date };
    }
    if (!CORE_CURRENCIES.every(code => rates[code])) return null;
    return { version: 1, provider: "frankfurter-v2", fetchedAt: data.fetchedAt, rates };
  } catch { return null; }
}

interface ClientOptions {
  storage: () => Pick<Storage, "getItem" | "setItem">;
  fetcher?: typeof fetch;
  now?: () => number;
}

/** Shared by all mounted consumers, including React StrictMode re-mounts. */
export function createExchangeRateClient({ storage, fetcher = fetch, now = Date.now }: ClientOptions) {
  let memory: ExchangeCache | null = null;
  let pending: Promise<{ cache: ExchangeCache | null; failed: boolean }> | null = null;
  let retryAt = 0;
  const read = (persist: boolean) => {
    if (persist) {
      try {
        const cached = parseRateCache(storage().getItem(FX_CACHE_KEY), now());
        if (cached && (!memory || cached.fetchedAt > memory.fetchedAt)) memory = cached;
      } catch { /* Browser storage may be disabled. Keep the in-memory cache. */ }
    }
    return memory;
  };
  const refresh = (persist: boolean): Promise<{ cache: ExchangeCache | null; failed: boolean }> => {
    const cache = read(persist);
    if (cache && now() - cache.fetchedAt < FX_TTL) return Promise.resolve({ cache, failed: false });
    if (pending) return pending;
    if (now() < retryAt) return Promise.resolve({ cache, failed: true });
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await Promise.resolve().then(() => fetcher(FX_ENDPOINT, {
          signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer",
        }));
        if (!response.ok) throw new Error(`Exchange rates HTTP ${response.status}`);
        const next = parseRateResponse(await response.json(), now());
        memory = next;
        retryAt = 0;
        if (persist) {
          try { storage().setItem(FX_CACHE_KEY, JSON.stringify(next)); }
          catch { /* Quota/privacy errors must not discard successfully fetched rates. */ }
        }
        return { cache: next, failed: false };
      } catch {
        retryAt = now() + RETRY_DELAY;
        return { cache: read(persist), failed: true };
      } finally {
        clearTimeout(timeout);
        pending = null;
      }
    })();
    return pending;
  };
  return { read, refresh };
}
