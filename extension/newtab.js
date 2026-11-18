// ---- New tab page -------------------------------------------------------------
// Sites, hours and holiday regions come from the settings page (defaults are in
// core.js). This file draws the client pills, cards, overlap finder and globe.

// Globe size in pixels: the drawing area (width x height) and the globe's radius.
// Leave room around the globe for labels at the edges and for arcs lifting off it.
const GLOBE = { width: 600, height: 520, radius: 205 };

let nodes = [];
let HOME = null;
let groups = [];
const OPEN_KEY = "wc-open-groups";
const OVERLAP_KEY = "wc-overlap";
let focusGlobe = () => {};  // replaced once the globe starts

function loadOpen() {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || "[]")); }
  catch (e) { return new Set(); }
}
function saveOpen() {
  try {
    const open = groups.filter((g) => g.el.open).map((g) => g.name);
    localStorage.setItem(OPEN_KEY, JSON.stringify(open));
  } catch (e) { /* storage unavailable: just don't remember */ }
}

function linkButton(label, onClick) {
  const b = document.createElement("button");
  b.className = "link-btn";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

// ---- Client groups ----------------------------------------------------------
// Each group is a pill. Closed, it shows one entry per site (status dot + local
// time) and an overall badge; open, it goes full width and shows the cards.
function build() {
  const root = document.getElementById("clocks");
  root.innerHTML = "";
  const openSet = loadOpen();
  groups = groupNodes(nodes);

  const bar = document.createElement("div");
  bar.className = "groups-bar";
  bar.append(
    linkButton("Expand all", () => { for (const g of groups) g.el.open = true; saveOpen(); }),
    linkButton("Collapse all", () => { for (const g of groups) g.el.open = false; saveOpen(); }),
  );
  const warnings = holidayWarnings(nodes);
  if (warnings.some((w) => w.level === "missing")) {
    const w = linkButton("Holiday dates need adding", () => ext && ext.runtime && ext.runtime.openOptionsPage());
    w.classList.add("warn-link");
    w.title = warnings.map((x) => x.text).join("\n\n");
    bar.prepend(w);
  }
  if (ext && ext.runtime && ext.runtime.openOptionsPage) {
    bar.append(linkButton("Settings", () => ext.runtime.openOptionsPage()));
  }
  root.append(bar);

  for (const g of groups) {
    const det = document.createElement("details");
    det.className = "group";
    det.open = openSet.has(g.name);
    det.addEventListener("toggle", saveOpen);

    const sum = document.createElement("summary");
    sum.title = "Click to open, and spin the globe to this client";
    sum.addEventListener("click", () => focusGlobe(bestNode(g)));

    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "›";
    const title = document.createElement("span");
    title.className = "group-name";
    title.textContent = g.name;

    const sites = document.createElement("span");
    sites.className = "sites";
    for (const n of g.nodes) {
      const pill = document.createElement("span");
      pill.className = "site";
      const dot = document.createElement("i");
      dot.className = "dot";
      const city = document.createElement("span");
      city.textContent = n.city || n.name;
      const t = document.createElement("b");
      t.textContent = "--:--";
      pill.append(dot, city, t);
      // Clicking a site only spins the globe; it doesn't open or close the pill.
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        focusGlobe(n);
      });
      sites.append(pill);
      n.pillEl = pill;
      n.pillDot = dot;
      n.pillTime = t;
    }

    g.badgeEl = document.createElement("span");
    g.badgeEl.className = "badge off";
    g.badgeEl.textContent = "Offline";

    sum.append(chev, title, sites, g.badgeEl);

    const cards = document.createElement("div");
    cards.className = "group-cards";
    g.cardsEl = cards;
    det.append(sum, cards);
    g.el = det;
    root.appendChild(det);
  }

  for (const g of groups) {
    for (const n of g.nodes) g.cardsEl.appendChild(buildCard(n, g));
  }
}

function buildCard(n, g) {
  const card = document.createElement("section");
  card.className = "clock";
  card.dataset.status = "offline";

  const head = document.createElement("div");
  head.className = "head";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = siteLabel(n, g);
  n.badgeEl = document.createElement("span");
  n.badgeEl.className = "badge off";
  n.badgeEl.textContent = "Offline";
  head.append(label, n.badgeEl);
  card.append(head);

  const city = document.createElement("div");
  city.className = "city";
  const where = n.home ? (n.city ? n.city + " · home" : "home") : (n.city || "");
  city.textContent = where + " · " + n.hrs.label + (n.observes ? "" : " · no holidays");
  card.append(city);

  n.timeEl = document.createElement("div");
  n.timeEl.className = "time";
  n.timeEl.textContent = "--:--:--";

  const dateLine = document.createElement("div");
  dateLine.className = "date";
  n.dateEl = document.createElement("span");
  n.holEl = document.createElement("span");
  n.holEl.className = "hol-name";
  dateLine.append(n.dateEl, n.holEl);
  card.append(n.timeEl, dateLine);

  // 24h bar: the site's working hours as a band, with a live "now" marker.
  // Overnight hours wrap, so they need two pieces of band.
  const barEl = document.createElement("div");
  barEl.className = "bar";
  const { allDay, start, end } = n.hrs;
  const pieces = allDay ? [[0, 1440]] : start < end ? [[start, end]] : [[start, 1440], [0, end]];
  for (const [a, b] of pieces) {
    const win = document.createElement("div");
    win.className = "bar-window";
    win.style.left = (a / 1440 * 100) + "%";
    win.style.width = ((b - a) / 1440 * 100) + "%";
    barEl.append(win);
  }
  const nowm = document.createElement("div");
  nowm.className = "bar-now";
  barEl.append(nowm);
  card.append(barEl);

  n.nextHolEl = document.createElement("div");
  n.nextHolEl.className = "next-hol";
  n.nextHolEl.title = "Next public holiday";
  card.append(n.nextHolEl);

  n.barEl = barEl;
  n.barNow = nowm;
  n.cardEl = card;
  return card;
}

