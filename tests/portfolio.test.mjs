import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DAY_MS, estimateRemainingValue, normalizeCurrency } from "../src/utils/valuation.ts";
import { normalizeRegion, summarizeRegions, regionName } from "../src/utils/regions.ts";
import { createExchangeRateClient, parseRateResponse, parseRateCache, FX_CACHE_KEY, FX_TTL } from "../src/services/exchangeRates.ts";

const now = Date.parse("2026-09-26T00:00:00Z");
const paid = { price: 365, billing_cycle: 365, currency: "¥", expired_at: new Date(now + 100 * DAY_MS).toISOString() };
const payload = ["USD", "EUR", "GBP", "RUB", "CHF", "INR", "VND", "THB"].map(quote => ({ base: "CNY", quote, date: "2026-09-25", rate: quote === "USD" ? 0.125 : 2 }));
const fresh = () => parseRateResponse(payload, now);
const response = () => new Response(JSON.stringify(payload), { status: 200 });

test("all existing billing symbols and standard currency codes are compatible", () => {
  const pairs = { "¥": "CNY", "￥": "CNY", "$": "USD", "€": "EUR", "£": "GBP", "₽": "RUB", "₣": "CHF", "₹": "INR", "₫": "VND", "฿": "THB", " usd ": "USD", "HK$": "HKD", "NT$": "TWD" };
  for (const [input, expected] of Object.entries(pairs)) assert.equal(normalizeCurrency(input), expected);
  assert.equal(normalizeCurrency("???"), null);
});
test("CNY needs no network and supports fractional days without rounding up", () => {
  assert.equal(estimateRemainingValue(paid, {}, now).cny, 100);
  assert.equal(estimateRemainingValue(paid, {}, now + DAY_MS / 2).cny, 99.5);
});
test("API quote direction is inverted exactly once", () => {
  const cache = fresh();
  assert.equal(cache.rates.USD.rate, 8);
  assert.equal(estimateRemainingValue({ ...paid, currency: "$" }, cache.rates, now).cny, 800);
});
test("remaining prepaid time is not capped at one cycle", () => {
  assert.equal(estimateRemainingValue({ ...paid, price: 30, billing_cycle: 30 }, {}, now).cny, 100);
});
test("free and expired are zero, missing price is excluded", () => {
  assert.equal(estimateRemainingValue({ ...paid, price: -1, expired_at: null }, {}, now).cny, 0);
  assert.equal(estimateRemainingValue({ ...paid, expired_at: new Date(now).toISOString() }, {}, now).cny, 0);
  const value = estimateRemainingValue({ ...paid, price: 0 }, {}, now);
  assert.equal(value.cny, null);
  assert.equal(value.reason, "priceMissing");
});
for (const [label, changes, reason] of [
  ["one-time", { billing_cycle: -1 }, "cycleMissing"],
  ["unset expiry", { expired_at: "0001-01-01T00:00:00Z" }, "expiryMissing"],
  ["invalid expiry", { expired_at: "no date" }, "expiryMissing"],
  ["long-term", { expired_at: "2226-01-01T00:00:00Z" }, "longTerm"],
  ["missing currency", { currency: "" }, "currencyUnknown"],
  ["missing FX", { currency: "$" }, "rateMissing"],
  ["unsupported currency", { currency: "ZZZ" }, "rateMissing"],
  ["invalid price", { price: Infinity }, "priceMissing"],
  ["overflow", { price: Number.MAX_VALUE, billing_cycle: 1 }, "invalidValue"],
]) test(`${label} is excluded with a reason`, () => {
  const value = estimateRemainingValue({ ...paid, ...changes }, {}, now);
  assert.equal(value.cny, null);
  assert.equal(value.reason, reason);
});
test("offline status does not erase prepaid value", () => {
  assert.equal(estimateRemainingValue({ ...paid, stats: { online: false } }, {}, now).cny, 100);
});
test("bad, future and partial responses cannot become a valid cache", () => {
  for (const bad of [null, [], payload.slice(1), [...payload, payload[0]], payload.map(row => ({ ...row, rate: 0 })), payload.map(row => ({ ...row, date: "2026-02-30" })), payload.map(row => ({ ...row, date: "2099-01-01" })), payload.map(row => ({ ...row, base: "USD" }))]) {
    assert.throws(() => parseRateResponse(bad, now));
  }
  assert.equal(parseRateCache("broken", now), null);
  assert.equal(parseRateCache(JSON.stringify({ ...fresh(), fetchedAt: now + DAY_MS }), now), null);
  assert.equal(parseRateCache(JSON.stringify({ ...fresh(), version: 2 }), now), null);
  assert.equal(parseRateCache(JSON.stringify({ ...fresh(), rates: { ...fresh().rates, USD: { rate: -1, date: "2026-09-25" } } }), now), null);
});

