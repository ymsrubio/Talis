import { seatMap } from "./seat-map.js";

const { supabaseUrl, supabaseKey } = window.TALIS_CONFIG;
const db = supabase.createClient(supabaseUrl, supabaseKey);

const $ = (id) => document.getElementById(id);

const clockIcon = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/></svg>`;

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

function drawSeatMap(layout, riders) {
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
        li.classList.add("seat", "seat-not");
        const top = el("span", "seat-top");
        top.append(srOnly("Seat "), el("span", "seat-num", c.seat));
        top.insertAdjacentHTML("beforeend", clockIcon(14));
        li.append(top, el("span", "seat-name", c.rider.first), srOnly(", Not yet"));
        li.title = c.rider.name;
      }
      return li;
    }),
  );
}

function drawRiderList(riders) {
  const list = $("rider-list");
  if (riders.length === 0) {
    list.replaceChildren(el("li", "empty-note", "No riders yet. Riders will appear here once they are registered."));
    return;
  }
  const sorted = [...riders].sort((a, b) => a.name.localeCompare(b.name));
  list.replaceChildren(
    ...sorted.map((r) => {
      const li = el("li", "rider-row");
      const who = el("span", "rider-who");
      who.append(el("span", "rider-name", r.name), el("span", "rider-sub", `Seat ${r.seat} · No tap yet`));
      const badge = el("span", "badge badge-not");
      badge.innerHTML = clockIcon(16);
      badge.append("Not yet");
      li.append(who, badge);
      return li;
    }),
  );
}

async function load() {
  const [layout, riders] = await Promise.all([
    db.from("bus_layout").select("grid_row, grid_col, col_span, seat, fixture"),
    db.from("riders").select("name, seat"),
  ]);
  const error = layout.error || riders.error;
  if (error) {
    showNotice(`Could not load the bus: ${error.message}`);
    return;
  }
  showNotice("");
  drawSeatMap(layout.data, riders.data);
  drawRiderList(riders.data);
}

$("today").textContent =
  "Bus attendance · " + new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

load();
