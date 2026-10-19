import { test } from "node:test";
import assert from "node:assert/strict";
import { unknownCards, startOfToday } from "../web/unknown-cards.js";

const scan = (uid, scanned_at) => ({ uid, scanned_at });

test("several taps of one card list it once, at its earliest tap", () => {
  const scans = [
    scan("AA", "2026-10-19T07:45:00.000Z"),
    scan("AA", "2026-10-19T07:42:00.000Z"),
    scan("AA", "2026-10-19T08:10:00.000Z"),
  ];
  assert.deepEqual(unknownCards(scans, []), [{ uid: "AA", firstTappedAt: "2026-10-19T07:42:00.000Z" }]);
});

test("a card linked to a Rider is not unknown", () => {
  const scans = [scan("AA", "2026-10-19T07:00:00.000Z"), scan("BB", "2026-10-19T07:05:00.000Z")];
  assert.deepEqual(unknownCards(scans, [{ card_uid: "AA" }]), [
    { uid: "BB", firstTappedAt: "2026-10-19T07:05:00.000Z" },
  ]);
});

test("the card first tapped most recently comes first", () => {
  const scans = [
    scan("AA", "2026-10-19T07:00:00.000Z"),
    scan("BB", "2026-10-19T09:00:00.000Z"),
    scan("CC", "2026-10-19T08:00:00.000Z"),
    scan("AA", "2026-10-19T09:30:00.000Z"),
  ];
  assert.deepEqual(unknownCards(scans, []).map((c) => c.uid), ["BB", "CC", "AA"]);
});

test("no taps means no unknown cards", () => {
  assert.deepEqual(unknownCards([], [{ card_uid: "AA" }]), []);
});

test("start of today is local midnight", () => {
  const start = startOfToday(new Date(2026, 9, 19, 15, 30, 12));
  assert.deepEqual(
    [start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes(), start.getSeconds()],
    [2026, 9, 19, 0, 0, 0],
  );
});