function updateGroups() {
  for (const g of groups) {
    const b = groupBadge(g);
    g.badgeEl.textContent = b.text;
    g.badgeEl.className = "badge " + b.cls;
    g.el.dataset.status = b.status;
  }
}

// ---- Globe labels (DOM overlay, so long names don't clip) -------------------
function buildLabels() {
  const wrap = document.getElementById("labels");
  wrap.innerHTML = "";
  for (const n of nodes) {
    const el = document.createElement("div");
    el.className = "glabel hidden";
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = "--:--";
    const nm = document.createElement("span");
    nm.className = "n";
    nm.textContent = n.name;
    el.append(t, nm);
    wrap.appendChild(el);
    n.labelEl = el;
    n.labelT = t;
  }
}

function tick() {
  const now = new Date();
  for (const n of nodes) {
    const st = siteState(n, now);
    n.status = st.status;
    const s = STATUS[n.status];

    n.timeEl.textContent = n.fmt.time.format(now);
    n.dateEl.textContent = n.fmt.date.format(now);
    n.holEl.textContent = st.holiday ? " · " + st.holiday : "";
    n.badgeEl.textContent = s.text;
    n.badgeEl.className = "badge " + s.cls;
    n.cardEl.dataset.status = n.status;

    n.barNow.style.left = (st.minutes / 1440 * 100) + "%";
    n.barNow.style.background = s.mark;
    n.barEl.classList.toggle("off-day", st.weekend && !n.hrs.allDay);
    n.barEl.classList.toggle("holiday", !!st.holiday);

    // next holiday only changes when the local date does
    if (n.nextHolYmd !== st.ymd) {
      n.nextHolYmd = st.ymd;
      const nh = nextHoliday(n, st.ymd);
      n.nextHolEl.textContent = nh ? "Next: " + nh : "";
    }

    n.labelT.textContent = n.fmt.hm.format(now);
    n.labelT.style.color = s.mark;
    n.pillTime.textContent = n.fmt.hm.format(now);
    n.pillDot.style.background = s.mark;
    n.pillEl.title = st.holiday
      ? (n.city || n.name) + ": " + st.holiday + " (click to spin the globe here)"
      : "Spin the globe to " + (n.city || n.name);
  }
  // label sizes for the globe's label placement (one layout read per second)
  for (const n of nodes) {
    n.lw = n.labelEl.offsetWidth || n.lw;
    n.lh = n.labelEl.offsetHeight || n.lh;
  }
  updateGroups();
  updateOverlap(now);
}

// ---- Who's online together --------------------------------------------------
let selected = new Set();
let overlapFmt = null;
let overlapResultEl = null;
let copyBtn = null;
let lastOverlapMinute = -1;
let lastWindow = null;  // { start: Date, end: Date } of the window shown, if any

function loadSelected() {
  let names = null;
  try { names = JSON.parse(localStorage.getItem(OVERLAP_KEY) || "null"); } catch (e) { /* ignore */ }
  const valid = new Set(nodes.map((n) => n.name));
  if (Array.isArray(names)) names = names.filter((x) => valid.has(x));
  if (!names || !names.length) {
    const other = nodes.find((n) => !n.home);
    names = [HOME.name].concat(other ? [other.name] : []);
  }
  selected = new Set(names);
}
function saveSelected() {
  try { localStorage.setItem(OVERLAP_KEY, JSON.stringify([...selected])); } catch (e) { /* ignore */ }
}

function fmtDur(mins) {
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const out = [];
  if (d) out.push(d + "d");
  if (h) out.push(h + "h");
  if (m || !out.length) out.push(m + "m");
  return out.join(" ");
}

// Returns { text, window } where window is { start, end } or null.
function computeOverlap(now) {
  const sel = nodes.filter((n) => selected.has(n.name));
  if (sel.length < 2) return { text: "Pick at least two places to find a shared window.", window: null };

  const stepMs = 15 * 60000;
  const maxSteps = 14 * 24 * 4;  // 14 days in 15-minute steps
  const allOn = (d) => sel.every((n) => isOnlineAt(n, d));
  const endOf = (d) => {
    let end = new Date(d.getTime() + stepMs);
    for (let i = 0; i < 7 * 96 && allOn(end); i++) end = new Date(end.getTime() + stepMs);
    return end;
  };

  if (allOn(now)) {
    const end = endOf(new Date(Math.floor(now.getTime() / stepMs) * stepMs));
    const start = new Date(Math.ceil(now.getTime() / stepMs) * stepMs);
    return {
      text: "All " + sel.length + " online now, about " + fmtDur(Math.round((end - now) / 60000)) +
        " left (until " + overlapFmt.format(end) + " your time).",
      window: start < end ? { start, end } : null,
    };
  }

  const t0 = Math.ceil(now.getTime() / stepMs) * stepMs;
  for (let i = 0; i <= maxSteps; i++) {
    const d = new Date(t0 + i * stepMs);
    if (allOn(d)) {
      const end = endOf(d);
      return {
        text: "Next shared window: " + overlapFmt.format(d) + " your time (in " +
          fmtDur(Math.round((d - now) / 60000)) + "), lasting " + fmtDur(Math.round((end - d) / 60000)) + ".",
        window: { start: d, end },
      };
    }
  }
  return { text: "No shared window in the next 14 days. Their hours never line up.", window: null };
}

