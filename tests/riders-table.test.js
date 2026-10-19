import { test } from "node:test";
import assert from "node:assert/strict";
import { ridersTable, removePrompt } from "../web/riders-table.js";

const layout = [
  { grid_row: 0, grid_col: 1, col_span: 1, seat: null, fixture: "driver" },
  { grid_row: 1, grid_col: 1, col_span: 1, seat: 1, fixture: null },
  { grid_row: 1, grid_col: 2, col_span: 1, seat: 2, fixture: null },
  { grid_row: 2, grid_col: 1, col_span: 1, seat: 3, fixture: null },
];

test("rows come in Seat order and the tally counts Seats in the Bus Layout, not fixtures", () => {
  const riders = [
    { card_uid: "BB", name: "Ben Ortiz", seat: 3 },
    { card_uid: "AA", name: "Ana Cruz", seat: 1 },
  ];
  assert.deepEqual(ridersTable(layout, riders), {
    rows: [
      { uid: "AA", name: "Ana Cruz", seat: 1 },
      { uid: "BB", name: "Ben Ortiz", seat: 3 },
    ],
    taken: 2,
    total: 3,
    summary: "2 of 3 seats taken",
  });
});

test("a bus with no Riders reads 0 of N", () => {
  assert.equal(ridersTable(layout, []).summary, "0 of 3 seats taken");
});

test("the remove prompt names the Rider and the Seat that becomes free", () => {
  assert.equal(
    removePrompt({ name: "Ana Cruz", seat: 12 }),
    "Remove Ana Cruz? Seat 12 becomes free. The card will show up as unknown the next time it is tapped.",
  );
});
