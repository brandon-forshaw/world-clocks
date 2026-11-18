// ---- Settings page --------------------------------------------------------------
// Works on a copy of the config; nothing is stored until Save.
let work = null;
let dirty = false;
let resetArmed = false;

const $ = (id) => document.getElementById(id);

function setStatus(text, kind) {
  const el = $("status");
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

function markDirty() {
  dirty = true;
  setStatus("Unsaved changes", "warn");
}

// Google Maps copies "lat, lon"; we store [lon, lat].
function coordsToText(c) {
  return Array.isArray(c) && c.length === 2 ? c[1] + ", " + c[0] : "";
}
function textToCoords(t) {
  const m = (t || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return [Number(Number(m[2]).toFixed(4)), Number(Number(m[1]).toFixed(4))];
}

function field(labelText, input, cls) {
  const l = document.createElement("label");
  l.className = "f" + (cls ? " " + cls : "");
  const s = document.createElement("span");
  s.textContent = labelText;
  l.append(s, input);
  return l;
}

function input(type, value, attrs) {
  const i = document.createElement("input");
  i.type = type;
  if (type === "checkbox" || type === "radio") i.checked = !!value;
  else i.value = value == null ? "" : value;
  for (const [k, v] of Object.entries(attrs || {})) i.setAttribute(k, v);
  i.addEventListener("input", markDirty);
  i.addEventListener("change", markDirty);
  return i;
}

function renderSites() {
  const root = $("sites");
  root.innerHTML = "";
  work.nodes.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "site" + (n.home ? " is-home" : "");
    row.dataset.index = i;

    const name = input("text", n.name, { placeholder: "e.g. Client A", "data-k": "name" });
    const group = input("text", n.group, { placeholder: "same as name", list: "group-list", "data-k": "group" });
    const city = input("text", n.city, { placeholder: "e.g. Toronto", "data-k": "city" });
    const tz = input("text", n.tz, { placeholder: "e.g. America/Toronto", list: "tz-list", "data-k": "tz" });
    const coords = input("text", coordsToText(n.coords), { placeholder: "lat, lon", "data-k": "coords" });

    const region = document.createElement("select");
    region.dataset.k = "region";
    for (const [code, label] of Object.entries(REGIONS)) {
      const o = document.createElement("option");
      o.value = code;
      o.textContent = label;
      region.append(o);
    }
    region.value = n.region || "";
    region.addEventListener("change", markDirty);

    const allDay = n.hours === "24/7";
    const hours = input("text", allDay ? "" : (n.hours || ""), { placeholder: "default", title: "Leave blank to use the default hours", "data-k": "hours" });
    hours.disabled = allDay;
    const always = input("checkbox", allDay, { "data-k": "always" });
    always.addEventListener("change", () => { hours.disabled = always.checked; });
    const observes = input("checkbox", n.observesHolidays !== false, { "data-k": "observes" });
    const home = input("radio", n.home, { name: "home", "data-k": "home" });
    home.addEventListener("change", () => {
      for (const r of root.querySelectorAll(".site")) r.classList.toggle("is-home", r.querySelector("[data-k=home]").checked);
    });

    const fields = document.createElement("div");
    fields.className = "fields";
    fields.append(
      field("Name", name, "w-name"),
      field("Group", group, "w-group"),
      field("City", city, "w-city"),
      field("Time zone", tz, "w-tz"),
      field("Coordinates", coords, "w-coords"),
      field("Holidays", region, "w-region"),
      field("Hours", hours, "w-hours"),
    );

    const toggles = document.createElement("div");
    toggles.className = "toggles";
    const tog = (labelText, el) => {
      const l = document.createElement("label");
      l.className = "tog";
      l.append(el, document.createTextNode(" " + labelText));
      return l;
    };
    toggles.append(tog("24/7", always), tog("Observes holidays", observes), tog("Home", home));

    const tools = document.createElement("div");
    tools.className = "tools";
    const tool = (text, title, fn, disabled) => {
      const b = document.createElement("button");
      b.className = "icon-btn";
      b.textContent = text;
      b.title = title;
      b.disabled = !!disabled;
      b.addEventListener("click", () => { collect(); fn(); markDirty(); renderSites(); });
      return b;
    };
    tools.append(
      tool("↑", "Move up", () => { const [x] = work.nodes.splice(i, 1); work.nodes.splice(i - 1, 0, x); }, i === 0),
      tool("↓", "Move down", () => { const [x] = work.nodes.splice(i, 1); work.nodes.splice(i + 1, 0, x); }, i === work.nodes.length - 1),
      tool("✕", "Remove this site", () => { work.nodes.splice(i, 1); }, work.nodes.length === 1),
    );
    toggles.append(tools);

    row.append(fields, toggles);
    root.append(row);
  });
  refreshGroupList();
}

