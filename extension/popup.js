// ---- Toolbar popup: a compact who's-online list ------------------------------
let pNodes = [];
let pGroups = [];
let pHome = null;

function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const g of pGroups) {
    const row = document.createElement("section");
    row.className = "grp";

    const head = document.createElement("div");
    head.className = "grp-head";
    const name = document.createElement("span");
    name.className = "grp-name";
    name.textContent = g.name;
    g.badgeEl = document.createElement("span");
    g.badgeEl.className = "badge off";
    head.append(name, g.badgeEl);
    row.append(head);

    for (const n of g.nodes) {
      const line = document.createElement("div");
      line.className = "site";
      n.dotEl = document.createElement("i");
      n.dotEl.className = "dot";
      const label = document.createElement("span");
      label.className = "where";
      label.textContent = g.nodes.length > 1 ? siteLabel(n, g) + " · " + (n.city || "") : (n.city || n.name);
      n.timeEl = document.createElement("b");
      n.noteEl = document.createElement("span");
      n.noteEl.className = "note";
      line.append(n.dotEl, label, n.timeEl, n.noteEl);
      row.append(line);
    }
    g.el = row;
    list.append(row);
  }
}

function tick() {
  const now = new Date();
  for (const n of pNodes) {
    const st = siteState(n, now);
    n.status = st.status;
    const s = STATUS[n.status];
    n.dotEl.style.background = s.mark;
    n.timeEl.textContent = n.fmt.hm.format(now);
    n.noteEl.textContent = st.holiday ? st.holiday : (n.status === "online" ? "" : s.text);
    n.noteEl.style.color = st.holiday ? "var(--hol)" : "";
    if (!st.holiday && st.offDay) n.noteEl.textContent = offDayText(st);
  }
  for (const g of pGroups) {
    const b = groupBadge(g);
    g.badgeEl.textContent = b.text;
    g.badgeEl.className = "badge " + b.cls;
    g.el.dataset.status = b.status;
  }
  if (DISPLAY.sortPills !== "order") {
    const list = document.getElementById("list");
    const want = sortedGroups(pGroups, DISPLAY.sortPills);
    if (want.some((g, i) => list.children[i] !== g.el)) for (const g of want) list.appendChild(g.el);
  }
  document.getElementById("home-time").textContent = pHome.city + " " + pHome.fmt.hm.format(now);
}

async function main() {
  const cfg = await loadConfig();
  pNodes = prepareNodes(cfg);
  applyTheme(DISPLAY);
  pHome = pNodes.find((n) => n.home);
  pGroups = groupNodes(pNodes);
  render();
  tick();
  setInterval(tick, 1000);

  document.getElementById("open").addEventListener("click", async () => {
    if (ext && ext.tabs) await ext.tabs.create({});
    window.close();
  });
  document.getElementById("settings").addEventListener("click", async () => {
    if (ext && ext.runtime) await ext.runtime.openOptionsPage();
    window.close();
  });
}

main();
