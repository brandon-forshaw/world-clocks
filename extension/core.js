// ---- Shared by the new tab page, the toolbar popup and the settings page ----
// Sites live in Firefox's synced storage (edit them on the settings page).
// DEFAULT_CONFIG is what you get before saving anything, or after "Reset".

const ext = globalThis.browser || null;

const DEFAULT_CONFIG = {
  defaultHours: "09:00-17:30",
  soonMinutes: 30,
  // A neutral sample list. Your own sites are saved from the settings page.
  nodes: [
    { name: "London",            group: "Home",     city: "London",       region: "GB-ENG", tz: "Europe/London",       coords: [-0.128, 51.507],  home: true },
    { name: "Client A",          group: "Client A", city: "Toronto",      region: "CA-ON",  tz: "America/Toronto",     coords: [-79.383, 43.653] },
    { name: "Client B (Melbourne)", group: "Client B", city: "Melbourne",    region: "AU-VIC", tz: "Australia/Melbourne", coords: [144.963, -37.814] },
    { name: "Client B (India)",  group: "Client B", city: "Noida",        region: "IN",     tz: "Asia/Kolkata",        coords: [77.391, 28.535] },
    { name: "Client C",          group: "Client C", city: "Johannesburg", region: "ZA",     tz: "Africa/Johannesburg", coords: [28.047, -26.204] },
    { name: "Support (24/7)",    group: "Support",  city: "Sofia",        region: "BG",     tz: "Europe/Sofia",        coords: [23.322, 42.698],  hours: "24/7", observesHolidays: false },
  ],
  customHolidays: [],
  display: {},
};

// Display and behaviour settings. Anything missing from a saved config falls
// back to these, so older saved settings keep working.
const DEFAULT_DISPLAY = {
  clock: "24",            // "24" or "12"
  seconds: true,          // seconds on the cards
  dateStyle: "short",     // see DATE_STYLES
  locale: "",             // "" = the browser's language
  theme: "dark",          // "dark", "light" or "system"
  motion: "system",       // reduce motion: "system", "on" (reduce) or "off"
  globe: { show: true, spin: true, speed: 1, arcs: true, pulses: true, night: true },
  openTab: "last",        // "last", "overlap" or "convert"
  convDuration: 60,       // converter's default meeting length, minutes
  convFrom: "home",       // "home", "UTC" or a site's name
  sortPills: "order",     // "order", "status" or "tz"
};

const DATE_STYLES = {
  short:       { label: "Short",                opts: { weekday: "short", day: "numeric", month: "short" } },
  shortYear:   { label: "Short with year",      opts: { weekday: "short", day: "numeric", month: "short", year: "numeric" } },
  long:        { label: "Long",                 opts: { weekday: "long", day: "numeric", month: "long" } },
  full:        { label: "Full",                 opts: { weekday: "long", day: "numeric", month: "long", year: "numeric" } },
  numeric:     { label: "Numbers",              opts: { day: "2-digit", month: "2-digit" } },
  numericYear: { label: "Numbers with year",    opts: { day: "2-digit", month: "2-digit", year: "numeric" } },
  iso:         { label: "ISO (2026-11-17)",     opts: null },
};

