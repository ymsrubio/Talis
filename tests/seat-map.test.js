import { test } from "node:test";
import assert from "node:assert/strict";
import { seatMap } from "../web/seat-map.js";

const cell = (grid_row, grid_col, seat, fixture = null, col_span = 1) => ({ grid_row, grid_col, col_span, seat, fixture });

const layout = [
  cell(0, 1, null, "driver"),
  cell(0, 5, null, "door"),
  cell(1, 1, 1), cell(1, 2, 2), cell(1, 4, 4), cell(1, 5, 3),
  cell(2, 1, 5), cell(2, 2, 6), cell(2, 4, null, "toilet", 2),
];

test("a Rider shows by first name on their Seat", () => {
  const { cells } = seatMap(layout, [{ name: "Miguel Santos", seat: 4 }]);
  const seat4 = cells.find((c) => c.seat === 4);
  assert.equal(seat4.rider.name, "Miguel Santos");
  assert.equal(seat4.rider.first, "Miguel");
});

test("a Seat with no Rider is empty", () => {
  const { cells } = seatMap(layout, [{ name: "Miguel Santos", seat: 4 }]);
  assert.equal(cells.find((c) => c.seat === 1).rider, null);
});

test("fixtures are labelled and hold no Rider", () => {
  const { cells } = seatMap(layout, []);
  const fixtures = cells.filter((c) => c.kind === "fixture").map((c) => c.label);
  assert.deepEqual(fixtures, ["Driver", "Door", "Toilet"]);
});

test("cells are placed on the grid from their layout row, column and span", () => {
  const { cells } = seatMap(layout, []);
  const driver = cells.find((c) => c.label === "Driver");
  const toilet = cells.find((c) => c.label === "Toilet");
  assert.deepEqual([driver.row, driver.col, driver.span], [1, 1, 1]);
  assert.deepEqual([toilet.row, toilet.col, toilet.span], [3, 4, 2]);
});

test("a column with no Seats is drawn as a narrow aisle", () => {
  const { columns } = seatMap(layout, []);
  assert.deepEqual(columns, ["seat", "seat", "aisle", "seat", "seat"]);
});

test("cells are ordered front to back, left to right", () => {
  const shuffled = [...layout].reverse();
  const { cells } = seatMap(shuffled, []);
  assert.deepEqual(cells.slice(0, 4).map((c) => c.label ?? c.seat), ["Driver", "Door", 1, 2]);
});
