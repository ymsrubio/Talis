import { test } from "node:test";
import assert from "node:assert/strict";
import { viewState, connectionState } from "../web/view-state.js";

test("loading until the first load completes, even with Riders and Taps", () => {
  assert.equal(viewState({ loaded: false, riderCount: 0, boardedCount: 0 }), "loading");
  assert.equal(viewState({ loaded: false, riderCount: 5, boardedCount: 2 }), "loading");
});

test("no Riders registered", () => {
  assert.equal(viewState({ loaded: true, riderCount: 0, boardedCount: 0 }), "no-riders");
});

test("start of day: Riders exist but nobody has a Tap today", () => {
  assert.equal(viewState({ loaded: true, riderCount: 5, boardedCount: 0 }), "start-of-day");
});

test("normal once any Rider has a Tap", () => {
  assert.equal(viewState({ loaded: true, riderCount: 5, boardedCount: 1 }), "normal");
});

test("live only when online and subscribed", () => {
  assert.equal(connectionState({ channel: "subscribed", online: true }), "live");
});

test("connecting before the first subscription", () => {
  assert.equal(connectionState({ channel: "connecting", online: true }), "connecting");
});

test("a lost channel is offline", () => {
  assert.equal(connectionState({ channel: "error", online: true }), "offline");
});

test("the browser being offline wins over a subscribed channel", () => {
  assert.equal(connectionState({ channel: "subscribed", online: false }), "offline");
  assert.equal(connectionState({ channel: "connecting", online: false }), "offline");
});