const LOCALES = [
  ["", "Browser default"], ["en-GB", "English (UK)"], ["en-IE", "English (Ireland)"], ["en-US", "English (US)"],
  ["en-CA", "English (Canada)"], ["en-AU", "English (Australia)"], ["en-ZA", "English (South Africa)"],
  ["en-IN", "English (India)"], ["bg-BG", "Bulgarian"], ["de-DE", "German"], ["fr-FR", "French"],
  ["es-ES", "Spanish"], ["it-IT", "Italian"], ["nl-NL", "Dutch"], ["pl-PL", "Polish"], ["pt-PT", "Portuguese"],
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_DAYS = [1, 2, 3, 4, 5];

function mergeDisplay(d) {
  const x = Object.assign({}, DEFAULT_DISPLAY, d || {});
  x.globe = Object.assign({}, DEFAULT_DISPLAY.globe, (d && d.globe) || {});
  if (!DATE_STYLES[x.dateStyle]) x.dateStyle = DEFAULT_DISPLAY.dateStyle;
  try { if (x.locale) new Intl.DateTimeFormat(x.locale); } catch (e) { x.locale = ""; }
  return x;
}

// Links and environments per client (group name), set by prepareNodes().
let CLIENTS = {};

// Current display settings, set by prepareNodes().
let DISPLAY = mergeDisplay({});
const displayLocale = () => DISPLAY.locale || undefined;

const REGIONS = {
  "GB-ENG": "UK: England & Wales",
  "IE": "Ireland",
  "CA-ON": "Canada: Ontario",
  "CA-AB": "Canada: Alberta",
  "AU-VIC": "Australia: Victoria",
  "ZA": "South Africa",
  "BG": "Bulgaria",
  "IN": "India",
  "": "None",
};

// Look per status: badge text/class, marker, halo, and connection-line colour.
const STATUS = {
  online:   { text: "Online",        cls: "on",    mark: "#3ddc84", halo: "rgba(61,220,132,0.4)",  line: "rgba(61,220,132,0.45)" },
  arriving: { text: "Starting soon", cls: "soon",  mark: "#f5b83d", halo: "rgba(245,184,61,0.4)",  line: "rgba(245,184,61,0.45)" },
  leaving:  { text: "Leaving soon",  cls: "leave", mark: "#f4685c", halo: "rgba(244,104,92,0.4)",  line: "rgba(244,104,92,0.45)" },
  holiday:  { text: "Holiday",       cls: "hol",   mark: "#b18cff", halo: null,                    line: "rgba(177,140,255,0.3)" },
  offline:  { text: "Offline",       cls: "off",   mark: "#5a6373", halo: null,                    line: "rgba(120,130,150,0.25)" },
};
const RANK = { online: 4, leaving: 3, arriving: 2, holiday: 1, offline: 0 };

// Set from the loaded config by prepareNodes().
let DEFAULT_HOURS = DEFAULT_CONFIG.defaultHours;
let SOON = DEFAULT_CONFIG.soonMinutes;

// ---- Config storage ----------------------------------------------------------
const clone = (o) => JSON.parse(JSON.stringify(o));

async function loadConfig() {
  try {
    if (ext && ext.storage && ext.storage.sync) {
      const r = await ext.storage.sync.get("config");
      if (r.config && Array.isArray(r.config.nodes) && r.config.nodes.length) return r.config;
    }
  } catch (e) {
    console.warn("Couldn't read saved settings, using defaults:", e);
  }
  return clone(DEFAULT_CONFIG);
}

async function saveConfig(cfg) {
  if (!ext || !ext.storage) throw new Error("Settings can only be saved from inside the extension.");
  await ext.storage.sync.set({ config: cfg });
}

async function resetConfig() {
  if (ext && ext.storage) await ext.storage.sync.remove("config");
}

function onConfigChange(cb) {
  if (ext && ext.storage && ext.storage.onChanged) {
    ext.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && "config" in changes) cb();
    });
  }
}

// Returns a list of problems, empty if the config is usable.
function validateConfig(cfg) {
  const errs = [];
  if (!cfg || !Array.isArray(cfg.nodes) || !cfg.nodes.length) return ["There must be at least one site."];
  if (parseHoursStrict(cfg.defaultHours || "") === null) errs.push("Default hours must look like 09:00-17:30.");
  if (!(Number(cfg.soonMinutes) >= 0 && Number(cfg.soonMinutes) <= 180)) errs.push("'Soon' warning must be 0 to 180 minutes.");
  const names = new Set();
  cfg.nodes.forEach((n, i) => {
    const where = "Site " + (i + 1) + (n.name ? " (" + n.name + ")" : "");
    if (!n.name || !n.name.trim()) errs.push(where + ": needs a name.");
    else if (names.has(n.name.trim())) errs.push(where + ": name is used twice.");
    names.add((n.name || "").trim());
    try { new Intl.DateTimeFormat("en-GB", { timeZone: n.tz }); }
    catch (e) { errs.push(where + ": '" + n.tz + "' isn't a time zone."); }
    const c = n.coords || [];
    if (!(Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90)) errs.push(where + ": coordinates are missing or out of range.");
    if (n.hours && n.hours !== "24/7" && parseHoursStrict(n.hours) === null) errs.push(where + ": hours must look like 09:00-17:30 or 24/7.");
    if (n.region && !(n.region in REGIONS)) errs.push(where + ": unknown holiday region '" + n.region + "'.");
    if (n.days !== undefined && n.hours !== "24/7" &&
        (!Array.isArray(n.days) || !n.days.length || n.days.some((d) => !(d >= 0 && d <= 6)))) {
      errs.push(where + ": pick at least one working day.");
    }
  });
  (cfg.customHolidays || []).forEach((h, i) => {
    const where = "Extra holiday " + (i + 1) + (h && h.name ? " (" + h.name + ")" : "");
    if (!h || !h.region || !(h.region in REGIONS)) errs.push(where + ": pick a holiday region.");
    if (!h || !/^\d{4}-\d{2}-\d{2}$/.test(h.date || "") || isNaN(Date.parse(h.date))) errs.push(where + ": needs a date.");
    if (!h || !(h.name || "").trim()) errs.push(where + ": needs a name.");
  });
  for (const [client, c] of Object.entries(cfg.clients || {})) {
    (c.links || []).forEach((l, j) => {
      const where = client + ", link " + (j + 1) + (l.label ? " (" + l.label + ")" : "");
      if (!(l.label || "").trim()) errs.push(where + ": needs a label.");
      const urls = l.url !== undefined ? [l.url] : Object.values(l.urls || {});
      if (!urls.filter(Boolean).length) errs.push(where + ": needs at least one address.");
      for (const u of urls.filter(Boolean)) {
        let ok = false;
        try { const x = new URL(u); ok = x.protocol === "https:" || x.protocol === "http:"; } catch (e) { /* bad */ }
        if (!ok) errs.push(where + ": '" + u + "' must start with https:// (or http://).");
      }
    });
  }
  const homes = cfg.nodes.filter((n) => n.home).length;
  if (homes !== 1) errs.push("Exactly one site must be marked as home (" + homes + " are).");
  return errs;
}

