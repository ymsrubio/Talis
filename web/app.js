import { seatMap } from "./seat-map.js";
import { findRiders, resultText } from "./search.js";
import { viewState, connectionState } from "./view-state.js";
import { STATUS_KINDS, statusByCard, statusOf, sameStatus, statusText, countStatuses } from "./status.js";

const { supabaseUrl, supabaseKey } = window.TALIS_CONFIG;
const db = supabase.createClient(supabaseUrl, supabaseKey);

const $ = (id) => document.getElementById(id);

const ICONS = {
  clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/>',
  bus: '<rect x="2.5" y="3" width="11" height="9" rx="2"/><path d="M2.5 8h11M5 12v1.5M11 12v1.5"/>',
  check: '<circle cx="8" cy="8" r="6"/><path d="M5.5 8.2l1.8 1.8 3.2-3.6"/>',
};

const icon = (id, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;

const LIVE_TEXT = { connecting: "Connecting", live: "Live", offline: "Reconnecting…" };

let layout = null;
let riders = [];
let scans = [];
let statuses = new Map();
let openUid = null;
let openKey = null;
let loaded = false;
let query = "";
let channelState = "connecting";
let online = navigator.onLine;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function srOnly(text) {
  return el("span", "sr-only", text);
}

function showNotice(text) {
  const notice = $("notice");
  notice.textContent = text;
  notice.hidden = !text;
}

function setLive(state) {
  const live = $("live");
  live.dataset.state = state;
  live.textContent = LIVE_TEXT[state];
}

function syncConnection() {
  const state = connectionState({ channel: channelState, online });
  setLive(state);
  $("offline-banner").hidden = state !== "offline";
}

function drawDate() {
  $("today").textContent =
    "Bus attendance · " + new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function statusChip(kind) {
  const { label, css, icon: iconId } = STATUS_KINDS[kind];
  const chip = el("span", `badge badge-${css}`);
  chip.innerHTML = icon(iconId, 16);
  chip.append(label);
  return chip;
}

function drawLegend() {
  const items = Object.keys(STATUS_KINDS).map((kind) => {
    const li = el("li");
    li.append(statusChip(kind));
    return li;
  });
  $("legend").prepend(...items);
}

function drawCounts(counts) {
  $("counts").replaceChildren(
    ...["on", "off", "not"].map((kind) => {
      const li = el("li", "count");
      li.append(statusChip(kind), el("span", "count-num", counts[kind]));
      return li;
    }),
  );
}

function seatButton(c, status, matched) {
  const { css, icon: iconId } = STATUS_KINDS[status.kind];
  const button = el("button", `seat seat-btn seat-${css}`);
  button.classList.toggle("is-match", matched);
  button.type = "button";
  button.dataset.uid = c.rider.uid;
  button.dataset.key = `seat:${c.rider.uid}`;
  const top = el("span", "seat-top");
  top.append(srOnly("Seat "), el("span", "seat-num", c.seat));
  top.insertAdjacentHTML("beforeend", icon(iconId, 14));
  button.append(top, el("span", "seat-name", c.rider.first), srOnly(`, ${statusText(status)}`));
  button.title = c.rider.name;
  button.addEventListener("click", () => openDetails(c.rider.uid, button.dataset.key));
  return button;
}

function drawSeatMap(matches) {
  const { columns, cells } = seatMap(layout, riders);
  const grid = $("bus-grid");
  grid.style.gridTemplateColumns = columns
    .map((c) => (c === "aisle" ? "minmax(0, 0.4fr)" : "minmax(0, 1fr)"))
    .join(" ");

  grid.replaceChildren(
    ...cells.map((c) => {
      const li = el("li", "cell");
      li.style.gridRow = String(c.row);
      li.style.gridColumn = `${c.col} / span ${c.span}`;

      if (c.kind === "fixture") {
        li.classList.add("fixture");
        li.textContent = c.label;
      } else if (!c.rider) {
        li.classList.add("seat", "seat-empty");
        li.append(srOnly("Seat "), el("span", "seat-num", c.seat), srOnly(", empty"));
      } else {
        li.append(seatButton(c, statusOf(statuses, c.rider.uid), matches.has(c.rider.uid)));
      }
      return li;
    }),
  );
}

function riderRow(r, keyPrefix) {
  const status = statusOf(statuses, r.card_uid);
  const li = el("li");
  const button = el("button", "rider-row");
  button.type = "button";
  button.dataset.uid = r.card_uid;
  button.dataset.key = `${keyPrefix}:${r.card_uid}`;
  const who = el("span", "rider-who");
  who.append(el("span", "rider-name", r.name), el("span", "rider-sub", `Seat ${r.seat} · ${statusText(status)}`));
  button.append(who, statusChip(status.kind));
  button.addEventListener("click", () => openDetails(r.card_uid, button.dataset.key));
  li.append(button);
  return li;
}

function drawRiderList() {
  const list = $("rider-list");
  if (riders.length === 0) {
    list.replaceChildren(el("li", "empty-note", "No riders yet. Riders will appear here once they are registered."));
    return;
  }
  const sorted = [...riders].sort((a, b) => a.name.localeCompare(b.name));
  list.replaceChildren(...sorted.map((r) => riderRow(r, "row")));
}

function drawSearch(found) {
  const sorted = [...found].sort((a, b) => a.name.localeCompare(b.name));
  $("search-results").replaceChildren(...sorted.map((r) => riderRow(r, "result")));
  $("search-count").textContent = resultText(query, found.length);
  $("search-clear").hidden = query === "";
}

function openDetails(uid, key) {
  openUid = uid;
  openKey = key;
  fillDetails();
  $("details").showModal();
}

function fillDetails() {
  const rider = riders.find((r) => r.card_uid === openUid);
  if (!rider) return;
  const status = statusOf(statuses, rider.card_uid);
  $("details-name").textContent = rider.name;
  $("details-seat").textContent = `Seat ${rider.seat}`;
  $("details-status").replaceChildren(statusChip(status.kind));
  $("details-time").textContent = statusText(status);
}

const withUid = (uid) => [...document.querySelectorAll("[data-uid]")].filter((n) => n.dataset.uid === uid);

function flash(node) {
  node.classList.add("flash");
  node.addEventListener("animationend", () => node.classList.remove("flash"), { once: true });
}

function render(changed) {
  const focusedKey = document.activeElement?.dataset?.key;
  const counts = countStatuses(riders, statuses);
  const found = findRiders(riders, query);
  $("page").dataset.view = viewState({
    loaded,
    riderCount: riders.length,
    boardedCount: counts.on + counts.off,
  });
  drawCounts(counts);
  drawSeatMap(new Set(found.map((r) => r.card_uid)));
  drawRiderList();
  drawSearch(found);
  for (const uid of changed) withUid(uid).forEach(flash);
  if (focusedKey) document.querySelector(`[data-key="${CSS.escape(focusedKey)}"]`)?.focus();
  if ($("details").open) fillDetails();
}

// A Rider's Seat and row flash only when their Status really changed, so a
// double tap inside the 60 s window stays silent.
function update({ flashChanges }) {
  const previous = statuses;
  statuses = statusByCard(scans, new Date());
  const changed = new Set();
  if (flashChanges) {
    for (const r of riders) {
      if (!sameStatus(statusOf(previous, r.card_uid), statusOf(statuses, r.card_uid))) changed.add(r.card_uid);
    }
  }
  render(changed);
}

function localMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function refreshScans({ flashChanges }) {
  const { data, error } = await db
    .from("scans")
    .select("uid, scanned_at")
    .gte("scanned_at", localMidnight().toISOString());
  if (error) showNotice(`Could not load today's taps: ${error.message}`);
  else scans = data;
  update({ flashChanges });
}

async function refreshRiders() {
  const { data, error } = await db.from("riders").select("card_uid, name, seat");
  if (error) showNotice(`Could not load the riders: ${error.message}`);
  else riders = data;
  update({ flashChanges: false });
}

async function load() {
  const [layoutRes, ridersRes] = await Promise.all([
    db.from("bus_layout").select("grid_row, grid_col, col_span, seat, fixture"),
    db.from("riders").select("card_uid, name, seat"),
  ]);
  const error = layoutRes.error || ridersRes.error;
  if (error) {
    showNotice(`Could not load the bus: ${error.message}`);
    return;
  }
  showNotice("");
  layout = layoutRes.data;
  riders = ridersRes.data;
  await refreshScans({ flashChanges: false });
  loaded = true;
  $("page").removeAttribute("aria-busy");
  render(new Set());
  subscribe();
  scheduleMidnight();
}

function subscribe() {
  db.channel("scans-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "scans" }, ({ new: row }) => {
      scans.push(row);
      update({ flashChanges: true });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, refreshRiders)
    .subscribe((state) => {
      if (state === "SUBSCRIBED") {
        channelState = "subscribed";
        syncConnection();
        // Catch up on Taps and Registrations missed while connecting or offline.
        refreshRiders();
        refreshScans({ flashChanges: true });
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        channelState = "error";
        syncConnection();
      }
    });
}

function scheduleMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  setTimeout(() => {
    drawDate();
    refreshScans({ flashChanges: false });
    scheduleMidnight();
  }, next - now + 1000);
}

const searchInput = $("search-input");
searchInput.addEventListener("input", () => {
  query = searchInput.value;
  render(new Set());
});
$("search-clear").addEventListener("click", () => {
  searchInput.value = "";
  query = "";
  render(new Set());
  searchInput.focus();
});

// The browser knows the network dropped before the socket times out. After
// an offline event the channel is untrusted until it reports SUBSCRIBED again.
window.addEventListener("offline", () => {
  online = false;
  channelState = "error";
  syncConnection();
});
window.addEventListener("online", () => {
  online = true;
  syncConnection();
  if (!loaded) load();
  else {
    refreshRiders();
    refreshScans({ flashChanges: true });
  }
});

const details = $("details");
$("details-close").addEventListener("click", () => details.close());
details.addEventListener("click", (e) => {
  if (e.target === details) details.close();
});
details.addEventListener("close", () => {
  openUid = null;
  document.querySelector(`[data-key="${CSS.escape(openKey)}"]`)?.focus();
});

drawDate();
drawLegend();
syncConnection();
load();
