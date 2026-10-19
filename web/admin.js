import { seatMap } from "/seat-map.js";
import { unknownCards, startOfToday } from "/unknown-cards.js";
import { ridersTable, removePrompt } from "/riders-table.js";

const { supabaseUrl, supabaseKey } = window.TALIS_CONFIG;
const db = supabase.createClient(supabaseUrl, supabaseKey);

const $ = (id) => document.getElementById(id);

// message is null or { kind: "success" | "info" | "error", text, parentLink? }.
// picked is null or { uid, mode: "register" | "edit" }: the card in the panel.
// name is the Rider name being typed; it lives here so live refetches keep it.
// pendingRemove is the uid of the Rider whose remove confirmation is open.
const state = {
  layout: [],
  riders: [],
  scans: [],
  picked: null,
  pendingRemove: null,
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

function messageBox() {
  const m = state.message;
  if (!m) return null;
  const box = el("div", `message message-${m.kind}`);
  box.setAttribute("role", m.kind === "error" ? "alert" : "status");
  box.append(m.text);
  if (m.parentLink) {
    const link = el("a", null, "See the Parent page");
    link.href = "/";
    box.append(" ", link);
  }
  return box;
}

function renderUnknownList(unknown) {
  const list = $("unknown-list");
  const focusedUid = list.contains(document.activeElement) ? document.activeElement.dataset.uid : null;
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
      if (state.picked?.mode === "register" && state.picked.uid === card.uid) li.classList.add("is-picked");
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
        state.picked = { uid: card.uid, mode: "register" };
        state.seat = null;
        state.name = "";
        state.message = null;
        render();
        $("rider-name")?.focus();
      });
      button.dataset.uid = card.uid;
      li.append(who, button);
      return li;
    }),
  );
  if (focusedUid) list.querySelector(`[data-uid="${CSS.escape(focusedUid)}"]`)?.focus();
}

const editedRider = () =>
  state.picked?.mode === "edit" ? state.riders.find((r) => r.card_uid === state.picked.uid) : undefined;

function closePanel() {
  state.picked = null;
  state.seat = null;
  state.name = "";
}

function seatPicker() {
  // The edited Rider's own Seat is free to keep, so it is drawn as free here.
  const editing = editedRider();
  const { columns, cells } = seatMap(state.layout, state.riders.filter((r) => r !== editing));
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
        button.setAttribute("aria-label", `Seat ${c.seat}, ${c.seat === editing?.seat ? "current seat" : "free"}`);
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

// The form is built once per picked card and then updated in place, so a live
// update never replaces the name input while someone is typing (iOS would
// close the keyboard).
let form = null;

function buildForm({ uid, mode }) {
  const form = el("form", "register-form");
  form.noValidate = true;
  form.dataset.uid = uid;
  form.dataset.mode = mode;

  const uidField = el("div", "field");
  const uidLabel = el("label", null, "Card UID");
  uidLabel.htmlFor = "card-uid";
  const uidOut = el("output", "uid uid-output", uid);
  uidOut.id = "card-uid";
  uidField.append(uidLabel, uidOut);

  const nameField = el("div", "field");
  const nameLabel = el("label", null, "Rider name");
  nameLabel.htmlFor = "rider-name";
  const name = el("input", "text-input");
  name.id = "rider-name";
  name.type = "text";
  name.required = true;
  name.autocomplete = "off";
  name.value = state.name;
  name.addEventListener("input", () => {
    state.name = name.value;
  });
  nameField.append(nameLabel, name);

  const seatField = el("div", "field");
  const bus = el("div", "bus");
  const seats = el("div");
  seats.id = "seat-slot";
  bus.append(el("div", "bus-end", "Front"), seats, el("div", "bus-end", "Back"));
  const full = el("p", "message message-error", "There is no free seat on this bus");
  full.id = "no-free-seat";
  seatField.append(el("span", "field-label", "Seat"), bus, full);

  // Next to Save, so the outcome is visible where the admin is looking on a phone.
  const message = el("div");
  message.id = "form-message";

  const actions = el("div", "actions");
  const save = el("button", "btn btn-primary");
  save.id = "save-rider";
  save.type = "submit";
  const cancel = el("button", "btn btn-secondary", "Cancel");
  cancel.id = "cancel-register";
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    closePanel();
    state.message = null;
    render();
  });
  actions.append(save, cancel);

  form.append(uidField, nameField, seatField, message, actions);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    saveRider();
  });
  return form;
}

