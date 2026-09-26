/** All rates are CNY per one unit of the source currency. */
export type CnyRates = Record<string, { rate: number; date: string }>;

const currencyAliases: Record<string, string> = {
  "¥": "CNY", "￥": "CNY", RMB: "CNY", "人民币": "CNY",
  "$": "USD", "US$": "USD", "美元": "USD",
  "€": "EUR", "£": "GBP", "₽": "RUB", "₣": "CHF",
  "₹": "INR", "₫": "VND", "฿": "THB",
  "HK$": "HKD", "S$": "SGD", "NT$": "TWD", "JP¥": "JPY",
  "A$": "AUD", "C$": "CAD", "₩": "KRW",
};

export function normalizeCurrency(value: string): string | null {
  const text = value.trim().toUpperCase();
  return currencyAliases[text] ?? (/^[A-Z]{3}$/.test(text) ? text : null);
}

export interface BillingData {
  price: number;
  billing_cycle: number;
  currency: string;
  expired_at: string | null;
}

export type ValueReason = "free" | "expired" | "priceMissing" | "cycleMissing"
  | "expiryMissing" | "longTerm" | "currencyUnknown" | "rateMissing" | "invalidValue";

export interface Valuation {
  cny: number | null;
  original: number | null;
  currency: string | null;
  remainingDays: number | null;
  reason?: ValueReason;
}

export const DAY_MS = 86_400_000;

export function estimateRemainingValue(node: BillingData, rates: CnyRates, now: number): Valuation {
  const currency = normalizeCurrency(node.currency || "");
  const result: Valuation = { cny: null, original: null, currency, remainingDays: null };
  if (node.price === -1) return { ...result, cny: 0, original: 0, reason: "free" };
  if (!Number.isFinite(node.price) || node.price <= 0) return { ...result, reason: "priceMissing" };
  if (!Number.isFinite(node.billing_cycle) || node.billing_cycle <= 0) return { ...result, reason: "cycleMissing" };
  const expiry = node.expired_at ? Date.parse(node.expired_at) : NaN;
  // Komari's unset timestamp is year 0001, not an expired paid subscription.
  if (!Number.isFinite(expiry) || expiry <= 0) return { ...result, reason: "expiryMissing" };
  const remainingDays = Math.max(0, (expiry - now) / DAY_MS);
  result.remainingDays = remainingDays;
  // Matches the theme's existing >= 100-year "long term" convention.
  if (remainingDays >= 36500) return { ...result, reason: "longTerm" };
  if (remainingDays === 0) return { ...result, cny: 0, original: 0, reason: "expired" };
  const original = node.price * (remainingDays / node.billing_cycle);
  if (!Number.isFinite(original)) return { ...result, reason: "invalidValue" };
  result.original = original;
  if (!currency) return { ...result, reason: "currencyUnknown" };
  const rate = currency === "CNY" ? 1 : rates[currency]?.rate;
  if (!rate || !Number.isFinite(rate) || rate <= 0) return { ...result, reason: "rateMissing" };
  const cny = original * rate;
  if (!Number.isFinite(cny)) return { ...result, reason: "invalidValue" };
  return { ...result, cny };
}

export const formatCny = (value: number) => new Intl.NumberFormat("zh-CN", {
  style: "currency", currency: "CNY", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