// ---- Hours ---------------------------------------------------------------
function parseHoursStrict(str) {
  const s = (str || "").trim();
  if (s === "24/7") return { allDay: true, start: 0, end: 1440, label: "24/7" };
  const m = s.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const sh = Number(m[1]), sm = Number(m[2]), eh = Number(m[3]), em = Number(m[4]);
  if (sh > 24 || eh > 24 || sm > 59 || em > 59) return null;
  return {
    allDay: false, start: sh * 60 + sm, end: eh * 60 + em,
    label: String(sh).padStart(2, "0") + ":" + m[2] + "-" + String(eh).padStart(2, "0") + ":" + m[4],
  };
}

function parseHours(str) {
  return parseHoursStrict(str || DEFAULT_HOURS) || parseHoursStrict(DEFAULT_HOURS) || parseHoursStrict("09:00-17:30");
}

// ---- Nodes ----------------------------------------------------------------
// On-screen time, following the 12/24-hour and seconds settings.
function timeFormatter(tz, withSeconds) {
  const o = { timeZone: tz, hour: DISPLAY.clock === "12" ? "numeric" : "2-digit", minute: "2-digit" };
  if (withSeconds) o.second = "2-digit";
  if (DISPLAY.clock === "12") o.hour12 = true; else o.hourCycle = "h23";
  return new Intl.DateTimeFormat(displayLocale(), o);
}

// On-screen date, following the date style and locale settings.
function dateFormatter(tz, style) {
  const st = DATE_STYLES[style || DISPLAY.dateStyle] || DATE_STYLES.short;
  if (!st.opts) {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    return { format: (d) => f.format(d) };  // en-CA gives YYYY-MM-DD
  }
  return new Intl.DateTimeFormat(displayLocale(), Object.assign({ timeZone: tz }, st.opts));
}

function makeFormatters(tz) {
  return {
    time: timeFormatter(tz, DISPLAY.seconds),
    hm: timeFormatter(tz, false),
    date: dateFormatter(tz),
    // local date, weekday and 24h time, used for status and the overlap search
    clock: new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }),
  };
}

// Turn a saved config into working node objects (adds parsed hours, formatters).
function prepareNodes(cfg) {
  DISPLAY = mergeDisplay(cfg.display);
  CLIENTS = cfg.clients && typeof cfg.clients === "object" ? cfg.clients : {};
  if (typeof Holidays !== "undefined") Holidays.setCustom(cfg.customHolidays || []);
  DEFAULT_HOURS = parseHoursStrict(cfg.defaultHours) ? cfg.defaultHours : DEFAULT_CONFIG.defaultHours;
  SOON = Number.isFinite(Number(cfg.soonMinutes)) ? Number(cfg.soonMinutes) : DEFAULT_CONFIG.soonMinutes;
  const nodes = clone(cfg.nodes).map((n) => {
    n.group = (n.group || n.name).trim();
    n.hrs = parseHours(n.hours);
    n.observes = n.observesHolidays === undefined ? true : !!n.observesHolidays;
    n.days = Array.isArray(n.days) && n.days.length ? n.days.slice() : DEFAULT_DAYS.slice();
    try { n.fmt = makeFormatters(n.tz); }
    catch (e) { n.tz = "UTC"; n.fmt = makeFormatters("UTC"); }
    return n;
  });
  if (!nodes.some((n) => n.home)) nodes[0].home = true;
  return nodes;
}

// Group nodes by their `group`, keeping first-seen order.
function groupNodes(nodes) {
  const groups = [];
  for (const n of nodes) {
    let g = groups.find((x) => x.name === n.group);
    if (!g) { g = { name: n.group, nodes: [] }; groups.push(g); }
    g.nodes.push(n);
  }
  return groups;
}

function bestNode(g) {
  let best = g.nodes[0];
  for (const n of g.nodes) if (RANK[n.status] > RANK[best.status]) best = n;
  return best;
}

