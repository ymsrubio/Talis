import { test } from "node:test";
import assert from "node:assert/strict";
import { findRiders, resultText } from "../web/search.js";

const riders = [
  { card_uid: "A", name: "Ana Cruz", seat: 1 },
  { card_uid: "B", name: "Joanna Reyes", seat: 2 },
  { card_uid: "C", name: "Ben Santos", seat: 3 },
];

const names = (query) => findRiders(riders, query).map((r) => r.name);

test("matches a substring of the full name", () => {
  assert.deepEqual(names("anna"), ["Joanna Reyes"]);
  assert.deepEqual(names("an"), ["Ana Cruz", "Joanna Reyes", "Ben Santos"]);
});

test("matches across the first and last name", () => {
  assert.deepEqual(names("a cr"), ["Ana Cruz"]);
});

test("ignores case", () => {
  assert.deepEqual(names("BEN SAN"), ["Ben Santos"]);
});

test("trims the query", () => {
  assert.deepEqual(names("  ben  "), ["Ben Santos"]);
});

test("an empty or blank query matches nobody", () => {
  assert.deepEqual(names(""), []);
  assert.deepEqual(names("   "), []);
});

test("an unknown name matches nobody", () => {
  assert.deepEqual(names("zed"), []);
});

test("result text for no query is empty", () => {
  assert.equal(resultText("  ", 0), "");
});

test("result text names the query when nobody matches", () => {
  assert.equal(resultText(" Zed ", 0), "No Rider named Zed");
});

test("result text counts matches", () => {
  assert.equal(resultText("ben", 1), "1 Rider found");
  assert.equal(resultText("an", 2), "2 Riders found");
});