function refreshGroupList() {
  const dl = $("group-list");
  dl.innerHTML = "";
  const names = new Set(work.nodes.map((n) => (n.group || n.name || "").trim()).filter(Boolean));
  for (const g of names) {
    const o = document.createElement("option");
    o.value = g;
    dl.append(o);
  }
}

// Read the form back into `work`.
function collect() {
  work.defaultHours = $("defaultHours").value.trim() || DEFAULT_CONFIG.defaultHours;
  work.soonMinutes = Number($("soonMinutes").value);
  const rows = [...$("sites").querySelectorAll(".site")];
  work.nodes = rows.map((row) => {
    const v = (k) => row.querySelector("[data-k=" + k + "]");
    const node = {
      name: v("name").value.trim(),
      group: v("group").value.trim() || v("name").value.trim(),
      city: v("city").value.trim(),
      region: v("region").value,
      tz: v("tz").value.trim(),
      coords: textToCoords(v("coords").value),
    };
    if (v("always").checked) node.hours = "24/7";
    else if (v("hours").value.trim()) node.hours = v("hours").value.trim();
    if (!v("observes").checked) node.observesHolidays = false;
    if (v("home").checked) node.home = true;
    return node;
  });  work.customHolidays = [...$("extra-hols").querySelectorAll(".hol-row")].map((row) => ({
    region: row.querySelector("[data-k=hregion]").value,
    date: row.querySelector("[data-k=hdate]").value,
    name: row.querySelector("[data-k=hname]").value.trim(),
  }));
}

function showErrors(errs) {
  const box = $("errors");
  box.innerHTML = "";
  box.hidden = !errs.length;
  if (!errs.length) return;
  const h = document.createElement("strong");
  h.textContent = "Can't save yet:";
  const ul = document.createElement("ul");
  for (const e of errs) {
    const li = document.createElement("li");
    li.textContent = e;
    ul.append(li);
  }
  box.append(h, ul);
}

function renderAll() {
  $("defaultHours").value = work.defaultHours || DEFAULT_CONFIG.defaultHours;
  $("soonMinutes").value = work.soonMinutes == null ? DEFAULT_CONFIG.soonMinutes : work.soonMinutes;
  renderSites();
  renderHolidays();
  renderWarnings();
}

// ---- Extra holidays ----
function renderHolidays() {
  const root = $("extra-hols");
  root.innerHTML = "";
  const list = work.customHolidays || [];
  if (!list.length) {
    const p = document.createElement("div");
    p.className = "hol-empty";
    p.textContent = "None added.";
    root.append(p);
  }
  list.forEach((h, i) => {
    const row = document.createElement("div");
    row.className = "hol-row";
    const region = document.createElement("select");
    region.dataset.k = "hregion";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Holiday region...";
    region.append(blank);
    for (const [code, label] of Object.entries(REGIONS)) {
      if (!code) continue;
      const o = document.createElement("option");
      o.value = code;
      o.textContent = label;
      region.append(o);
    }
    region.value = h.region || "";
    const date = input("date", h.date, { "data-k": "hdate" });
    const name = input("text", h.name, { placeholder: "e.g. Diwali", "data-k": "hname" });
    const del = document.createElement("button");
    del.className = "icon-btn";
    del.textContent = "✕";
    del.title = "Remove this holiday";
    del.addEventListener("click", () => { collect(); work.customHolidays.splice(i, 1); markDirty(); renderHolidays(); renderWarnings(); });
    for (const el of [region, date, name]) {
      el.addEventListener("change", () => { markDirty(); collect(); renderWarnings(); });
    }
    row.append(region, date, name, del);
    root.append(row);
  });
}