// Badge text for a group: best status, plus a count when it has several sites.
function groupBadge(g) {
  const best = bestNode(g).status;
  const live = g.nodes.filter((n) => n.status === "online" || n.status === "leaving" || n.status === "arriving").length;
  const text = g.nodes.length > 1 && live > 0 ? STATUS[best].text + " · " + live + "/" + g.nodes.length : STATUS[best].text;
  return { status: best, text, cls: STATUS[best].cls };
}

// Inside a multi-site group, drop the repeated client name: "P Client (Eng)" -> "Eng".
function siteLabel(n, g) {
  if (g.nodes.length > 1 && n.name.startsWith(g.name)) {
    return n.name.slice(g.name.length).replace(/^[\s(]+|[)\s]+$/g, "") || n.name;
  }
  return n.name;
}

// ---- Status -----------------------------------------------------------------
function localClock(node, now) {
  const parts = node.fmt.clock.formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  const dow = WEEKDAYS.indexOf(get("weekday"));
  return {
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
    dow,
    weekend: dow === 0 || dow === 6,
    offDay: !(node.days || DEFAULT_DAYS).includes(dow),
    ymd: get("year") + "-" + get("month") + "-" + get("day"),
  };
}

function holidayFor(node, ymd) {
  if (!node.observes || typeof Holidays === "undefined") return null;
  return Holidays.getHoliday(node.region, ymd);
}

// Where a site is at `now`: status plus the bits the UI needs.
function siteState(node, now) {
  const c = localClock(node, now);
  const holiday = holidayFor(node, c.ymd);
  const { allDay, start, end } = node.hrs;
  let status;

  if (holiday) status = "holiday";
  else if (allDay) status = "online";
  else if (c.offDay) status = "offline";
  else {
    const m = c.minutes;
    const inWindow = start < end ? (m >= start && m < end) : (m >= start || m < end);
    const until = (t) => (t - m + 1440) % 1440;
    if (inWindow) status = until(end) <= SOON ? "leaving" : "online";
    else status = until(start) > 0 && until(start) <= SOON ? "arriving" : "offline";
  }
  return { status, holiday, minutes: c.minutes, weekend: c.weekend, offDay: c.offDay && !allDay, ymd: c.ymd };
}

// Strictly within working hours (used by the overlap finder).
function isOnlineAt(node, date) {
  const st = siteState(node, date).status;
  return st === "online" || st === "leaving";
}

// Next public holiday for a site, looking about six months ahead.
function nextHoliday(node, ymd) {
  const nextHolFmt = dateFormatter("UTC");
  if (!node.observes || typeof Holidays === "undefined") return null;
  const [y, m, d] = ymd.split("-").map(Number);
  for (let i = 1; i <= 190; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const name = Holidays.getHoliday(node.region, dt.toISOString().slice(0, 10));
    if (name) return nextHolFmt.format(dt) + " · " + name;
  }
  return null;
}

// Missing or estimated holiday data that affects these sites soon.
function holidayWarnings(nodes, now) {
  if (typeof Holidays === "undefined" || !Holidays.missingData) return [];
  const regions = [...new Set(nodes.filter((n) => n.observes).map((n) => n.region).filter(Boolean))];
  return Holidays.missingData(regions, now || new Date());
}

// Why a site is off at a moment: "Weekend" or "Day off" (for custom working days).
function offDayText(st) { return st.weekend ? "Weekend" : "Day off"; }

// ---- Look and motion -------------------------------------------------------
function applyTheme(display) {
  const d = display || DISPLAY;
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  const set = () => {
    const t = d.theme === "system" ? (mq && mq.matches ? "light" : "dark") : d.theme;
    document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
  };
  set();
  if (mq && d.theme === "system") mq.addEventListener("change", set);
}

function reduceMotion(display) {
  const d = display || DISPLAY;
  if (d.motion === "on") return true;
  if (d.motion === "off") return false;
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// ---- Ordering ---------------------------------------------------------------
function utcOffsetMin(tz, date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date || new Date());
  const g = (t) => Number(p.find((x) => x.type === t).value);
  const d = date || new Date();
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}

// Groups in display order. "order" keeps the settings order (home first),
// "status" puts online first, "tz" goes west to east.
function sortedGroups(groups, mode) {
  const homeFirst = (a, b) => (b.nodes.some((n) => n.home) ? 1 : 0) - (a.nodes.some((n) => n.home) ? 1 : 0);
  const list = groups.slice();
  if (mode === "status") {
    list.sort((a, b) => homeFirst(a, b) || RANK[bestNode(b).status] - RANK[bestNode(a).status]);
  } else if (mode === "tz") {
    const now = new Date();
    list.sort((a, b) => homeFirst(a, b) || utcOffsetMin(a.nodes[0].tz, now) - utcOffsetMin(b.nodes[0].tz, now));
  }
  return list;
}
