import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime, formatTimestamp } from "./utils.js";

const TS = "2026-09-26T04:30:15Z";

test("the same instant is shown in the requested timezone", () => {
  assert.equal(formatDateTime(TS, "UTC", "time"), "04:30:15 AM");
  assert.equal(formatDateTime(TS, "Asia/Kolkata", "time"), "10:00:15 AM");
  assert.equal(formatDateTime(TS, "America/New_York", "time"), "12:30:15 AM");
});

test("the date rolls over with the timezone", () => {
  assert.equal(formatDateTime("2026-09-26T22:00:00Z", "UTC", "date"), "Sep 26, 2026");
  assert.equal(formatDateTime("2026-09-26T22:00:00Z", "Asia/Kolkata", "date"), "Sep 27, 2026");
});

test("full date and time includes seconds and the zone name", () => {
  const out = formatDateTime(TS, "Asia/Kolkata", "datetime");
  assert.match(out, /^Sep 26, 2026, 10:00:15 AM /);
  assert.match(out, /(IST|GMT\+5:30)$/);
});

test("clock shows hours and minutes only", () => {
  assert.equal(formatDateTime(TS, "Asia/Kolkata", "clock"), "10:00 AM");
});

test("missing or invalid input renders a dash instead of throwing", () => {
  assert.equal(formatDateTime(undefined), "—");
  assert.equal(formatDateTime("not a date"), "—");
});

test("an unknown timezone falls back instead of throwing", () => {
  assert.doesNotThrow(() => formatDateTime(TS, "Not/AZone"));
});

test("formatTimestamp honours the absolute setting and timezone", () => {
  assert.match(formatTimestamp(TS, "absolute", "Asia/Kolkata"), /10:00 AM/);
});
