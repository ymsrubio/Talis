import { seatMap } from "/seat-map.js";
import { unknownCards, startOfToday } from "/unknown-cards.js";

const { supabaseUrl, supabaseKey } = window.TALIS_CONFIG;
const db = supabase.createClient(supabaseUrl, supabaseKey);

const $ = (id) => document.getElementById(id);

// message is null or { kind: "success" | "info" | "error", text, parentLink? }.
// name is the Rider name being typed; it lives here so live refetches keep it.
const state = {
  layout: [],
  riders: [],
  scans: [],
  picked: null,
  seat: null,
  name: "",
  saving: false,
  message: null,
};

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

const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function renderMessage() {
  const region = $("message");
  const m = state.message;
  if (!m) {
    region.replaceChildren();
    return;
  }
  const box = el("div", `message message-${m.kind}`);
  box.setAttribute("role", m.kind === "error" ? "alert" : "status");
  box.append(m.text);
  if (m.parentLink) {
    const link = el("a", null, "See the Parent page");
    link.href = "/";
    box.append(" ", link);
  }
  region.replaceChildren(box);
}

function renderUnknownList(unknown) {
  const list = $("unknown-list");
  if (unknown.length === 0) {
    const empty = state.scans.length === 0
      ? ["Nothing to register yet", "Tap a new card on the reader and it will show up here."]
      : ["All cards are registered", "Every card tapped today belongs to a Rider."];
    const li = el("li", "empty-card");
    li.append(el("strong", null, empty[0]), el("span", null, empty[1]));
    list.replaceChildren(li);
    return;
  }
  list.replaceChildren(
    ...unknown.map((card, i) => {
      const li = el("li", "unknown-row");
      if (state.picked?.uid === card.uid) li.classList.add("is-picked");
      const who = el("span", "unknown-who");
      const uid = el("span", "uid", card.uid);
      const head = el("span", "unknown-head");
      head.append(uid);
      if (i === 0) head.append(el("span", "badge badge-new", "Newest"));
      who.append(head, el("span", "unknown-sub", `First tapped today at ${timeOf(card.firstTappedAt)}`));

      const button = el("button", "btn btn-primary", "Register");
      button.type = "button";
      button.disabled = state.saving;
      button.setAttribute("aria-label", `Register card ${card.uid}`);
      button.addEventListener("click", () => {
        state.picked = { uid: card.uid };
        state.seat = null;
        state.name = "";
        state.message = null;
        render();
        $("rider-name")?.focus();
      });
      li.append(who, button);
      return li;
    }),
  );
}

function seatPicker() {
  const { columns, cells } = seatMap(state.layout, state.riders);
  const grid = el("ol", "bus-grid");
  grid.setAttribute("aria-label", "Seats, front to back");
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
        return li;
      }

      li.classList.add("seat");
      const button = el("button", "seat-btn");
      button.type = "button";
      button.append(el("span", "seat-num", c.seat));
      if (c.rider) {
        button.classList.add("is-taken");
        button.disabled = true;
        button.append(el("span", "seat-name", c.rider.first));
        button.setAttribute("aria-label", `Seat ${c.seat}, taken by ${c.rider.name}`);
      } else {
        const selected = state.seat === c.seat;
        button.classList.toggle("is-selected", selected);
        button.disabled = state.saving;
        button.setAttribute("aria-pressed", String(selected));
        button.setAttribute("aria-label", `Seat ${c.seat}, free`);
        button.addEventListener("click", () => {
          state.seat = c.seat;
          state.message = null;
          render();
          $(`seat-${c.seat}`)?.focus();
        });
        button.id = `seat-${c.seat}`;
      }
      li.append(button);
      return li;
    }),
  );
  return grid;
}

