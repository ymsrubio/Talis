// Unknown Cards: UIDs tapped today that no Rider is linked to.

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function unknownCards(scans, riders) {
  const registered = new Set(riders.map((r) => r.card_uid));
  const firstTapped = new Map();
  for (const { uid, scanned_at } of scans) {
    if (registered.has(uid)) continue;
    const seen = firstTapped.get(uid);
    if (seen === undefined || Date.parse(scanned_at) < Date.parse(seen)) firstTapped.set(uid, scanned_at);
  }
  return [...firstTapped]
    .map(([uid, firstTappedAt]) => ({ uid, firstTappedAt }))
    .sort((a, b) => Date.parse(b.firstTappedAt) - Date.parse(a.firstTappedAt));
}
