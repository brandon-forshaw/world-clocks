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
    const days = document.createElement("span");
    days.className = "days";
    days.title = "Working days";
    const onDays = Array.isArray(n.days) && n.days.length ? n.days : DEFAULT_DAYS;
    for (const d of [1, 2, 3, 4, 5, 6, 0]) {
      const l = document.createElement("label");
      l.className = "day";
      const cb = input("checkbox", onDays.includes(d), { "data-day": d });
      l.append(cb, document.createTextNode(WEEKDAYS[d].slice(0, 2)));
      days.append(l);
    }
    const syncDays = () => days.classList.toggle("disabled", always.checked);
    always.addEventListener("change", syncDays);
    syncDays();
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
    toggles.append(days, tog("24/7", always), tog("Observes holidays", observes), tog("Home", home));

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
  if ($("d-clock")) collectDisplay();
  if ($("clients")) collectClients();
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
    const picked = [...row.querySelectorAll("[data-day]")].filter((c) => c.checked).map((c) => Number(c.dataset.day)).sort();
    if (picked.join() !== DEFAULT_DAYS.join()) node.days = picked;
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

// ---- Client links ----
// One block per client (group). Optional environments; each link has one
// address for every environment, or one per environment.
const groupNames = () => [...new Set(work.nodes.map((n) => (n.group || n.name || "").trim()).filter(Boolean))];
const parseEnvs = (t) => [...new Set((t || "").split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];

const TYPE_LABELS = { one: "One address", env: "Per environment", pattern: "Pattern" };

function renderClients() {
  const root = $("clients");
  root.innerHTML = "";
  work.clients = work.clients || {};
  for (const name of groupNames()) {
    const c = work.clients[name] || { envs: [], links: [] };
    const envs = (c.envs || []).filter(Boolean);
    const box = document.createElement("div");
    box.className = "client";
    box.dataset.client = name;

    const head = document.createElement("div");
    head.className = "client-head";
    const b = document.createElement("b");
    b.textContent = name;
    const envIn = input("text", envs.join(", "), { placeholder: "Environments, optional: e.g. DV, QA, ST, NP etc.", "data-c": "envs" });
    envIn.addEventListener("change", () => { collect(); renderClients(); });
    const shortIn = input("text", c.short || "", { placeholder: "Short name, for $client", "data-c": "short" });
    shortIn.addEventListener("input", () => updatePreviews(box));
    head.append(b, envIn, shortIn);
    box.append(head);

    const links = c.links || [];
    const cols = Math.max(1, envs.length);
    const grid = document.createElement("div");
    grid.className = "ltable";
    grid.style.gridTemplateColumns = "200px 150px repeat(" + cols + ", minmax(0, 1fr)) 34px";
    if (links.length) {
      const hdr = (t) => { const h = document.createElement("span"); h.className = "lt-h"; h.textContent = t; return h; };
      grid.append(hdr("Label"), hdr("Type"));
      const perEnv = envs.length && links.some((l) => linkType(l) === "env");
      if (perEnv) for (const e of envs) grid.append(hdr(e));
      else { const a = hdr("Address"); a.style.gridColumn = "span " + cols; grid.append(a); }
      grid.append(hdr(""));
    }
    links.forEach((l, j) => {
      let type = linkType(l);
      if (type === "env" && !envs.length) type = "one";
      const row = document.createElement("div");
      row.className = "lt-row";
      row.dataset.type = type;
      row.dataset.skip = JSON.stringify(type === "pattern" ? (l.skip || []).filter((e) => envs.includes(e)) : []);
      row.append(input("text", l.label, { placeholder: "e.g. BOS admin", "data-l": "label" }));

      const typeSel = document.createElement("select");
      typeSel.dataset.l = "type";
      for (const t of envs.length ? ["one", "env", "pattern"] : ["one", "pattern"]) {
        const o = document.createElement("option");
        o.value = t;
        o.textContent = TYPE_LABELS[t];
        typeSel.append(o);
      }
      typeSel.value = type;
      typeSel.addEventListener("change", () => { markDirty(); collect(); renderClients(); });
      row.append(typeSel);

      if (type === "env") {
        for (const e of envs) row.append(input("text", (l.urls || {})[e] || "", { placeholder: e + " address", "data-env": e }));
      } else {
        const isPat = type === "pattern";
        const val = isPat ? (l.pattern || "") : (l.url !== undefined ? l.url : Object.values(l.urls || {})[0] || "");
        const u = input("text", val, {
          placeholder: isPat ? "https://$environment-bosadmin.$client.example.net" : "https://",
          "data-l": isPat ? "pattern" : "url",
        });
        u.style.gridColumn = "span " + cols;
        if (isPat) u.addEventListener("input", () => updatePreviews(box));
        row.append(u);
      }

      const del = document.createElement("button");
      del.className = "icon-btn";
      del.textContent = "✕";
      del.title = "Remove this link";
      del.addEventListener("click", () => { collect(); work.clients[name].links.splice(j, 1); markDirty(); renderClients(); });
      row.append(del);

      if (type === "pattern") {
        const prev = document.createElement("div");
        prev.className = "lt-preview";
        row.append(prev);
      }
      grid.append(row);
    });
    box.append(grid);

    const add = document.createElement("button");
    add.className = "btn small";
    add.textContent = "+ Add link";
    add.addEventListener("click", () => {
      collect();
      const cc = work.clients[name] || (work.clients[name] = { envs: [], links: [] });
      cc.links = (cc.links || []).concat([envs.length ? { label: "", urls: {} } : { label: "", url: "" }]);
      markDirty();
      renderClients();
      const rows = root.querySelector(".client[data-client=\"" + CSS.escape(name) + "\"]").querySelectorAll(".lt-row");
      rows[rows.length - 1].querySelector("[data-l=label]").focus();
    });
    box.append(add);
    root.append(box);
    updatePreviews(box);
  }
}

// Under each pattern, show what it expands to for every environment.
function updatePreviews(box) {
  const envs = parseEnvs(box.querySelector("[data-c=envs]").value);
  const short = box.querySelector("[data-c=short]").value.trim();
  for (const row of box.querySelectorAll(".lt-row[data-type=pattern]")) {
    const prev = row.querySelector(".lt-preview");
    const pat = row.querySelector("[data-l=pattern]").value.trim();
    prev.innerHTML = "";
    if (!pat) { prev.textContent = "Use $environment and $client in the address."; continue; }
    PATTERN_CLIENT.lastIndex = 0;
    if (PATTERN_CLIENT.test(pat) && !short) { PATTERN_CLIENT.lastIndex = 0; prev.textContent = "Add the client's short name to fill in $client."; prev.classList.add("warn"); continue; }
    PATTERN_CLIENT.lastIndex = 0;
    prev.classList.remove("warn");
    const skip = JSON.parse(row.dataset.skip || "[]");
    for (const e of envs.length ? envs : [""]) {
      const line = document.createElement("label");
      line.className = "pv-line" + (skip.includes(e) ? " skipped" : "");
      const url = expandPattern(pat, e, short);
      if (e) {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !skip.includes(e);
        cb.title = "Use the pattern for " + e;
        cb.addEventListener("change", () => {
          const now = JSON.parse(row.dataset.skip || "[]").filter((x) => x !== e);
          if (!cb.checked) now.push(e);
          row.dataset.skip = JSON.stringify(now);
          line.classList.toggle("skipped", !cb.checked);
          markDirty();
        });
        const tag = document.createElement("b");
        tag.textContent = e;
        line.append(cb, tag);
      }
      const code = document.createElement("span");
      code.textContent = url;
      if (!isWebUrl(url)) code.className = "bad";
      line.append(code);
      prev.append(line);
    }
  }
}

// Remove blank link rows, and clients with nothing set, before saving/exporting.
function pruneClients(cfg) {
  const out = {};
  for (const [name, c] of Object.entries(cfg.clients || {})) {
    const links = (c.links || []).filter((l) => (l.label || "").trim() || (l.url || "").trim() ||
      (l.pattern || "").trim() || Object.values(l.urls || {}).some(Boolean));
    if ((c.envs || []).length || links.length || c.short) out[name] = { envs: c.envs || [], short: c.short || "", links };
  }
  cfg.clients = out;
}

// Best guess at a pattern from per-environment addresses: swap the first
// environment's name and the short name for $environment and $client.
function guessPattern(urls, envs, short) {
  const e = envs.find((x) => urls[x]);
  if (!e) return "";
  let p = urls[e].replace(new RegExp(e, "ig"), "$environment");
  if (short) p = p.replace(new RegExp("\\b" + short.replace(/[^a-z0-9-]/gi, "") + "\\b", "ig"), "$client");
  return p;
}

function collectClients() {
  const out = {};
  for (const box of $("clients").querySelectorAll(".client")) {
    const name = box.dataset.client;
    const envs = parseEnvs(box.querySelector("[data-c=envs]").value);
    const short = box.querySelector("[data-c=short]").value.trim().toLowerCase();
    const links = [];
    for (const row of box.querySelectorAll(".lt-row")) {
      const label = row.querySelector("[data-l=label]").value.trim();
      const was = row.dataset.type;
      let want = row.querySelector("[data-l=type]").value;
      if (want === "env" && !envs.length) want = "one";
      // What the row holds now, in its current (rendered) type
      let one = "", urls = {}, pattern = "";
      const skip = JSON.parse(row.dataset.skip || "[]").filter((e) => envs.includes(e));
      if (was === "env") {
        for (const u of row.querySelectorAll("[data-env]")) if (u.value.trim()) urls[u.dataset.env] = u.value.trim();
      } else if (was === "pattern") pattern = row.querySelector("[data-l=pattern]").value.trim();
      else one = row.querySelector("[data-l=url]").value.trim();
      // Convert when the type was changed
      let link;
      if (want === "pattern") {
        link = { label, pattern: was === "pattern" ? pattern : was === "env" ? guessPattern(urls, envs, short) : one };
        // keep unticked environments; from per-environment, skip the empty ones
        const sk = was === "pattern" ? skip : was === "env" ? envs.filter((e) => !urls[e]) : [];
        // (all unticked is kept so validation can flag it; from per-environment, all empty means none set)
        if (sk.length && (was === "pattern" || sk.length < envs.length)) link.skip = sk;
      } else if (want === "env") {
        if (was === "env") link = { label, urls };
        else link = { label, urls: Object.fromEntries(envs.filter((e) => !(was === "pattern" && skip.includes(e))).map((e) => [e, was === "pattern" ? expandPattern(pattern, e, short) : one])) };
        for (const k of Object.keys(link.urls)) if (!envs.includes(k) || !link.urls[k]) delete link.urls[k];
      } else {
        link = { label, url: was === "one" ? one : was === "env" ? (Object.values(urls)[0] || "") : expandPattern(pattern, envs[0] || "", short) };
      }
      links.push(link);  // blank rows are kept while editing; pruneClients() drops them on save
    }
    if (envs.length || links.length || short) out[name] = { envs, short, links };
  }
  work.clients = out;
}

// ---- Display settings ----
function sel(id, options, value) {
  const s = document.createElement("select");
  s.id = id;
  for (const [v, t] of options) {
    const o = document.createElement("option");
    o.value = String(v);
    o.textContent = t;
    s.append(o);
  }
  s.value = String(value);
  s.addEventListener("change", markDirty);
  return s;
}
function check(id, value, text) {
  const l = document.createElement("label");
  l.className = "tog";
  const c = input("checkbox", value, { id });
  l.append(c, document.createTextNode(" " + text));
  return l;
}
function row(label, ...controls) {
  const r = document.createElement("div");
  r.className = "drow";
  const h = document.createElement("span");
  h.className = "dlabel";
  h.textContent = label;
  const c = document.createElement("span");
  c.className = "dcontrols";
  c.append(...controls);
  r.append(h, c);
  return r;
}

// Date style names with a live example in the chosen language.
function dateStyleOptions(locale) {
  const ex = new Date(Date.UTC(2026, 10, 17, 12));
  return Object.entries(DATE_STYLES).map(([k, v]) => {
    let sample;
    try {
      sample = v.opts ? new Intl.DateTimeFormat(locale || undefined, Object.assign({ timeZone: "UTC" }, v.opts)).format(ex) : "2026-11-17";
    } catch (e) { sample = ""; }
    return [k, v.label + ": " + sample];
  });
}

function renderDisplay() {
  const d = mergeDisplay(work.display);
  const box = $("display");
  box.innerHTML = "";
  const dateSel = sel("d-dateStyle", dateStyleOptions(d.locale), d.dateStyle);
  const locSel = sel("d-locale", LOCALES, d.locale);
  locSel.addEventListener("change", () => {
    const keep = dateSel.value;
    const fresh = sel("d-dateStyle", dateStyleOptions(locSel.value), keep);
    dateSel.replaceWith(fresh);
  });
  const themeSel = sel("d-theme", [["dark", "Dark"], ["light", "Light"], ["system", "Follow system"]], d.theme);
  themeSel.addEventListener("change", () => applyTheme({ theme: themeSel.value }));
  const fromOpts = [["home", "Home"], ["UTC", "UTC"]].concat(work.nodes.filter((n) => n.name && !n.home).map((n) => [n.name, n.name]));
  box.append(
    row("Time",
      sel("d-clock", [["24", "24-hour"], ["12", "12-hour"]], d.clock),
      check("d-seconds", d.seconds, "Show seconds on cards")),
    row("Date", dateSel, locSel),
    row("Look", themeSel,
      sel("d-motion", [["system", "Reduce motion: follow Firefox"], ["on", "Reduce motion: on"], ["off", "Reduce motion: off"]], d.motion)),
    row("Globe",
      check("d-globe-show", d.globe.show, "Show globe"),
      check("d-globe-spin", d.globe.spin, "Spin"),
      sel("d-globe-speed", [[0.5, "Slow"], [1, "Normal"], [2, "Fast"]], d.globe.speed),
      check("d-globe-arcs", d.globe.arcs, "Arcs"),
      check("d-globe-pulses", d.globe.pulses, "Pulses"),
      check("d-globe-night", d.globe.night, "Night shading")),
    row("Pills", sel("d-sort", [["order", "Your order"], ["status", "Online first"], ["tz", "By time zone, west to east"]], d.sortPills)),
    row("Bottom panel", sel("d-openTab", [["last", "Open on: last used tab"], ["overlap", "Open on: Find a time"], ["convert", "Open on: Convert a time"], ["holidays", "Open on: Upcoming holidays"]], d.openTab)),
    row("Converter",
      sel("d-convDuration", [[0, "No length"], [15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "1 hour"], [90, "1h 30m"], [120, "2 hours"], [180, "3 hours"]], d.convDuration),
      sel("d-convFrom", fromOpts, fromOpts.some(([v]) => v === d.convFrom) ? d.convFrom : "home")),
  );
}

function collectDisplay() {
  const g = (id) => $(id);
  work.display = {
    clock: g("d-clock").value,
    seconds: g("d-seconds").checked,
    dateStyle: g("d-dateStyle").value,
    locale: g("d-locale").value,
    theme: g("d-theme").value,
    motion: g("d-motion").value,
    globe: {
      show: g("d-globe-show").checked,
      spin: g("d-globe-spin").checked,
      speed: Number(g("d-globe-speed").value),
      arcs: g("d-globe-arcs").checked,
      pulses: g("d-globe-pulses").checked,
      night: g("d-globe-night").checked,
    },
    sortPills: g("d-sort").value,
    openTab: g("d-openTab").value,
    convDuration: Number(g("d-convDuration").value),
    convFrom: g("d-convFrom").value,
  };
}

function renderAll() {
  renderDisplay();
  if ($("clients")) renderClients();
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
  pruneClients(work);
  work.customHolidays.sort((x, y) => (x.date || "").localeCompare(y.date || ""));
  const errs = validateConfig(work);
  showErrors(errs);
  if (errs.length) { setStatus("Not saved", "bad"); return; }
  try {
    await saveConfig(work);
    dirty = false;
    renderClients();  // show the tidied list (blank rows removed)
    setStatus("Saved", "good");
  } catch (e) {
    setStatus("Couldn't save: " + e.message, "bad");
  }
}

function exportJson() {
  collect();
  pruneClients(work);
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
  applyTheme(mergeDisplay(work.display));

  const dl = $("tz-list");
  const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [];
  for (const z of zones) {
    const o = document.createElement("option");
    o.value = z;
    dl.append(o);
  }

  renderAll();
  $("sites").addEventListener("change", (e) => {
    const k = e.target.dataset && e.target.dataset.k;
    if (k === "group" || k === "name") { collect(); renderClients(); }
  });
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
