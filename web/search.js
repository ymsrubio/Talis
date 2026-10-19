// Finds Riders by name for the Parent page's "Find your child" search.

export function findRiders(riders, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return riders.filter((r) => r.name.toLowerCase().includes(needle));
}

export function resultText(query, count) {
  const needle = query.trim();
  if (!needle) return "";
  if (count === 0) return `No Rider named ${needle}`;
  return count === 1 ? "1 Rider found" : `${count} Riders found`;
}