// "Tue 29 Dec" (or "Tue 29 Dec 2026"), built from parts so browsers that put a
// comma after the weekday ("Tue, 29 Dec 2026") all come out the same.
function dayLabel(date, tz, withYear) {
  const opts = { timeZone: tz, weekday: "short", day: "numeric", month: "short" };
  if (withYear) opts.year = "numeric";
  const p = new Intl.DateTimeFormat("en-GB", opts).formatToParts(date);
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return [g("weekday"), g("day"), g("month"), withYear ? g("year") : null].filter(Boolean).join(" ");
}

function hmIn(date, tz) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

// "Tue 29 Dec 14:00-17:30", or across midnight "Tue 29 Dec 22:00 - Wed 30 Dec 01:30".
// With withYear: "Tue 29 Dec 2026, 14:00-17:30". Without an end: "Tue 29 Dec 14:00".
function fmtRange(tz, a, b, withYear) {
  const sep = withYear ? ", " : " ";
  const da = dayLabel(a, tz, withYear);
  if (!b) return da + sep + hmIn(a, tz);
  const db = dayLabel(b, tz, withYear);
  return da === db
    ? da + sep + hmIn(a, tz) + "-" + hmIn(b, tz)
    : da + sep + hmIn(a, tz) + " - " + db + sep + hmIn(b, tz);
}

// Why a site isn't available for the whole of start..end, or "" if it is.
function availabilityNote(n, start, end) {
  const checks = [start];
  if (end) checks.push(new Date(end.getTime() - 60000));  // last minute of the window
  for (const t of checks) {
    const st = siteState(n, t);
    if (st.status === "online" || st.status === "leaving") continue;
    if (st.holiday) return "Holiday: " + st.holiday;
    if (st.weekend && !n.hrs.allDay) return "Weekend";
    return "Out of hours";
  }
  return "";
}

// Plain text for a change request: the window in UTC, then each site's local
// time. Sites that aren't in working hours for the whole window are flagged.
function cabLines(sites, start, end, extraZones) {
  const notes = sites.map((n) => availabilityNote(n, start, end));
  const allIn = notes.every((x) => !x);
  const lines = [
    "Proposed change window: " + fmtRange("UTC", start, end, true) + " UTC" +
      (end ? " (" + fmtDur(Math.round((end - start) / 60000)) + ")" : ""),
    allIn ? "All parties within working hours:" : "Local times:",
  ];
  sites.forEach((n, i) => {
    lines.push("- " + n.name + (n.city ? " (" + n.city + ")" : "") + ": " + fmtRange(n.tz, start, end) +
      (notes[i] ? " [" + notes[i] + "]" : ""));
  });
  for (const z of extraZones || []) lines.push("- " + z.label + ": " + fmtRange(z.tz, start, end));
  return lines.join("\n");
}

// From the overlap finder: a window where everyone is in.
function cabText(win) {
  return cabLines(nodes.filter((n) => selected.has(n.name)), win.start, win.end);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // fallback for contexts where the async clipboard isn't allowed
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function buildOverlap(root) {
  const chips = document.createElement("div");
  chips.className = "overlap-chips";
  for (const n of nodes) {
    const chip = document.createElement("button");
    chip.className = "chip" + (selected.has(n.name) ? " on" : "");
    chip.textContent = n.name;
    chip.addEventListener("click", () => {
      if (selected.has(n.name)) selected.delete(n.name);
      else selected.add(n.name);
      chip.classList.toggle("on", selected.has(n.name));
      saveSelected();
      updateOverlap(new Date(), true);
    });
    chips.append(chip);
  }

  const row = document.createElement("div");
  row.className = "overlap-row";
  overlapResultEl = document.createElement("div");
  overlapResultEl.className = "overlap-result";
  copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copy suggested window";
  copyBtn.title = "Copies this suggested window for a change request: UTC plus each selected site's local time";
  copyBtn.addEventListener("click", async () => {
    if (!lastWindow) return;
    const ok = await copyText(cabText(lastWindow));
    copyBtn.textContent = ok ? "Copied" : "Couldn't copy";
    setTimeout(() => { copyBtn.textContent = "Copy suggested window"; }, 1600);
  });
  planBtn = document.createElement("button");
  planBtn.className = "copy-btn";
  planBtn.textContent = "Plan in converter";
  planBtn.title = "Open the time converter at the start of this window";
  planBtn.addEventListener("click", () => {
    if (!lastWindow) return;
    const home = convLocs.find((l) => l.home) || convLocs[0];
    const p = zonedParts(lastWindow.start, home.tz);
    conv.from = "loc:" + home.key;
    conv.date = p.ymd;
    conv.time = p.hm;
    showTab("convert");
    syncConverterInputs();
    updateConverter();
  });

  const btns = document.createElement("div");
  btns.className = "overlap-btns";
  btns.append(planBtn, copyBtn);
  row.append(overlapResultEl, btns);

  root.append(chips, row);
}

let planBtn = null;

function updateOverlap(now, force) {
  const minute = Math.floor(now.getTime() / 60000);
  if (!force && minute === lastOverlapMinute) return;  // recompute at most once a minute
  lastOverlapMinute = minute;
  const r = computeOverlap(now);
  lastWindow = r.window;
  if (overlapResultEl) overlapResultEl.textContent = r.text;
  if (copyBtn) copyBtn.hidden = !r.window;
  if (planBtn) planBtn.hidden = !r.window;
}

// ---- Bottom panel: tabs -----------------------------------------------------
const TAB_KEY = "wc-panel-tab";
const tabEls = {};

function showTab(name) {
  for (const [k, t] of Object.entries(tabEls)) {
    t.btn.classList.toggle("on", k === name);
    t.body.hidden = k !== name;
  }
  try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* ignore */ }
}