function renderPanel() {
  const panel = $("register-panel");
  if (!state.picked) {
    panel.replaceChildren(el("p", "empty-note", "Pick a card from Unknown cards to give it a name and a Seat."));
    return;
  }

  const noFreeSeat = !seatMap(state.layout, state.riders).cells.some((c) => c.kind === "seat" && !c.rider);

  const form = el("form", "register-form");
  form.noValidate = true;

  const uidField = el("div", "field");
  const uidLabel = el("label", null, "Card UID");
  uidLabel.htmlFor = "card-uid";
  const uid = el("output", "uid uid-output", state.picked.uid);
  uid.id = "card-uid";
  uidField.append(uidLabel, uid);

  const nameField = el("div", "field");
  const nameLabel = el("label", null, "Rider name");
  nameLabel.htmlFor = "rider-name";
  const name = el("input", "text-input");
  name.id = "rider-name";
  name.type = "text";
  name.required = true;
  name.autocomplete = "off";
  name.value = state.name;
  name.disabled = state.saving;
  name.addEventListener("input", () => {
    state.name = name.value;
  });
  nameField.append(nameLabel, name);

  const seatField = el("div", "field");
  const seatLegend = el("span", "field-label", "Seat");
  seatLegend.id = "seat-label";
  const bus = el("div", "bus");
  bus.append(el("div", "bus-end", "Front"), seatPicker(), el("div", "bus-end", "Back"));
  seatField.append(seatLegend, bus);
  if (noFreeSeat) seatField.append(el("p", "message message-error", "There is no free seat on this bus"));

  const actions = el("div", "actions");
  const save = el("button", "btn btn-primary", state.saving ? "Saving…" : "Save Rider");
  save.type = "submit";
  save.disabled = state.saving || noFreeSeat;
  const cancel = el("button", "btn btn-secondary", "Cancel");
  cancel.type = "button";
  cancel.disabled = state.saving;
  cancel.addEventListener("click", () => {
    state.picked = null;
    state.seat = null;
    state.name = "";
    state.message = null;
    render();
  });
  actions.append(save, cancel);

  form.append(uidField, nameField, seatField, actions);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    saveRider();
  });
  panel.replaceChildren(form);
}

function render() {
  const active = document.activeElement;
  const focusId = active?.id;
  const caret = active?.selectionStart;

  renderMessage();
  renderUnknownList(unknownCards(state.scans, state.riders));
  renderPanel();

  if (focusId) {
    const again = $(focusId);
    if (again && !again.disabled) {
      again.focus();
      if (caret != null && again.setSelectionRange) again.setSelectionRange(caret, caret);
    }
  }
}

async function saveRider() {
  if (state.saving || !state.picked) return;
  const name = state.name.trim();
  if (!name) {
    state.message = { kind: "error", text: "Enter a Rider name." };
    render();
    $("rider-name")?.focus();
    return;
  }
  if (state.seat == null) {
    state.message = { kind: "error", text: "Pick a Seat." };
    render();
    return;
  }

  const { uid } = state.picked;
  const seat = state.seat;
  state.saving = true;
  state.message = null;
  render();

  const { error } = await db.from("riders").insert({ card_uid: uid, name, seat });
  state.saving = false;

  if (!error) {
    state.picked = null;
    state.seat = null;
    state.name = "";
    state.message = { kind: "success", text: `Registered ${name} in Seat ${seat}.`, parentLink: true };
  } else {
    const where = `${error.message ?? ""} ${error.details ?? ""}`;
    if (error.code === "23505" && where.includes("riders_seat_key")) {
      state.seat = null;
      state.message = { kind: "error", text: `Seat ${seat} was just taken by another Rider. Pick another Seat. Nothing was saved.` };
    } else if (error.code === "23505" && where.includes("riders_card_uid_key")) {
      state.picked = null;
      state.seat = null;
      state.name = "";
      state.message = { kind: "error", text: "This card was registered meanwhile. Nothing was saved." };
    } else if (error.code === "23514") {
      state.message = { kind: "error", text: "The Rider name must not be blank. Nothing was saved." };
    } else {
      state.message = { kind: "error", text: `Could not save: ${error.message}. Nothing was saved.` };
    }
  }
  render();
  await load();
}

function reconcile() {
  if (state.seat != null && state.riders.some((r) => r.seat === state.seat)) {
    const seat = state.seat;
    state.seat = null;
    state.message = { kind: "error", text: `Seat ${seat} was just taken. Pick another Seat.` };
  }
  if (state.picked && !unknownCards(state.scans, state.riders).some((c) => c.uid === state.picked.uid)) {
    state.picked = null;
    state.seat = null;
    state.name = "";
    state.message = { kind: "info", text: "That card was registered elsewhere, so it is no longer an Unknown Card." };
  }
}

let loadId = 0;
async function load() {
  const id = ++loadId;
  const [layout, riders, scans] = await Promise.all([
    db.from("bus_layout").select("grid_row, grid_col, col_span, seat, fixture"),
    db.from("riders").select("card_uid, name, seat"),
    db.from("scans").select("uid, scanned_at").gte("scanned_at", startOfToday().toISOString()),
  ]);
  if (id !== loadId) return;
  const error = layout.error || riders.error || scans.error;
  if (error) {
    showNotice(`Could not load the bus: ${error.message}`);
    return;
  }
  showNotice("");
  state.layout = layout.data;
  state.riders = riders.data;
  state.scans = scans.data;
  if (!state.saving) reconcile();
  render();
}

$("today").textContent =
  "Admin · " + new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

db.channel("admin")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "scans" }, load)
  .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, load)
  .subscribe();

load();