// Warnings use the form as it stands, so they clear as soon as you add the dates.
function renderWarnings() {
  const box = $("hol-warnings");
  box.innerHTML = "";
  if (typeof Holidays === "undefined" || !Holidays.missingData) return;
  Holidays.setCustom(work.customHolidays || []);
  const regions = [...new Set(work.nodes.filter((n) => n.observesHolidays !== false).map((n) => n.region).filter(Boolean))];
  for (const w of Holidays.missingData(regions, new Date())) {
    const d = document.createElement("div");
    d.className = "hol-warn " + w.level;
    d.textContent = w.text;
    box.append(d);
  }
}

async function save() {
  collect();
  work.customHolidays.sort((x, y) => (x.date || "").localeCompare(y.date || ""));
  const errs = validateConfig(work);
  showErrors(errs);
  if (errs.length) { setStatus("Not saved", "bad"); return; }
  try {
    await saveConfig(work);
    dirty = false;
    setStatus("Saved", "good");
  } catch (e) {
    setStatus("Couldn't save: " + e.message, "bad");
  }
}

function exportJson() {
  collect();
  const blob = new Blob([JSON.stringify(work, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "world-clocks-settings.json";
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  setStatus("Exported", "good");
}

async function importJson(file) {
  try {
    const data = JSON.parse(await file.text());
    const errs = validateConfig(data);
    if (errs.length) { showErrors(errs); setStatus("That file has problems, nothing changed", "bad"); return; }
    work = data;
    renderAll();
    showErrors([]);
    markDirty();
    setStatus("Loaded from file. Check it, then Save.", "warn");
  } catch (e) {
    setStatus("Couldn't read that file: " + e.message, "bad");
  }
}

async function reset() {
  if (!resetArmed) {
    resetArmed = true;
    $("reset").textContent = "Click again to reset";
    setTimeout(() => { resetArmed = false; $("reset").textContent = "Reset to defaults"; }, 3000);
    return;
  }
  resetArmed = false;
  $("reset").textContent = "Reset to defaults";
  try { await resetConfig(); } catch (e) { /* not in the extension */ }
  work = clone(DEFAULT_CONFIG);
  renderAll();
  showErrors([]);
  dirty = false;
  setStatus("Reset to defaults", "good");
}

async function main() {
  work = clone(await loadConfig());

  const dl = $("tz-list");
  const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [];
  for (const z of zones) {
    const o = document.createElement("option");
    o.value = z;
    dl.append(o);
  }

  renderAll();
  $("defaultHours").addEventListener("input", markDirty);
  $("soonMinutes").addEventListener("input", markDirty);
  $("add-hol").addEventListener("click", () => {
    collect();
    work.customHolidays = (work.customHolidays || []).concat([{ region: "", date: "", name: "" }]);
    renderHolidays();
    markDirty();
    const rows = $("extra-hols").querySelectorAll(".hol-row");
    rows[rows.length - 1].querySelector("[data-k=hregion]").focus();
  });
  $("add").addEventListener("click", () => {
    collect();
    work.nodes.push({ name: "", group: "", city: "", region: "", tz: "", coords: null });
    renderSites();
    markDirty();
    const rows = $("sites").querySelectorAll(".site");
    rows[rows.length - 1].querySelector("[data-k=name]").focus();
  });
  $("save").addEventListener("click", save);
  $("export").addEventListener("click", exportJson);
  $("import").addEventListener("change", (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; });
  $("reset").addEventListener("click", reset);
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
}

main();
