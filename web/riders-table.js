// The Riders table on /admin: one row per Rider in Seat order, plus the Seat tally.

export function ridersTable(layout, riders) {
  const total = layout.filter((l) => l.seat != null).length;
  const rows = riders
    .map((r) => ({ uid: r.card_uid, name: r.name, seat: r.seat }))
    .sort((a, b) => a.seat - b.seat);
  return { rows, taken: rows.length, total, summary: `${rows.length} of ${total} seats taken` };
}

export function removePrompt(rider) {
  return `Remove ${rider.name}? Seat ${rider.seat} becomes free. The card will show up as unknown the next time it is tapped.`;
}