function buildPanel() {
  const root = document.getElementById("overlap");
  if (!root) return;
  root.innerHTML = "";
  const bar = document.createElement("div");
  bar.className = "tabs";
  root.append(bar);
  for (const [key, label, builder] of [
    ["overlap", "Who's online together", buildOverlap],
    ["convert", "Time converter", buildConverter],
  ]) {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.textContent = label;
    btn.addEventListener("click", () => showTab(key));
    bar.append(btn);
    const body = document.createElement("div");
    body.className = "tab-body";
    builder(body);
    root.append(body);
    tabEls[key] = { btn, body };
  }
  let start = "overlap";
  try { start = localStorage.getItem(TAB_KEY) || "overlap"; } catch (e) { /* ignore */ }
  showTab(tabEls[start] ? start : "overlap");
}

// ---- Time converter -----------------------------------------------------------
// Pick a date, time and "from" zone; see that moment at every site, whether it's
// in their working hours, and copy it as text for a calendar invite or chat.
const CONV_KEY = "wc-converter";
let conv = { from: "", date: "", time: "", duration: 60, custom: "", excluded: [] };
let convLocs = [];
const convEls = {};
const DURATIONS = [[0, "No length"], [15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "1 hour"], [90, "1h 30m"], [120, "2 hours"], [180, "3 hours"]];
const CONV_TEXT = { online: "In hours", leaving: "Near end of day", arriving: "Just before start", holiday: "Holiday", offline: "Out of hours" };

// Home shows as "UK" when it's in the UK; otherwise sites show by city.
function shortLabel(n) { return n.home && n.region === "GB-ENG" ? "UK" : (n.city || n.name); }

// One row per city: sites in the same city and zone share it.
function buildLocations() {
  const locs = [];
  for (const n of nodes) {
    const key = n.tz + "|" + shortLabel(n);
    let l = locs.find((x) => x.key === key);
    if (!l) { l = { key, label: shortLabel(n), tz: n.tz, nodes: [], home: !!n.home }; locs.push(l); }
    l.nodes.push(n);
  }
  locs.sort((a, b) => (b.home ? 1 : 0) - (a.home ? 1 : 0));
  return locs;
}

// Offset of a zone from UTC at an instant, in ms.
function tzOffsetMs(date, tz) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - date.getTime();
}

// "2026-12-29" + "14:00" as wall-clock time in `tz` -> the real instant.
function zonedToDate(ymd, hm, tz) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  t = guess - tzOffsetMs(new Date(t), tz);  // second pass settles DST edges
  return new Date(t);
}

function zonedParts(date, tz) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t).value;
  return { ymd: g("year") + "-" + g("month") + "-" + g("day"), hm: g("hour") + ":" + g("minute") };
}

function validTz(tz) {
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return !!tz; } catch (e) { return false; }
}

function fromTz() {
  if (conv.from === "UTC") return "UTC";
  if (conv.from === "custom") return validTz(conv.custom) ? conv.custom : null;
  const l = convLocs.find((x) => "loc:" + x.key === conv.from);
  return l ? l.tz : convLocs[0].tz;
}

function saveConv() {
  try { localStorage.setItem(CONV_KEY, JSON.stringify({ from: conv.from, duration: conv.duration, custom: conv.custom, excluded: conv.excluded })); }
  catch (e) { /* ignore */ }
}

function setConvNow() {
  const tz = fromTz() || convLocs[0].tz;
  // next quarter hour, in the "from" zone
  const t = new Date(Math.ceil(Date.now() / 900000) * 900000);
  const p = zonedParts(t, tz);
  conv.date = p.ymd;
  conv.time = p.hm;
}

