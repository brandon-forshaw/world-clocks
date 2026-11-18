// ---- Public holidays ----------------------------------------------------------
// Rule-based, so it works for any year without a yearly update. The only
// hand-entered dates are ones no rule can predict (India's lunar festivals,
// one-off extra days, the AFL Grand Final eve). getHoliday(region, "YYYY-MM-DD")
// returns the holiday's name, or null.
//
// Regions: GB-ENG, IE, CA-ON, CA-AB, AU-VIC, ZA, BG, IN

const Holidays = (() => {
  const pad = (n) => String(n).padStart(2, "0");
  const key = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
  const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const dowOf = (y, m, d) => utc(y, m, d).getUTCDay();  // 0 = Sun
  const fromDate = (dt) => [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  const addDays = (y, m, d, n) => fromDate(new Date(Date.UTC(y, m - 1, d + n)));

  // nth weekday of a month (n = 1..5), e.g. 1st Monday of May
  function nth(y, m, wd, n) {
    const first = dowOf(y, m, 1);
    return [y, m, 1 + ((wd - first + 7) % 7) + (n - 1) * 7];
  }
  // last weekday of a month, e.g. last Monday of August
  function last(y, m, wd) {
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lastDow = dowOf(y, m, days);
    return [y, m, days - ((lastDow - wd + 7) % 7)];
  }
  // last given weekday strictly before a date, e.g. Victoria Day = Mon before 25 May
  function before(y, m, d, wd) {
    let [yy, mm, dd] = addDays(y, m, d, -1);
    while (dowOf(yy, mm, dd) !== wd) [yy, mm, dd] = addDays(yy, mm, dd, -1);
    return [yy, mm, dd];
  }

  // Western Easter Sunday (anonymous Gregorian algorithm)
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return [y, month, day];
  }
  // Orthodox Easter Sunday (Meeus Julian algorithm, +13 days, valid 1900-2099)
  function orthodoxEaster(y) {
    const a = y % 4, b = y % 7, c = y % 19;
    const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31);
    const day = ((d + e + 114) % 31) + 1;
    return addDays(y, month, day, 13);
  }

  // Move weekend holidays to the next free weekday. `sat` = whether Saturday
  // holidays move too (South Africa only moves Sunday ones). Only names in
  // `which` move; pass null to move everything not in `never`.
  function substitute(list, { sat = true, which = null, never = [] } = {}) {
    const taken = new Set(list.map(([y, m, d]) => key(y, m, d)));
    const out = list.slice();
    const sorted = list.slice().sort((p, q) => key(p[0], p[1], p[2]).localeCompare(key(q[0], q[1], q[2])));
    for (const [y, m, d, name] of sorted) {
      const wd = dowOf(y, m, d);
      const weekend = wd === 0 || (sat && wd === 6);
      if (!weekend) continue;
      if (which && !which.includes(name)) continue;
      if (never.includes(name)) continue;
      let [yy, mm, dd] = addDays(y, m, d, 1);
      while (dowOf(yy, mm, dd) === 0 || dowOf(yy, mm, dd) === 6 || taken.has(key(yy, mm, dd))) {
        [yy, mm, dd] = addDays(yy, mm, dd, 1);
      }
      taken.add(key(yy, mm, dd));
      out.push([yy, mm, dd, name + " (substitute)"]);
    }
    return out;
  }

  const at = (ymd, name) => [ymd[0], ymd[1], ymd[2], name];

  // ---- Hand-entered dates (no rule can predict these) ----

  // India: core holidays most private firms observe, from the central
  // government gazetted lists. Firms vary, so edit freely.
  const IN_LUNAR = {
    2026: [["03-04", "Holi"], ["10-20", "Dussehra"], ["11-08", "Diwali"]],
    2027: [["03-23", "Holi"], ["10-09", "Dussehra"], ["10-29", "Diwali"]],
  };
  // Victoria: Friday before the AFL Grand Final, once the AFL confirms it.
  const VIC_GF_FRIDAY = { 2026: "09-25" };
  // One-off extra days.
  const EXTRA = {
    BG: { 2026: [["01-02", "Euro changeover day"]] },
  };

  const rules = {
    "GB-ENG": (y) => {
      const e = easter(y);
      return substitute([
        [y, 1, 1, "New Year's Day"],
        at(addDays(...e, -2), "Good Friday"),
        at(addDays(...e, 1), "Easter Monday"),
        at(nth(y, 5, 1, 1), "Early May bank holiday"),
        at(last(y, 5, 1), "Spring bank holiday"),
        at(last(y, 8, 1), "Summer bank holiday"),
        [y, 12, 25, "Christmas Day"],
        [y, 12, 26, "Boxing Day"],
      ], { which: ["New Year's Day", "Christmas Day", "Boxing Day"] });
    },

    // Ireland: no automatic weekday substitutes in law, so none here.
    IE: (y) => {
      const e = easter(y);
      const feb1 = dowOf(y, 2, 1);
      const brigid = feb1 === 5 ? [y, 2, 1] : nth(y, 2, 1, 1);
      return [
        [y, 1, 1, "New Year's Day"],
        at(brigid, "St Brigid's Day"),
        [y, 3, 17, "St Patrick's Day"],
        at(addDays(...e, 1), "Easter Monday"),
        at(nth(y, 5, 1, 1), "May bank holiday"),
        at(nth(y, 6, 1, 1), "June bank holiday"),
        at(nth(y, 8, 1, 1), "August bank holiday"),
        at(last(y, 10, 1), "October bank holiday"),
        [y, 12, 25, "Christmas Day"],
        [y, 12, 26, "St Stephen's Day"],
      ];
    },

    "CA-ON": (y) => {
      const e = easter(y);
      return substitute([
        [y, 1, 1, "New Year's Day"],
        at(nth(y, 2, 1, 3), "Family Day"),
        at(addDays(...e, -2), "Good Friday"),
        at(before(y, 5, 25, 1), "Victoria Day"),
        [y, 7, 1, "Canada Day"],
        at(nth(y, 8, 1, 1), "Civic Holiday"),
        at(nth(y, 9, 1, 1), "Labour Day"),
        at(nth(y, 10, 1, 2), "Thanksgiving"),
        [y, 12, 25, "Christmas Day"],
        [y, 12, 26, "Boxing Day"],
      ], { which: ["New Year's Day", "Canada Day", "Christmas Day", "Boxing Day"] });
    },

    "CA-AB": (y) => {
      const e = easter(y);
      return substitute([
        [y, 1, 1, "New Year's Day"],
        at(nth(y, 2, 1, 3), "Family Day"),
        at(addDays(...e, -2), "Good Friday"),
        at(before(y, 5, 25, 1), "Victoria Day"),
        [y, 7, 1, "Canada Day"],
        at(nth(y, 8, 1, 1), "Heritage Day"),
        at(nth(y, 9, 1, 1), "Labour Day"),
        at(nth(y, 10, 1, 2), "Thanksgiving"),
        [y, 11, 11, "Remembrance Day"],
        [y, 12, 25, "Christmas Day"],
        [y, 12, 26, "Boxing Day"],
      ], { which: ["New Year's Day", "Canada Day", "Christmas Day", "Boxing Day"] });
    },

    "AU-VIC": (y) => {
      const e = easter(y);
      const gf = VIC_GF_FRIDAY[y];
      // A Grand Final date added under Extra holidays replaces the estimate.
      const gfDay = gf
        ? [y, Number(gf.slice(0, 2)), Number(gf.slice(3)), "AFL Grand Final Friday"]
        : customGrandFinal(y) ? null : at(gfEstimate(y), "AFL Grand Final Friday (est.)");
      return substitute([
        [y, 1, 1, "New Year's Day"],
        [y, 1, 26, "Australia Day"],
        at(nth(y, 3, 1, 2), "Labour Day"),
        at(addDays(...e, -2), "Good Friday"),
        at(addDays(...e, -1), "Easter Saturday"),
        at(e, "Easter Sunday"),
        at(addDays(...e, 1), "Easter Monday"),
        [y, 4, 25, "ANZAC Day"],
        at(nth(y, 6, 1, 2), "King's Birthday"),
        gfDay,
        at(nth(y, 11, 2, 1), "Melbourne Cup"),
        [y, 12, 25, "Christmas Day"],
        [y, 12, 26, "Boxing Day"],
      ].filter(Boolean), { which: ["New Year's Day", "Australia Day", "Christmas Day", "Boxing Day"] });
    },

    // South Africa: a holiday on a Sunday moves to Monday; Saturday ones don't.
    ZA: (y) => {
      const e = easter(y);
      return substitute([
        [y, 1, 1, "New Year's Day"],
        [y, 3, 21, "Human Rights Day"],
        at(addDays(...e, -2), "Good Friday"),
        at(addDays(...e, 1), "Family Day"),
        [y, 4, 27, "Freedom Day"],
        [y, 5, 1, "Workers' Day"],
        [y, 6, 16, "Youth Day"],
        [y, 8, 9, "National Women's Day"],
        [y, 9, 24, "Heritage Day"],
        [y, 12, 16, "Day of Reconciliation"],
        [y, 12, 25, "Christmas Day"],
        [y, 12, 26, "Day of Goodwill"],
      ], { sat: false });
    },

    // Bulgaria: any holiday on a weekend moves to the next working day,
    // except the Easter days, which are always Fri-Mon.
    BG: (y) => {
      const e = orthodoxEaster(y);
      const easterDays = ["Orthodox Good Friday", "Holy Saturday", "Orthodox Easter", "Orthodox Easter Monday"];
      return substitute([
        [y, 1, 1, "New Year's Day"],
        [y, 3, 3, "Liberation Day"],
        at(addDays(...e, -2), easterDays[0]),
        at(addDays(...e, -1), easterDays[1]),
        at(e, easterDays[2]),
        at(addDays(...e, 1), easterDays[3]),
        [y, 5, 1, "Labour Day"],
        [y, 5, 6, "St George's Day"],
        [y, 5, 24, "Day of Bulgarian Culture"],
        [y, 9, 6, "Unification Day"],
        [y, 9, 22, "Independence Day"],
        [y, 12, 24, "Christmas Eve"],
        [y, 12, 25, "Christmas Day"],
        [y, 12, 26, "Second day of Christmas"],
      ], { never: easterDays });
    },

    IN: (y) => {
      const list = [
        [y, 1, 26, "Republic Day"],
        [y, 8, 15, "Independence Day"],
        [y, 10, 2, "Gandhi Jayanti"],
        [y, 12, 25, "Christmas Day"],
      ];
      for (const [md, name] of IN_LUNAR[y] || []) {
        list.push([y, Number(md.slice(0, 2)), Number(md.slice(3)), name]);
      }
      return list;
    },
  };

  // ---- Extra holidays from the settings page ----
  // [{ region, date: "YYYY-MM-DD", name }]. Fills gaps in the hand-entered data
  // above (a new year's Indian festivals, a confirmed Grand Final Friday) and
  // covers anything else, like a company day off.
  let CUSTOM = [];
  const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(Date.parse(s));

  function setCustom(list) {
    CUSTOM = (Array.isArray(list) ? list : []).filter((c) => c && rules[c.region] && isYmd(c.date) && (c.name || "").trim());
    for (const k of Object.keys(cache)) delete cache[k];
  }
  const customFor = (region, y) => CUSTOM.filter((c) => c.region === region && c.date.startsWith(y + "-"));
  const customGrandFinal = (y) => customFor("AU-VIC", y).some((c) => /grand final/i.test(c.name));
  const gfEstimate = (y) => addDays(...last(y, 9, 6), -1);  // Friday before the last Saturday of September

  const cache = {};
  function table(region, y) {
    const ck = region + ":" + y;
    if (cache[ck]) return cache[ck];
    const map = new Map();
    const rule = rules[region];
    if (rule) {
      const extra = ((EXTRA[region] || {})[y] || []).map(([md, n]) => [y, Number(md.slice(0, 2)), Number(md.slice(3)), n]);
      const custom = customFor(region, y).map((c) => [y, Number(c.date.slice(5, 7)), Number(c.date.slice(8)), c.name.trim()]);
      for (const [yy, mm, dd, name] of rule(y).concat(extra, custom)) {
        const k = key(yy, mm, dd);
        if (!map.has(k)) map.set(k, name);  // first name wins on a clash
      }
    }
    cache[ck] = map;
    return map;
  }

  // Gaps in the hand-entered data that matter soon: this year, plus next year
  // once it's within six months. Only for regions in `regions`.
  function missingData(regions, now) {
    const today = now || new Date();
    const y0 = today.getUTCFullYear();
    const years = new Set([y0, new Date(today.getTime() + 183 * 86400000).getUTCFullYear()]);
    const out = [];
    for (const y of years) {
      if (regions.includes("IN") && !IN_LUNAR[y] && !customFor("IN", y).length) {
        out.push({
          region: "IN", year: y, level: "missing",
          text: "India: Holi, Dussehra and Diwali dates for " + y + " aren't built in, so sites using India's holidays will show as working on those days. Add them under Extra holidays.",
        });
      }
      if (regions.includes("AU-VIC") && !VIC_GF_FRIDAY[y] && !customGrandFinal(y)) {
        const est = gfEstimate(y);
        if (Date.UTC(est[0], est[1] - 1, est[2]) > today.getTime()) {
          out.push({
            region: "AU-VIC", year: y, level: "estimate",
            text: "Victoria: AFL Grand Final Friday " + y + " is estimated as " + key(...est) +
              ". Once the AFL confirms it, add it under Extra holidays with \"Grand Final\" in the name.",
          });
        }
      }
    }
    return out;
  }

  function getHoliday(region, ymd) {
    if (!region) return null;
    const y = Number(ymd.slice(0, 4));
    return table(region, y).get(ymd) || table(region, y - 1).get(ymd) || null;
  }

  // Handy for checking: every holiday for a region and year, sorted.
  function list(region, y) {
    return [...table(region, y).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  // Whether we have a confirmed (not estimated) entry for the hand-entered data.
  function coverage() {
    return { IN: Object.keys(IN_LUNAR).map(Number), VIC_GF: Object.keys(VIC_GF_FRIDAY).map(Number) };
  }

  return { getHoliday, list, coverage, easter, orthodoxEaster, setCustom, missingData };
})();
