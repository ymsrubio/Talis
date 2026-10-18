const { supabaseUrl, supabaseKey } = window.TALIS_CONFIG;
const db = supabase.createClient(supabaseUrl, supabaseKey);

const RECENT_LIMIT = 50;
const POLL_MS = 10000;

let scans = [];

const $ = (id) => document.getElementById(id);

function fmtTime(iso) {
  return new Date(iso).toLocaleString();
}

function setStatus(text, ok) {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + (ok ? "ok" : "bad");
}

function render() {
  $("total").textContent = scans.length;

  const byUid = new Map();
  for (const s of scans) {
    const c = byUid.get(s.uid) || { count: 0, last: s.scanned_at };
    c.count++;
    if (s.scanned_at > c.last) c.last = s.scanned_at;
    byUid.set(s.uid, c);
  }
  $("unique").textContent = byUid.size;
  $("last").textContent = scans[0] ? fmtTime(scans[0].scanned_at) : "–";

  const feed = scans.slice(0, RECENT_LIMIT);
  $("feed").innerHTML = feed.length
    ? feed.map((s) => `<tr data-id="${s.id}"><td class="uid">${esc(s.uid)}</td><td>${fmtTime(s.scanned_at)}</td></tr>`).join("")
    : `<tr><td colspan="2" class="empty">No scans yet. Tap a card on the reader.</td></tr>`;

  const cards = [...byUid.entries()].sort((a, b) => (a[1].last < b[1].last ? 1 : -1));
  $("cards").innerHTML = cards.length
    ? cards.map(([uid, c]) => `<tr><td class="uid">${esc(uid)}</td><td>${c.count}</td><td>${fmtTime(c.last)}</td></tr>`).join("")
    : `<tr><td colspan="3" class="empty">–</td></tr>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

async function load() {
  const { data, error } = await db
    .from("scans")
    .select("id, uid, scanned_at")
    .order("scanned_at", { ascending: false })
    .limit(1000);
  if (error) {
    setStatus("Error: " + error.message, false);
    return;
  }
  scans = data;
  render();
}

function flashNewest() {
  const row = $("feed").firstElementChild;
  if (row) row.classList.add("new");
}

db.channel("scans")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "scans" }, ({ new: row }) => {
    if (scans.some((s) => s.id === row.id)) return;
    scans.unshift(row);
    render();
    flashNewest();
  })
  .subscribe((state) => {
    if (state === "SUBSCRIBED") setStatus("Live", true);
    else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("Polling", true);
  });

load();
setInterval(load, POLL_MS);