function buildConverter(root) {
  convLocs = buildLocations();
  try { Object.assign(conv, JSON.parse(localStorage.getItem(CONV_KEY) || "{}")); } catch (e) { /* ignore */ }
  if (!conv.from || (conv.from.startsWith("loc:") && !convLocs.some((l) => "loc:" + l.key === conv.from))) {
    conv.from = "loc:" + convLocs[0].key;
  }
  setConvNow();

  const inputs = document.createElement("div");
  inputs.className = "conv-inputs";

  convEls.date = document.createElement("input");
  convEls.date.type = "date";
  convEls.time = document.createElement("input");
  convEls.time.type = "time";

  const inLabel = document.createElement("span");
  inLabel.className = "conv-in";
  inLabel.textContent = "in";

  convEls.from = document.createElement("select");
  for (const l of convLocs) {
    const o = document.createElement("option");
    o.value = "loc:" + l.key;
    o.textContent = l.label + (l.home ? " (home)" : "");
    convEls.from.append(o);
  }
  for (const [v, t] of [["UTC", "UTC"], ["custom", "Other time zone..."]]) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    convEls.from.append(o);
  }

  convEls.custom = document.createElement("input");
  convEls.custom.type = "text";
  convEls.custom.placeholder = "e.g. Asia/Tokyo";
  convEls.custom.setAttribute("list", "conv-tz-list");
  const dl = document.createElement("datalist");
  dl.id = "conv-tz-list";
  for (const z of (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [])) {
    const o = document.createElement("option");
    o.value = z;
    dl.append(o);
  }

  convEls.duration = document.createElement("select");
  for (const [v, t] of DURATIONS) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    convEls.duration.append(o);
  }

  const nowBtn = document.createElement("button");
  nowBtn.className = "copy-btn";
  nowBtn.textContent = "Now";
  nowBtn.addEventListener("click", () => { setConvNow(); syncConverterInputs(); updateConverter(); });

  inputs.append(convEls.date, convEls.time, inLabel, convEls.from, convEls.custom, dl, convEls.duration, nowBtn);

  const onChange = () => {
    const prevTz = fromTz();
    const instant = prevTz && conv.date && conv.time ? zonedToDate(conv.date, conv.time, prevTz) : null;
    conv.date = convEls.date.value;
    conv.time = convEls.time.value;
    conv.duration = Number(convEls.duration.value);
    conv.custom = convEls.custom.value.trim();
    const fromChanged = conv.from !== convEls.from.value;
    conv.from = convEls.from.value;
    // Switching the "from" zone keeps the same moment, shown in the new zone.
    if (fromChanged && instant && fromTz()) {
      const p = zonedParts(instant, fromTz());
      conv.date = p.ymd;
      conv.time = p.hm;
    }
    saveConv();
    syncConverterInputs();
    updateConverter();
  };
  for (const el of [convEls.date, convEls.time, convEls.from, convEls.duration]) el.addEventListener("change", onChange);
  convEls.custom.addEventListener("input", onChange);

  convEls.rows = document.createElement("div");
  convEls.rows.className = "conv-rows";

  const actions = document.createElement("div");
  actions.className = "conv-actions";
  const copyBtnFor = (label, make) => {
    const b = document.createElement("button");
    b.className = "copy-btn";
    b.textContent = label;
    b.addEventListener("click", async () => {
      const text = make();
      if (!text) return;
      const ok = await copyText(text);
      b.textContent = ok ? "Copied" : "Couldn't copy";
      setTimeout(() => { b.textContent = label; }, 1600);
    });
    return b;
  };
  convEls.preview = document.createElement("div");
  convEls.preview.className = "conv-preview";
  actions.append(convEls.preview, copyBtnFor("Copy one line", convOneLine), copyBtnFor("Copy as list", convList), copyBtnFor("Copy for change request", convCab));

  root.append(inputs, convEls.rows, actions);
  syncConverterInputs();
  updateConverter();
}

function syncConverterInputs() {
  convEls.date.value = conv.date;
  convEls.time.value = conv.time;
  convEls.from.value = conv.from;
  convEls.duration.value = String(conv.duration);
  convEls.custom.value = conv.custom;
  convEls.custom.hidden = conv.from !== "custom";
}

// Rows to show: every city, plus the "from" zone if it isn't one of them.
function convRows() {
  const rows = convLocs.map((l) => ({ ...l }));
  const tz = fromTz();
  if (tz && (conv.from === "UTC" || conv.from === "custom") && !rows.some((r) => r.tz === tz)) {
    const label = tz === "UTC" ? "UTC" : tz.split("/").pop().replace(/_/g, " ");
    rows.splice(1, 0, { key: "from:" + tz, label, tz, nodes: [], home: false, extra: true });
  }
  return rows;
}

function convRange(tz, start, end) {
  const s = zonedParts(start, tz).hm;
  return end ? s + "-" + zonedParts(end, tz).hm : s;
}

const convDayFmt = (tz) => ({ format: (d) => dayLabel(d, tz) });

let convState = null;  // { rows, start, end } for the copy buttons

