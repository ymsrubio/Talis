import { test } from "node:test";
import assert from "node:assert/strict";
import { statusByCard, statusOf, statusText, countStatuses } from "../web/status.js";

const at = (h, m, s = 0, dayOffset = 0) => new Date(2026, 9, 19 + dayOffset, h, m, s);
const scan = (uid, date) => ({ uid, scanned_at: date.toISOString() });
const now = at(12, 0);

const statusOfUid = (scans, uid = "A") => statusOf(statusByCard(scans, now), uid);

test("no taps means Not yet", () => {
  assert.deepEqual(statusOfUid([]), { kind: "not" });
});

test("one tap is On bus at that time", () => {
  assert.deepEqual(statusOfUid([scan("A", at(7, 42))]), { kind: "on", at: at(7, 42) });
});

test("two taps more than a minute apart is Dropped off", () => {
  const scans = [scan("A", at(7, 42)), scan("A", at(16, 20))];
  assert.deepEqual(statusOfUid(scans), { kind: "off", at: at(16, 20) });
});

test("three taps is On bus at the third tap", () => {
  const scans = [scan("A", at(7, 42)), scan("A", at(8, 30)), scan("A", at(9, 15))];
  assert.deepEqual(statusOfUid(scans), { kind: "on", at: at(9, 15) });
});

test("a double tap 5 seconds apart stays On bus at the first tap", () => {
  const scans = [scan("A", at(7, 42, 0)), scan("A", at(7, 42, 5))];
  assert.deepEqual(statusOfUid(scans), { kind: "on", at: at(7, 42, 0) });
});

test("two taps 61 seconds apart is Dropped off", () => {
  const scans = [scan("A", at(7, 42, 0)), scan("A", at(7, 43, 1))];
  assert.deepEqual(statusOfUid(scans), { kind: "off", at: at(7, 43, 1) });
});

test("two taps exactly 60 seconds apart count as two taps", () => {
  const scans = [scan("A", at(7, 42, 0)), scan("A", at(7, 43, 0))];
  assert.deepEqual(statusOfUid(scans), { kind: "off", at: at(7, 43, 0) });
});

test("reads are measured from the previous counted tap, not the previous read", () => {
  const scans = [scan("A", at(7, 42, 0)), scan("A", at(7, 42, 40)), scan("A", at(7, 43, 10))];
  assert.deepEqual(statusOfUid(scans), { kind: "off", at: at(7, 43, 10) });
});

test("scan rows may arrive in any order", () => {
  const scans = [scan("A", at(16, 20)), scan("A", at(7, 42))];
  assert.deepEqual(statusOfUid(scans), { kind: "off", at: at(16, 20) });
});

test("yesterday's taps leave a Rider Not yet", () => {
  const scans = [scan("A", at(7, 42, 0, -1)), scan("A", at(16, 20, 0, -1))];
  assert.deepEqual(statusOfUid(scans), { kind: "not" });
});

test("only taps after midnight count", () => {
  const scans = [scan("A", at(23, 59, 30, -1)), scan("A", at(0, 0, 10))];
  assert.deepEqual(statusOfUid(scans), { kind: "on", at: at(0, 0, 10) });
});

test("each Card has its own Status", () => {
  const statuses = statusByCard([scan("A", at(7, 42)), scan("B", at(7, 50)), scan("B", at(8, 50))], now);
  assert.deepEqual(statusOf(statuses, "A"), { kind: "on", at: at(7, 42) });
  assert.deepEqual(statusOf(statuses, "B"), { kind: "off", at: at(8, 50) });
  assert.deepEqual(statusOf(statuses, "C"), { kind: "not" });
});

test("statusText reads No tap yet, Boarded and Dropped off with zero-padded 24-hour time", () => {
  assert.equal(statusText({ kind: "not" }), "No tap yet");
  assert.equal(statusText({ kind: "on", at: at(7, 5) }), "Boarded 07:05");
  assert.equal(statusText({ kind: "off", at: at(16, 20) }), "Dropped off 16:20");
  assert.equal(statusText({ kind: "on", at: at(0, 0, 10) }), "Boarded 00:00");
});

test("countStatuses counts Riders by Status, defaulting to Not yet", () => {
  const riders = [{ card_uid: "A" }, { card_uid: "B" }, { card_uid: "C" }, { card_uid: "D" }];
  const statuses = statusByCard([scan("A", at(7, 42)), scan("B", at(7, 50)), scan("B", at(8, 50))], now);
  assert.deepEqual(countStatuses(riders, statuses), { on: 1, off: 1, not: 2 });
});