function updateForm() {
  const noFreeSeat = !seatMap(state.layout, state.riders.filter((r) => r !== editedRider())).cells.some(
    (c) => c.kind === "seat" && !c.rider,
  );

  const name = $("rider-name");
  if (name.value !== state.name) name.value = state.name;
  name.disabled = state.saving;

  const slot = $("seat-slot");
  const focusedSeat = slot.contains(document.activeElement) ? document.activeElement.id : null;
  slot.replaceChildren(seatPicker());
  if (focusedSeat) {
    const again = $(focusedSeat);
    if (again && !again.disabled) again.focus();
  }

  $("no-free-seat").hidden = !noFreeSeat;
  const message = messageBox();
  $("form-message").replaceChildren(...(message ? [message] : []));

  const save = $("save-rider");
  save.textContent = state.saving ? "Saving…" : "Save Rider";
  save.disabled = state.saving || noFreeSeat;
  $("cancel-register").disabled = state.saving;
}

function renderPanel() {
  const panel = $("register-panel");
  $("register-title").textContent = state.picked?.mode === "edit" ? "Edit a Rider" : "Register a card";
  if (!state.picked) {
    form = null;
    panel.replaceChildren(el("p", "empty-note", "Pick a card from Unknown cards to give it a name and a Seat."));
    return;
  }
  if (form?.dataset.uid !== state.picked.uid || form.dataset.mode !== state.picked.mode) {
    form = buildForm(state.picked);
    panel.replaceChildren(form);
  }
  updateForm();
}

function riderButton(rider, action, label, className, onClick) {
  const button = el("button", `btn ${className}`, label);
  button.type = "button";
  button.disabled = state.saving;
  button.dataset.action = action;
  button.dataset.uid = rider.uid;
  button.addEventListener("click", onClick);
  return button;
}

const riderButtonFor = (action, uid) =>
  $("riders-list").querySelector(`[data-action="${action}"][data-uid="${CSS.escape(uid)}"]`);

function renderRiders() {
  const { rows, summary } = ridersTable(state.layout, state.riders);
  $("riders-summary").textContent = summary;
  const list = $("riders-list");
  const active = list.contains(document.activeElement) ? document.activeElement : null;
  const focused = active ? { action: active.dataset.action, uid: active.dataset.uid } : null;

  if (rows.length === 0) {
    list.replaceChildren(el("li", "empty-note", "No Riders yet. Register an Unknown Card to add one."));
    return;
  }
  list.replaceChildren(
    ...rows.map((rider) => {
      const li = el("li", "rider-admin-row");
      if (state.picked?.mode === "edit" && state.picked.uid === rider.uid) li.classList.add("is-picked");

      const who = el("span", "rider-admin-who");
      who.append(
        el("span", "rider-admin-name", rider.name),
        el("span", "rider-admin-sub", `Seat ${rider.seat}`),
        el("span", "uid", rider.uid),
      );
      li.append(who);

      const actions = el("div", "actions");
      if (state.pendingRemove === rider.uid) {
        li.classList.add("is-removing");
        const prompt = el("p", "remove-prompt", removePrompt(rider));
        prompt.id = `remove-prompt-${rider.uid}`;
        const keep = riderButton(rider, "keep", "Keep rider", "btn-secondary", () => {
          state.pendingRemove = null;
          render();
          riderButtonFor("remove", rider.uid)?.focus();
        });
        const remove = riderButton(rider, "confirm-remove", "Remove rider", "btn-danger", () => removeRider(rider));
        remove.setAttribute("aria-describedby", prompt.id);
        actions.append(keep, remove);
        li.append(prompt, actions);
      } else {
        const edit = riderButton(rider, "edit", "Edit", "btn-secondary", () => {
          state.pendingRemove = null;
          state.picked = { uid: rider.uid, mode: "edit" };
          state.name = rider.name;
          state.seat = rider.seat;
          state.message = null;
          render();
          $("rider-name")?.focus();
        });
        edit.setAttribute("aria-label", `Edit ${rider.name}`);
        const remove = riderButton(rider, "remove", "Remove", "btn-secondary", () => {
          state.pendingRemove = rider.uid;
          state.message = null;
          render();
          riderButtonFor("keep", rider.uid)?.focus();
        });
        remove.setAttribute("aria-label", `Remove ${rider.name}`);
        actions.append(edit, remove);
        li.append(actions);
      }
      return li;
    }),
  );
  if (focused) {
    const again = riderButtonFor(focused.action, focused.uid);
    if (again && !again.disabled) again.focus();
  }
}