function updateConverter() {
  const box = convEls.rows;
  box.innerHTML = "";
  const tz = fromTz();
  if (!tz || !conv.date || !conv.time) {
    convState = null;
    convEls.preview.textContent = conv.from === "custom" ? "Type a time zone like Asia/Tokyo." : "";
    return;
  }
  const start = zonedToDate(conv.date, conv.time, tz);
  const end = conv.duration ? new Date(start.getTime() + conv.duration * 60000) : null;
  const fromYmd = zonedParts(start, tz).ymd;
  const rows = convRows();

  for (const r of rows) {
    const p = zonedParts(start, r.tz);
    const dayDiff = Math.round((Date.parse(p.ymd) - Date.parse(fromYmd)) / 86400000);

    // status: the best of the sites in this city at that moment
    let status = null, note = "";
    if (r.nodes.length) {
      let best = null;
      for (const n of r.nodes) {
        const st = siteState(n, start);
        if (!best || RANK[st.status] > RANK[best.status]) best = st;
      }
      status = best.status;
      note = best.holiday ? "Holiday: " + best.holiday
        : (best.status === "offline" && best.weekend ? "Weekend" : CONV_TEXT[best.status]);
    }

    const line = document.createElement("label");
    line.className = "conv-row" + (status ? " st-" + status : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !conv.excluded.includes(r.key);
    cb.title = "Include in copied text";
    cb.addEventListener("change", () => {
      conv.excluded = conv.excluded.filter((k) => k !== r.key);
      if (!cb.checked) conv.excluded.push(r.key);
      saveConv();
      updatePreview();
    });

    const where = document.createElement("span");
    where.className = "conv-where";
    const b = document.createElement("b");
    b.textContent = r.label;
    const who = document.createElement("span");
    who.className = "conv-who";
    const names = r.nodes.filter((n) => !n.home).map((n) => n.name);
    who.textContent = names.join(", ");
    where.title = r.label + (names.length ? ": " + names.join(", ") : "");
    where.append(b, who);

    const time = document.createElement("span");
    time.className = "conv-time";
    time.textContent = convRange(r.tz, start, end);

    const day = document.createElement("span");
    day.className = "conv-day";
    day.textContent = convDayFmt(r.tz).format(start) + (dayDiff ? " (" + (dayDiff > 0 ? "+" : "") + dayDiff + " day)" : "");

    const st = document.createElement("span");
    st.className = "conv-status";
    st.textContent = note;
    st.title = note;
    if (status) st.style.color = STATUS[status].mark;

    line.append(cb, where, time, day, st);
    box.append(line);
  }
  convState = { rows, start, end };
  updatePreview();
}

function includedRows() {
  return convState ? convState.rows.filter((r) => !conv.excluded.includes(r.key)) : [];
}

// "Tue 29 Dec: UK 14:00-15:00 / Toronto 09:00-10:00 / Melbourne 01:00-02:00 (Wed 30 Dec)"
function convOneLine() {
  const rows = includedRows();
  if (!rows.length) return "";
  const { start, end } = convState;
  const refDay = convDayFmt(rows[0].tz).format(start);
  const parts = rows.map((r) => {
    const d = convDayFmt(r.tz).format(start);
    return r.label + " " + convRange(r.tz, start, end) + (d !== refDay ? " (" + d + ")" : "");
  });
  return refDay + ": " + parts.join(" / ");
}

// Short list for an email or invite body.
function convList() {
  const rows = includedRows();
  if (!rows.length) return "";
  const { start, end } = convState;
  const refDay = convDayFmt(rows[0].tz).format(start);
  const lines = [refDay + (end ? " (" + fmtDur(Math.round((end - start) / 60000)) + ")" : "")];
  for (const r of rows) {
    const d = convDayFmt(r.tz).format(start);
    lines.push("- " + r.label + ": " + convRange(r.tz, start, end) + (d !== refDay ? " (" + d + ")" : ""));
  }
  return lines.join("\n");
}

// From the converter: the time you picked, for every client in the ticked cities.
// Extra zones (UTC or one you typed) are added as plain lines.
function convCab() {
  const rows = includedRows();
  if (!rows.length) return "";
  const { start, end } = convState;
  const sites = rows.flatMap((r) => r.nodes);
  const extra = rows.filter((r) => !r.nodes.length && r.tz !== "UTC");
  return cabLines(sites, start, end, extra);
}

function updatePreview() {
  convEls.preview.textContent = convOneLine() || "Tick at least one place to copy.";
}

// ---- Sun position (for day/night shading) -----------------------------------
function subsolarPoint(now) {
  const rad = Math.PI / 180;
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = (now.getTime() - start) / 86400000;   // 1..366, fractional
  const decl = 23.44 * Math.sin(rad * (360 / 365) * (dayOfYear - 81));  // declination
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  let lon = -15 * (utcH - 12);                            // 0 at 12:00 UTC, -15°/hr
  lon = ((lon + 540) % 360) - 180;
  return [lon, decl];
}

// ---- Globe ------------------------------------------------------------------
function initGlobe() {
  const canvas = document.getElementById("globe");
  const ctx = canvas.getContext("2d");
  const W = GLOBE.width, H = GLOBE.height;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);
  document.querySelector(".globe-wrap").style.width = W + "px";
  document.querySelector(".globe-wrap").style.height = H + "px";

  const projection = d3.geoOrthographic()
    .scale(GLOBE.radius)
    .translate([W / 2, H / 2])
    .clipAngle(90);
  const path = d3.geoPath(projection, ctx);
  const nightCircle = d3.geoCircle();
  const graticule = d3.geoGraticule10();

  // Atlas palette + atmosphere glow.
  const OCEAN = "#16324a";
  const LAND = "#3f6b54";
  const GRID = "rgba(255,255,255,0.06)";
  const RIM = "rgba(255,255,255,0.22)";
  const GLOW = "rgba(110,165,255,0.45)";

  let land = null;
  fetch("lib/world-110m.json")
    .then((r) => r.json())
    .then((topo) => { land = topojson.feature(topo, topo.objects.land); })
    .catch((e) => console.warn("Could not load world map:", e));

  let rotation = [0, -15];
  let autoRotate = true;
  let pulseT = 0;        // 0..1 position of the pulse along each arc
  let anim = null;       // in-flight spin to a site
  let resumeTimer = null;
  let flash = null;      // { node, t0 } ring flash on the site we spun to
  const RESUME_MS = 20000;

  // Spin the globe so `node` faces the viewer, then pause auto-rotate a while.
  focusGlobe = (node) => {
    if (!node) return;
    const target = [-node.coords[0], -node.coords[1]];
    const dl = ((target[0] - rotation[0] + 540) % 360) - 180;  // shortest way round
    anim = { from: rotation.slice(), dl, dp: target[1] - rotation[1], t0: performance.now(), dur: 900 };
    flash = { node, t0: performance.now() + 700 };
    autoRotate = false;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { autoRotate = true; }, RESUME_MS);
  };

  // ---- Label placement ----
  // Each visible label tries spots around its marker and takes the one that
  // overlaps least with labels already placed and with other markers. It keeps
  // its previous spot while that's still clear, so labels don't jitter as the
  // globe turns. Labels pushed further out get a thin leader line.
  const NEAR = 9, FAR = 24;

  function candidates(p, w, h, inwardLeft) {
    const out = [];
    for (const [gap, far] of [[NEAR, false], [FAR, true]]) {
      const right = [p[0] + gap, p[1] - h / 2];
      const left = [p[0] - gap - w, p[1] - h / 2];
      const side = inwardLeft ? [left, right] : [right, left];
      out.push(
        { xy: side[0], far }, { xy: side[1], far },
        { xy: [side[0][0], p[1] - h - gap / 2], far }, { xy: [side[0][0], p[1] + gap / 2], far },
        { xy: [side[1][0], p[1] - h - gap / 2], far }, { xy: [side[1][0], p[1] + gap / 2], far },
        { xy: [p[0] - w / 2, p[1] - h - gap], far }, { xy: [p[0] - w / 2, p[1] + gap], far },
      );
    }
    return out;
  }

  const overlap = (a, b) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  function layoutLabels(visible) {
    const markers = visible.map(({ n, p }) => ({ n, x: p[0] - 7, y: p[1] - 7, w: 14, h: 14 }));
    const placed = [];
    const prio = (n) => (n.home ? 9 : RANK[n.status] || 0);
    const order = visible.slice().sort((a, b) => prio(b.n) - prio(a.n));
    const leaders = [];

    for (const { n, p } of order) {
      const w = n.lw || 80, h = n.lh || 30;
      const cands = candidates(p, w, h, p[0] > CX);
      const score = (c) => {
        const box = { x: c.xy[0], y: c.xy[1], w, h };
        let s = 0;
        for (const o of placed) s += overlap(box, o);
        for (const m of markers) if (m.n !== n) s += overlap(box, m) * 2;
        if (box.x < -40 || box.x + w > W + 40 || box.y < 0 || box.y + h > H) s += 500;
        if (c.far) s += 40;  // prefer close spots when they're free
        return s;
      };

      let best = null, bestScore = Infinity;
      // stick with last frame's spot while it's still clear
      if (n.lastCand != null) {
        const c = cands[n.lastCand], sc = score(c);
        if (sc <= (c.far ? 40 : 0)) { best = n.lastCand; bestScore = sc; }
      }
      if (best === null) {
        for (let i = 0; i < cands.length; i++) {
          const sc = score(cands[i]);
          if (sc < bestScore) { best = i; bestScore = sc; }
          if (sc === 0) break;
        }
      }
      n.lastCand = best;
      const c = cands[best];
      const box = { x: c.xy[0], y: c.xy[1], w, h };
      placed.push(box);

      const el = n.labelEl;
      el.classList.remove("hidden");
      el.style.left = box.x + "px";
      el.style.top = box.y + "px";
      el.classList.toggle("align-right", box.x + w <= p[0]);
      if (c.far) leaders.push({ p, box, n });
    }
    return leaders;
  }

  function drawLeader({ p, box, n }) {
    // from the marker to the nearest point on the label's box
    const x = Math.max(box.x, Math.min(p[0], box.x + box.w));
    const y = Math.max(box.y, Math.min(p[1], box.y + box.h));
    const s = STATUS[n.status] || STATUS.offline;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(x, y);
    ctx.strokeStyle = s.mark;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Soft night shadow: fill the hemisphere opposite the sun, in a few bands so
  // the terminator feathers rather than cutting a hard line.
  function drawNight() {
    const [slon, sdecl] = subsolarPoint(new Date());
    const anti = [((slon + 180 + 540) % 360) - 180, -sdecl];
    nightCircle.center(anti);
    for (const [r, a] of [[90, 0.10], [78, 0.10], [66, 0.10]]) {
      ctx.beginPath();
      path(nightCircle.radius(r)());
      ctx.fillStyle = "rgba(8, 12, 24, " + a + ")";
      ctx.fill();
    }
  }

  const CX = W / 2, CY = H / 2;
  const R0 = projection.scale();  // globe radius, for the atmosphere glow
  const FADE = 0.22;  // how far in front of the limb an arc reaches full opacity

  function arcPeak(dist) { return 0.10 + 0.20 * (dist / Math.PI); }

  function arcPoint(interp, peak, t, rot, R) {
    const q = rot(interp(t));
    const lam = q[0] * Math.PI / 180;
    const phi = q[1] * Math.PI / 180;
    const Z = Math.cos(phi) * Math.cos(lam);        // > 0 is the near side
    const hf = 1 + peak * Math.sin(Math.PI * t);    // loft, zero at both ends
    const x = CX + R * Math.cos(phi) * Math.sin(lam) * hf;
    const y = CY - R * Math.sin(phi) * hf;
    const a = Z <= 0 ? 0 : Math.min(1, Z / FADE);
    return [x, y, a];
  }

  function drawArc(interp, peak, color, rot, R) {
    const steps = 60;
    const pts = [];
    for (let i = 0; i <= steps; i++) pts.push(arcPoint(interp, peak, i / steps, rot, R));

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (let i = 1; i < pts.length; i++) {
      const a = Math.min(pts[i - 1][2], pts[i][2]);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPulse(interp, peak, t, color, rot, R) {
    const [x, y, a] = arcPoint(interp, peak, t, rot, R);
    if (a <= 0.01) return;
    ctx.globalAlpha = a * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);

    // atmosphere glow: brightest at the edge of the globe, fading outwards
    const glow = ctx.createRadialGradient(CX, CY, R0, CX, CY, R0 + 24);
    glow.addColorStop(0, GLOW);
    glow.addColorStop(0.35, "rgba(110,165,255,0.16)");
    glow.addColorStop(1, "rgba(110,165,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(CX, CY, R0 + 24, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = OCEAN;
    ctx.fill();

    // faint lat/long grid over the ocean, hidden under land
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    if (land) {
      ctx.beginPath();
      path(land);
      ctx.fillStyle = LAND;
      ctx.fill();
    }

    drawNight();

    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = RIM;
    ctx.lineWidth = 1;
    ctx.stroke();

    // connection arcs + travelling pulses: home -> each client
    const rot = d3.geoRotation(rotation);
    const R = projection.scale();
    let arcIndex = 0;
    for (const n of nodes) {
      if (n.home) continue;
      const s = STATUS[n.status] || STATUS.offline;
      const peak = arcPeak(d3.geoDistance(HOME.coords, n.coords));
      const interp = d3.geoInterpolate(HOME.coords, n.coords);
      drawArc(interp, peak, s.line, rot, R);
      const t = (pulseT + arcIndex * 0.17) % 1;
      drawPulse(interp, peak, t, s.mark, rot, R);
      arcIndex++;
    }

    // markers + labels: work out what's visible, place labels, then draw
    const center = [-rotation[0], -rotation[1]];
    const visible = [];
    for (const n of nodes) {
      const onFront = d3.geoDistance(n.coords, center) < Math.PI / 2;
      const p = onFront ? projection(n.coords) : null;
      if (p) visible.push({ n, p });
      else { n.labelEl.classList.add("hidden"); n.lastCand = null; }
    }
    for (const l of layoutLabels(visible)) drawLeader(l);

    for (const { n, p } of visible) {
      const s = STATUS[n.status] || STATUS.offline;
      if (n.home) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 10, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (s.halo) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 9, 0, 2 * Math.PI);
        ctx.strokeStyle = s.halo;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p[0], p[1], (n.home || s.halo) ? 5 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = s.mark;
      ctx.fill();

      // expanding ring on the site we just spun to
      if (flash && flash.node.coords === n.coords) {
        const k = (now - flash.t0) / 1400;
        if (k >= 1) flash = null;
        else if (k > 0) {
          ctx.globalAlpha = 1 - k;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 8 + 22 * k, 0, 2 * Math.PI);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  let last = performance.now();
  function frame(t) {
    const dt = t - last;
    last = t;
    if (anim) {
      const k = Math.min(1, (t - anim.t0) / anim.dur);
      const e = ease(k);
      rotation[0] = ((anim.from[0] + anim.dl * e + 540) % 360) - 180;
      rotation[1] = anim.from[1] + anim.dp * e;
      if (k >= 1) anim = null;
    } else if (autoRotate) {
      rotation[0] += dt * 0.006;
      if (rotation[0] > 180) rotation[0] -= 360;
    }
    pulseT = (pulseT + dt * 0.0004) % 1;  // ~2.5s for a pulse to cross an arc
    projection.rotate(rotation);
    draw(t);
    requestAnimationFrame(frame);
  }

  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    autoRotate = false;
    anim = null;
    clearTimeout(resumeTimer);
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    rotation[0] += (e.clientX - lastX) * 0.4;
    rotation[1] = Math.max(-90, Math.min(90, rotation[1] - (e.clientY - lastY) * 0.4));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener("dblclick", () => { autoRotate = true; });

  requestAnimationFrame(frame);
}


// ---- Go ---------------------------------------------------------------------
async function main() {
  const cfg = await loadConfig();
  nodes = prepareNodes(cfg);
  HOME = nodes.find((n) => n.home);
  overlapFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: HOME.tz, weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  loadSelected();

  build();
  buildLabels();
  buildPanel();
  tick();
  setInterval(tick, 1000);

  if (typeof d3 !== "undefined" && typeof topojson !== "undefined") {
    try {
      initGlobe();
    } catch (e) {
      console.error("Globe failed to start:", e);
    }
  } else {
    console.warn("Globe libraries not found in lib/ folder. Clocks still work, but no globe.");
  }

  // Settings saved on the settings page: redraw with the new sites.
  onConfigChange(() => location.reload());
}

main();
