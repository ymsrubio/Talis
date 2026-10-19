// Turns raw scan rows into each Card's Status for the current Day.

const MIN_GAP_MS = 60_000;

// One entry per Status kind: everything the page needs to present it.
export const STATUS_KINDS = {
  not: { label: "Not yet", css: "not", icon: "clock" },
  on: { label: "On bus", css: "on", icon: "bus" },
  off: { label: "Dropped off", css: "off", icon: "check" },
};

const NOT_YET = { kind: "not" };

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function statusByCard(scans, now) {
  const timesByUid = new Map();
  for (const { uid, scanned_at } of scans) {
    const at = new Date(scanned_at);
    if (!sameDay(at, now)) continue;
    if (!timesByUid.has(uid)) timesByUid.set(uid, []);
    timesByUid.get(uid).push(at);
  }

  const statuses = new Map();
  for (const [uid, times] of timesByUid) {
    times.sort((a, b) => a - b);
    let taps = 0;
    let last = null;
    for (const at of times) {
      if (last && at - last < MIN_GAP_MS) continue;
      taps++;
      last = at;
    }
    statuses.set(uid, { kind: taps % 2 === 1 ? "on" : "off", at: last });
  }
  return statuses;
}

export function statusOf(statuses, uid) {
  return statuses.get(uid) ?? NOT_YET;
}

export function sameStatus(a, b) {
  return a.kind === b.kind && a.at?.getTime() === b.at?.getTime();
}

export function statusText(status) {
  if (status.kind === "not") return "No tap yet";
  const hh = String(status.at.getHours()).padStart(2, "0");
  const mm = String(status.at.getMinutes()).padStart(2, "0");
  return `${status.kind === "on" ? "Boarded" : "Dropped off"} ${hh}:${mm}`;
}

export function countStatuses(riders, statuses) {
  const counts = { on: 0, off: 0, not: 0 };
  for (const r of riders) counts[statusOf(statuses, r.card_uid).kind]++;
  return counts;
}
