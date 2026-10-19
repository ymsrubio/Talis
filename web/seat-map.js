// Turns Bus Layout rows and Riders into the cells the seat map draws.

const FIXTURE_LABELS = { driver: "Driver", door: "Door", toilet: "Toilet", fridge: "Fridge" };

export function seatMap(layout, riders) {
  const riderBySeat = new Map(riders.map((r) => [r.seat, r]));
  const firstRow = Math.min(...layout.map((l) => l.grid_row));
  const width = Math.max(0, ...layout.map((l) => l.grid_col + l.col_span - 1));

  const seatCols = new Set();
  for (const l of layout) {
    if (l.seat == null) continue;
    for (let c = l.grid_col; c < l.grid_col + l.col_span; c++) seatCols.add(c);
  }
  const columns = Array.from({ length: width }, (_, i) => (seatCols.has(i + 1) ? "seat" : "aisle"));

  const cells = [...layout]
    .sort((a, b) => a.grid_row - b.grid_row || a.grid_col - b.grid_col)
    .map((l) => {
      const place = { row: l.grid_row - firstRow + 1, col: l.grid_col, span: l.col_span };
      if (l.seat == null) return { ...place, kind: "fixture", label: FIXTURE_LABELS[l.fixture] ?? l.fixture };
      const r = riderBySeat.get(l.seat);
      return {
        ...place,
        kind: "seat",
        seat: l.seat,
        rider: r ? { name: r.name, first: firstName(r.name) } : null,
      };
    });

  return { columns, cells };
}

export function firstName(name) {
  return name.trim().split(/\s+/)[0];
}