function storage(initial = null) {
  let raw = initial;
  return { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
}
test("valid localStorage cache avoids fetch, including a new client/page", async () => {
  const store = storage(JSON.stringify(fresh()));
  const client = createExchangeRateClient({ storage: () => store, now: () => now, fetcher: () => { throw new Error("must not fetch"); } });
  assert.equal((await client.refresh(true)).cache.rates.USD.rate, 8);
});
test("concurrent consumers share one request and persist validated rates", async () => {
  const store = storage(); let calls = 0;
  const client = createExchangeRateClient({ storage: () => store, now: () => now, fetcher: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return response(); } });
  const [a, b] = await Promise.all([client.refresh(true), client.refresh(true)]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  assert.equal(parseRateCache(store.getItem(FX_CACHE_KEY), now).rates.USD.rate, 8);
  await client.refresh(true);
  assert.equal(calls, 1);
});
test("expired cache survives network failure, backs off, then recovers", async () => {
  let clock = now + FX_TTL + 1, calls = 0;
  const store = storage(JSON.stringify(fresh()));
  const client = createExchangeRateClient({ storage: () => store, now: () => clock, fetcher: async () => { calls++; if (calls === 1) throw new Error("offline"); return response(); } });
  const failed = await client.refresh(true);
  assert.equal(failed.failed, true);
  assert.equal(failed.cache.fetchedAt, now);
  await client.refresh(true);
  assert.equal(calls, 1);
  clock += 15 * 60_000;
  assert.equal((await client.refresh(true)).failed, false);
  assert.equal(calls, 2);
});
test("partial refresh cannot overwrite last good cache", async () => {
  const store = storage(JSON.stringify(fresh()));
  const client = createExchangeRateClient({ storage: () => store, now: () => now + FX_TTL, fetcher: async () => new Response(JSON.stringify(payload.slice(1))) });
  assert.equal((await client.refresh(true)).cache.fetchedAt, now);
  assert.equal(JSON.parse(store.getItem(FX_CACHE_KEY)).fetchedAt, now);
});
test("blocked storage falls back to memory and disabled persistence is respected", async () => {
  let calls = 0;
  const client = createExchangeRateClient({ storage: () => { throw new Error("SecurityError"); }, now: () => now, fetcher: async () => { calls++; return response(); } });
  assert.equal((await client.refresh(true)).failed, false);
  assert.equal((await client.refresh(true)).cache.rates.USD.rate, 8);
  assert.equal(calls, 1);
  const noStorage = createExchangeRateClient({ storage: () => { assert.fail("storage disabled"); }, now: () => now, fetcher: async () => response() });
  assert.equal((await noStorage.refresh(false)).cache.rates.USD.rate, 8);
});
test("bad saved data triggers recovery, empty offline cache remains unavailable", async () => {
  const client = createExchangeRateClient({ storage: () => storage("bad"), now: () => now, fetcher: async () => response() });
  assert.equal((await client.refresh(true)).cache.rates.USD.rate, 8);
  const offline = createExchangeRateClient({ storage: () => storage(), fetcher: async () => new Response("error", { status: 503 }) });
  assert.deepEqual(await offline.refresh(true), { cache: null, failed: true });
});

test("flag emoji and ISO codes count as one region; unknown regions are excluded", () => {
  assert.equal(normalizeRegion("🇺🇸"), "US");
  assert.equal(normalizeRegion(" us "), "US");
  assert.equal(normalizeRegion("UK"), "GB");
  assert.equal(normalizeRegion("CN-TW"), "TW");
  assert.equal(regionName("TW"), "中国台湾");
  assert.equal(normalizeRegion("🇺🇳"), null);
  assert.equal(normalizeRegion("🌐"), null);
  assert.equal(normalizeRegion("ZZ"), null);
  assert.equal(normalizeRegion("constructor"), null);
  assert.deepEqual(summarizeRegions([
    { region: "🇺🇸", stats: { online: true } }, { region: "us", stats: { online: false } },
    { region: "HK" }, { region: "" },
  ]), [{ code: "HK", total: 1, online: 0 }, { code: "US", total: 2, online: 1 }]);
});
test("map has unique region keys, local geometry and markers for tiny regions", () => {
  const map = JSON.parse(readFileSync(new URL("../src/assets/world-map.json", import.meta.url), "utf8"));
  assert.equal(new Set(map.regions.map(r => r.code)).size, map.regions.length);
  for (const code of ["US", "CN", "HK", "TW", "SG", "JP", "FR", "NO", "AU"]) {
    const region = map.regions.find(r => r.code === code);
    assert.ok(region.path.startsWith("M"));
    assert.ok(region.marker.every(Number.isFinite));
  }
  assert.equal(map.regions.find(r => r.code === "SG").small, true);
  assert.equal(map.regions.find(r => r.code === "HK").small, true);
  assert.equal(regionName("AU"), "澳大利亚");
});

test("preferred region order is stable regardless of node counts", () => {
  const regions = ["US", "US", "TW", "MO", "HK", "CN", "SG", "SG", "SG"];
  assert.deepEqual(summarizeRegions(regions.map(region => ({ region }))).map(r => r.code), ["CN", "HK", "MO", "TW", "SG", "US"]);
  assert.deepEqual(["CN", "HK", "MO", "TW"].map(regionName), ["中国", "中国香港", "中国澳门", "中国台湾"]);
});
