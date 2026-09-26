import test from "node:test";
import assert from "node:assert/strict";
import { calculateRemainingValue, localDateTimeValue } from "../src/utils/remainingValueCalculator.ts";

const start = Date.parse("2026-09-26T00:00:00Z");
const day = 86_400_000;

test("standalone calculator prorates partial days without rounding", () => {
  const result = calculateRemainingValue(30, 30, start + 15.5 * day, start);
  assert.equal(result.remainingDays, 15.5);
  assert.ok(Math.abs(result.amount - 15.5) < 1e-10);
});
test("zero prices and expired terms return zero independently of node conventions", () => {
  assert.equal(calculateRemainingValue(0, 30, start + day, start).amount, 0);
  assert.deepEqual(calculateRemainingValue(30, 30, start - day, start), { remainingDays: 0, amount: 0 });
  assert.equal(calculateRemainingValue(30, 30, start, start).amount, 0);
});
test("custom periods and multi-cycle prepaid time keep their full value", () => {
  assert.equal(calculateRemainingValue(100, 10, start + 40 * day, start).amount, 400);
  assert.equal(calculateRemainingValue(2, 0.5, start + day, start).amount, 4);
});
test("invalid fields and numeric overflow do not produce a result", () => {
  for (const args of [[-1,30,start,start], [1,0,start,start], [1,-1,start,start], [NaN,30,start,start], [1,30,NaN,start], [1,30,start,NaN], [Infinity,30,start,start], [Number.MAX_VALUE,1,start + 2 * day,start]]) {
    assert.equal(calculateRemainingValue(...args), null);
  }
});
test("datetime-local defaults preserve local wall-clock time", () => {
  const local = new Date(2026, 8, 26, 9, 5, 30);
  assert.equal(localDateTimeValue(local), "2026-09-26T09:05");
  assert.equal(new Date(localDateTimeValue(local)).getTime(), new Date(2026,8,26,9,5).getTime());
});
