/** Standalone time-based proration, without node billing conventions. */
export function calculateRemainingValue(price: number, cycleDays: number, expiresAt: number, asOf: number) {
  if (![price, cycleDays, expiresAt, asOf].every(Number.isFinite) || price < 0 || cycleDays <= 0) return null;
  const remainingDays = Math.max(0, (expiresAt - asOf) / 86_400_000);
  const amount = price * (remainingDays / cycleDays);
  if (!Number.isFinite(remainingDays) || !Number.isFinite(amount)) return null;
  return { remainingDays, amount };
}

export function localDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