function render() {
  const message = state.picked ? null : messageBox();
  $("message").replaceChildren(...(message ? [message] : []));
  renderUnknownList(unknownCards(state.scans, state.riders));
  renderPanel();
  renderRiders();
}

async function removeRider(rider) {
  if (state.saving) return;
  state.saving = true;
  state.message = null;
  render();

  const { data, error } = await db.from("riders").delete().eq("card_uid", rider.uid).select("card_uid");
  state.saving = false;
  state.pendingRemove = null;

  if (error) {
    state.message = { kind: "error", text: `Could not remove ${rider.name}: ${error.message}. Nothing was removed.` };
  } else if (data.length === 0) {
    state.message = {
      kind: "error",
      text: `Could not remove ${rider.name}: they were removed meanwhile, or removing is not allowed yet. Nothing was removed.`,
    };
  } else {
    if (state.picked?.uid === rider.uid) closePanel();
    state.message = { kind: "success", text: `Removed ${rider.name}. Seat ${rider.seat} is free.`, parentLink: true };
  }
  render();
  $("riders-title").focus();
  await load();
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

  const { uid, mode } = state.picked;
  const seat = state.seat;
  state.saving = true;
  state.message = null;
  render();

  // An update that matches no row returns no error (a missing RLS policy hides every row), so ask for the row back.
  const result =
    mode === "edit"
      ? await db.from("riders").update({ name, seat }).eq("card_uid", uid).select("card_uid")
      : await db.from("riders").insert({ card_uid: uid, name, seat });
  state.saving = false;
  const error =
    result.error ??
    (mode === "edit" && result.data.length === 0
      ? { message: "the Rider was removed meanwhile, or editing is not allowed yet" }
      : null);

  if (!error) {
    closePanel();
    const text = mode === "edit" ? `Saved ${name} in Seat ${seat}.` : `Registered ${name} in Seat ${seat}.`;
    state.message = { kind: "success", text, parentLink: true };
  } else {
    const where = `${error.message ?? ""} ${error.details ?? ""}`;
    if (error.code === "23505" && where.includes("riders_seat_key")) {
      state.seat = null;
      state.message = { kind: "error", text: `Seat ${seat} was just taken by another Rider. Pick another Seat. Nothing was saved.` };
    } else if (error.code === "23505" && where.includes("riders_card_uid_key")) {
      closePanel();
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
  const editing = state.picked?.mode === "edit" ? state.picked.uid : null;
  if (state.seat != null && state.riders.some((r) => r.seat === state.seat && r.card_uid !== editing)) {
    const seat = state.seat;
    state.seat = null;
    state.message = { kind: "error", text: `Seat ${seat} was just taken. Pick another Seat.` };
  }
  // Only a Rider taking the card closes the panel; a card that just dropped out
  // of today's list at midnight is still unknown and can still be registered.
  if (state.picked?.mode === "register" && state.riders.some((r) => r.card_uid === state.picked.uid)) {
    closePanel();
    state.message = { kind: "info", text: "That card was registered elsewhere, so it is no longer an Unknown Card." };
  }
  if (editing && !editedRider()) {
    closePanel();
    state.message = { kind: "info", text: "That Rider was removed elsewhere, so there is nothing to edit." };
  }
  if (state.pendingRemove && !state.riders.some((r) => r.card_uid === state.pendingRemove)) state.pendingRemove = null;
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

function drawDate() {
  $("today").textContent =
    "Admin · " + new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function scheduleMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  setTimeout(() => {
    drawDate();
    load();
    scheduleMidnight();
  }, next - now + 1000);
}

drawDate();
scheduleMidnight();

db.channel("admin")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "scans" }, load)
  .on("postgres_changes", { event: "*", schema: "public", table: "riders" }, load)
  .subscribe((status) => {
    // Catch up on Taps missed before the first join or while offline.
    if (status === "SUBSCRIBED") load();
  });

load();
