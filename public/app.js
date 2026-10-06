"use strict";

const MAX_LEAVE = 5;      // most leave days we'll suggest for a single break
const HORIZON = 366;      // plan this many days ahead
const SEARCH = 14;        // how far either side of a holiday a break can stretch

const state = {
  today: "",
  days: [],
  breaks: [],
  chosen: [],        // per break: index into its options, or -1 if skipped
  custom: false,
  budget: 7,
  selected: 0,
  forecast: null,
  lastYear: new Map(),
  verdictToken: "",
  month: 0,           // month shown in "Where to dive" (1–12)
  monthPinned: false, // true once the user picks a month themselves
};

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const short = (s) => parse(s).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
const range = (a, b) => (a === b ? short(a) : `${short(a)} – ${short(b)}`);
const sgToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const wmo = (c) => c == null ? "–" : c === 0 ? "Clear" : c <= 2 ? "Partly cloudy" : c === 3 ? "Cloudy" : c <= 48 ? "Fog"
  : c <= 57 ? "Drizzle" : c <= 67 ? "Rain" : c <= 77 ? "Snow" : c <= 82 ? "Showers" : c <= 86 ? "Snow showers" : "Thunderstorms";
const monthOf = (s) => Number(s.slice(5, 7));
const monthName = (m) => parse(`2000-${String(m).padStart(2, "0")}-01`).toLocaleDateString("en-SG", { month: "long" });
const openFor = (d, dates) => dates.every((s) => d.season.includes(monthOf(s)));

/* ---------- data: called straight from the browser (all four APIs allow it, no keys) ---------- */
// Malaysian dive islands you can reach over the Causeway. All four sit on the east coast,
// which shuts for the northeast monsoon (resorts and boats stop, roughly Nov–Feb).
const EAST_COAST_SEASON = [3, 4, 5, 6, 7, 8, 9, 10];
const DESTINATIONS = [
  { id: "tioman", name: "Tioman Island", lat: 2.8167, lon: 104.1667, season: EAST_COAST_SEASON,
    getting: "Drive across Woodlands to Mersing, then take the ferry." },
  { id: "aur", name: "Pulau Aur & Dayang", lat: 2.4500, lon: 104.5167, season: EAST_COAST_SEASON,
    getting: "Drive across Woodlands to Mersing, then a dive boat out (usually a 3-day trip)." },
  { id: "redang", name: "Redang", lat: 5.7800, lon: 103.0100, season: EAST_COAST_SEASON,
    getting: "Fly to Kuala Terengganu, or drive across Woodlands; ferry from Merang." },
  { id: "perhentian", name: "Perhentian Islands", lat: 5.9100, lon: 102.7400, season: EAST_COAST_SEASON,
    getting: "Fly to Kota Bharu, or drive across Woodlands; ferry from Kuala Besut." },
];

// Where to dive, month by month. "months" are the best months; seasons are typical, not guaranteed.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SITES = [
  { place: "Tioman Island", country: "Malaysia", months: [3, 4, 5, 6, 7, 8, 9, 10], tripDays: 3,
    animals: "Green and hawksbill turtles, blacktip reef sharks, nudibranchs",
    season: "Mar–Oct. Closed for the monsoon Nov–Feb.", how: "Drive via Woodlands, ferry from Mersing" },
  { place: "Pulau Aur & Dayang", country: "Malaysia", months: [3, 4, 5, 6, 7, 8, 9, 10], tripDays: 3,
    animals: "Offshore pinnacles with big schools of fish and passing pelagics",
    season: "Mar–Oct, same monsoon closure as Tioman.", how: "Drive via Woodlands, dive boat from Mersing" },
  { place: "Perhentian & Redang", country: "Malaysia", months: [3, 4, 5, 6, 7, 8, 9, 10], tripDays: 4,
    animals: "Turtles, blacktip reef sharks, easy reef dives",
    season: "Mar–Oct, peak May–Aug. Closed Nov–Feb.", how: "Fly to Kota Bharu or Kuala Terengganu, or a long drive via Woodlands" },
  { place: "Sipadan", country: "Malaysia (Sabah)", months: [4, 5, 6, 7, 8, 9, 10], tripDays: 5,
    animals: "Barracuda tornado, schools of jacks, turtles on almost every dive",
    season: "Year-round, best Apr–Oct. Has closed for a conservation break in Nov; daily permits are limited.", how: "Fly to Tawau, transfer to Semporna" },
  { place: "Layang-Layang", country: "Malaysia (Sabah)", months: [3, 4, 5, 6, 7, 8], tripDays: 6,
    animals: "Schools of scalloped hammerhead sharks (best Apr–May)",
    season: "Mar–Aug only. The island's one resort closes the rest of the year.", how: "Fly to Kota Kinabalu, then a charter flight" },
  { place: "Similan Islands", country: "Thailand", months: [11, 12, 1, 2, 3, 4], tripDays: 5,
    animals: "Manta rays, a chance of whale sharks, big granite reefs",
    season: "Nov–Apr. The national park closes in the wet season.", how: "Fly to Phuket, then a liveaboard" },
  { place: "Raja Ampat", country: "Indonesia", months: [10, 11, 12, 1, 2, 3, 4], tripDays: 10,
    animals: "Manta rays, wobbegong sharks, the richest reefs on Earth",
    season: "Oct–Apr is the prime season.", how: "Fly to Sorong via Jakarta or Makassar" },
  { place: "Komodo", country: "Indonesia", months: [4, 5, 6, 7, 8, 9, 10, 11], tripDays: 6,
    animals: "Manta rays, reef sharks, fast drift dives",
    season: "Apr–Nov for the best conditions; best Jun–Oct.", how: "Fly to Labuan Bajo via Bali or Jakarta" },
  { place: "Nusa Penida, Bali", country: "Indonesia", months: [7, 8, 9, 10], tripDays: 4,
    animals: "Mola mola (oceanic sunfish), plus manta rays all year",
    season: "Mola mola Jul–Oct, most reliable Jul–Sep. Cold water: bring a thicker wetsuit.", how: "Fly to Bali, boat to Nusa Penida" },
  { place: "Tubbataha Reefs", country: "Philippines", months: [3, 4, 5, 6], tripDays: 8,
    animals: "Reef sharks, whale sharks, hammerheads, huge schools of jacks",
    season: "Only mid-Mar to mid-Jun, liveaboard only.", how: "Fly to Puerto Princesa, then a liveaboard" },
  { place: "Malapascua", country: "Philippines", months: [11, 12, 1, 2, 3, 4, 5], tripDays: 5,
    animals: "Thresher sharks at dawn on Monad Shoal (seen year-round)",
    season: "Dry season Nov–May; peak threshers Jan–Apr.", how: "Fly to Cebu, drive north, boat across" },
  { place: "Ningaloo Reef", country: "Australia", months: [3, 4, 5, 6, 7, 8], tripDays: 6,
    animals: "Swim with whale sharks (snorkel trips), plus reef dives",
    season: "Whale sharks Mar–Aug.", how: "Fly to Perth, then Exmouth" },
];
const SEASON_SOURCES = [
  ["DivePlanit: Tioman & Perhentian", "https://www.diveplanit.com/destination/tioman-island"],
  ["PADI: mantas by month", "https://blog.padi.com/best-places-to-dive-with-manta-rays-by-month/"],
  ["Dive The World: Sipadan", "https://www.dive-the-world.com/posts/sipadan/best-time-for-sipadan-diving-optimal-conditions.php"],
  ["Underwater Asia: Layang-Layang", "https://underwaterasia.info/malaysia/layang-layang-diving"],
  ["Liveaboard.com: Malapascua", "https://www.liveaboard.com/diving/season-calendar/best-time-to-dive-in-malapascua"],
  ["Ocean Earth Travels: Bali mola mola", "https://www.oceanearthtravels.com/scuba-diving/mola-mola-diving-bali-season"],
];
// LTA traffic cameras at the two land checkpoints (IDs from the data.gov.sg feed).
const CAMERAS = {
  2701: { checkpoint: "woodlands", label: "Woodlands Causeway, towards Johor" },
  2702: { checkpoint: "woodlands", label: "Woodlands Checkpoint" },
  4703: { checkpoint: "tuas", label: "Tuas Second Link" },
  4713: { checkpoint: "tuas", label: "Tuas Checkpoint" },
};
const LAT = DESTINATIONS.map((d) => d.lat).join(",");
const LON = DESTINATIONS.map((d) => d.lon).join(",");

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}.`);
  return res.json();
}

// Reuse a response while it's fresh; if the provider fails, fall back to the last good copy.
const memo = new Map();
async function cached(key, ttl, load) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  try {
    const value = await load();
    memo.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}
const shiftYear = (s, n) => { const [y, m, d] = s.split("-"); return iso(new Date(Number(y) + n, m - 1, d)); };
const points = (raw) => (Array.isArray(raw) ? raw : [raw]);

async function loadHolidays() {
  const y = Number(state.today.slice(0, 4));
  const lists = await Promise.all([y, y + 1].map((yr) =>
    cached(`holidays-${yr}`, 12 * 3600e3, () => getJSON(`https://date.nager.at/api/v3/PublicHolidays/${yr}/SG`))));
  return lists.flat().map((h) => ({ date: h.date, name: h.name }));
}

async function loadForecast() {
  const raw = await cached("forecast", 30 * 60e3, () => getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&daily=weather_code,temperature_2m_max,precipitation_probability_max,precipitation_sum&timezone=Asia%2FSingapore&forecast_days=16`));
  return {
    destinations: DESTINATIONS.map((d, i) => {
      const daily = points(raw)[i].daily;
      return { ...d, days: daily.time.map((date, k) => ({
        date, code: daily.weather_code[k], tmax: daily.temperature_2m_max[k],
        rainProb: daily.precipitation_probability_max[k], rainMm: daily.precipitation_sum[k],
      })) };
    }),
  };
}

async function loadLastYear(start, end) {
  const from = shiftYear(start, -1);
  const to = shiftYear(end, -1);
  const raw = await cached(`lastyear-${from}-${to}`, 24 * 3600e3, () => getJSON(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=${from}&end_date=${to}` +
    `&daily=weather_code,temperature_2m_max,precipitation_sum,precipitation_hours&timezone=Asia%2FSingapore`));
  return {
    destinations: DESTINATIONS.map((d, i) => {
      const daily = points(raw)[i].daily;
      return { ...d, days: daily.time.map((lastYearDate, k) => ({
        date: addDays(start, k), lastYearDate, code: daily.weather_code[k], tmax: daily.temperature_2m_max[k],
        rainMm: daily.precipitation_sum[k], rainHours: daily.precipitation_hours[k],
      })) };
    }),
  };
}

async function loadCamData() {
  const raw = await cached("cams", 60e3, () => getJSON("https://api.data.gov.sg/v1/transport/traffic-images"));
  return {
    cameras: (raw.items?.[0]?.cameras || [])
      .filter((c) => CAMERAS[c.camera_id])
      .map((c) => ({ id: c.camera_id, ...CAMERAS[c.camera_id], image: c.image, timestamp: c.timestamp })),
  };
}
const errorHTML = (msg, retry) =>
  `<div class="error"><p><b>Couldn't load this.</b> ${esc(msg)} Check that your internet connection is on.</p>${retry ? `<button type="button" class="open" data-retry="${retry}">Try again</button>` : ""}</div>`;

/* ---------- calendar + break finder ---------- */
function buildDays(holidays) {
  const hol = new Map();
  holidays.forEach((h) => { if (!hol.has(h.date)) hol.set(h.date, h.name); });
  const out = [];
  let d = state.today;
  for (let i = 0; i < HORIZON + SEARCH + 7; i++) {
    const wd = parse(d).getDay();
    out.push({ date: d, wd, hol: hol.get(d) || null, off: wd === 0 || wd === 6 || hol.has(d) });
    d = addDays(d, 1);
  }
  return out;
}

// For each holiday, find the longest run of days off you can get for 0, 1, 2… leave days.
function buildBreaks() {
  const days = state.days;
  const work = [0];
  days.forEach((d) => work.push(work[work.length - 1] + (d.off ? 0 : 1)));
  const anchors = days.map((d, i) => (d.hol && i <= HORIZON ? i : -1)).filter((i) => i >= 0);
  const groups = new Map();

  for (const a of anchors) {
    const opts = [];
    let prevLen = 0;
    for (let L = 0; L <= MAX_LEAVE; L++) {
      let best = null;
      for (let s = Math.max(0, a - SEARCH); s <= a; s++) {
        for (let e = a; e <= Math.min(days.length - 1, a + SEARCH); e++) {
          const w = work[e + 1] - work[s];
          if (w > L) break;
          const len = e - s + 1;
          if (!best || len > best.len || (len === best.len && w < best.leave)) best = { s, e, len, leave: w };
        }
      }
      if (best && best.len > prevLen) { opts.push(best); prevLen = best.len; }
    }
    const key = `${opts[0].s}-${opts[0].e}`;   // holidays sharing one long weekend form one break
    if (!groups.has(key)) groups.set(key, { anchors: [], opts: [] });
    const g = groups.get(key);
    g.anchors.push(a);
    g.opts.push(...opts);
  }

  return [...groups.values()]
    .map((g) => {
      const seen = new Set();
      let prev = 0;
      const opts = g.opts
        .filter((o) => { const k = `${o.s}-${o.e}`; if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((x, y) => x.leave - y.leave || y.len - x.len)
        .filter((o) => { if (o.len <= prev) return false; prev = o.len; return true; })
        .map(enrich);
      const name = [...new Set(g.anchors.map((a) => days[a].hol))].join(" + ");
      return { name, anchor: g.anchors[0], opts };
    })
    .sort((x, y) => x.opts[0].s - y.opts[0].s);
}

function enrich(o) {
  const win = state.days.slice(o.s, o.e + 1);
  return {
    ...o,
    id: `${win[0].date}_${win[win.length - 1].date}`,
    start: win[0].date,
    end: win[win.length - 1].date,
    leaveDates: win.filter((d) => !d.off).map((d) => d.date),
    hols: [...new Set(win.filter((d) => d.hol).map((d) => d.hol))],
  };
}

// Pick at most one option per break, with no overlaps, to get the most days off within the leave budget.
function optimise() {
  const items = [];
  state.breaks.forEach((b, bi) => b.opts.forEach((o, oi) => items.push({ bi, oi, s: o.s, e: o.e, v: o.len, w: o.leave })));
  items.sort((x, y) => x.e - y.e);
  const n = items.length;
  const B = state.budget;
  const prev = items.map((it, i) => { let j = i - 1; while (j >= 0 && items[j].e >= it.s) j--; return j; });
  const dp = Array.from({ length: n + 1 }, () => new Array(B + 1).fill(0));
  for (let i = 0; i < n; i++) {
    const it = items[i];
    for (let b = 0; b <= B; b++) {
      let best = dp[i][b];
      if (it.w <= b) best = Math.max(best, it.v + dp[prev[i] + 1][b - it.w]);
      dp[i + 1][b] = best;
    }
  }
  // Use the fewest leave days that still reach the best total.
  let b = 0;
  while (b < B && dp[n][b] < dp[n][B]) b++;
  const chosen = state.breaks.map(() => -1);
  let i = n;
  while (i > 0) {
    if (dp[i][b] === dp[i - 1][b]) { i--; continue; }
    const it = items[i - 1];
    chosen[it.bi] = it.oi;
    b -= it.w;
    i = prev[i - 1] + 1;
  }
  state.chosen = chosen;
  state.custom = false;
}

const pick = (bi) => { const b = state.breaks[bi]; const oi = state.chosen[bi]; return b.opts[oi >= 0 ? oi : 0]; };
function coveredBy(bi) {
  const a = state.breaks[bi].anchor;
  return state.breaks.findIndex((b, j) => j !== bi && state.chosen[j] >= 0 && b.opts[state.chosen[j]].s <= a && b.opts[state.chosen[j]].e >= a);
}
function overlaps() {
  const picks = state.breaks.map((b, i) => (state.chosen[i] >= 0 ? { i, o: b.opts[state.chosen[i]] } : null)).filter(Boolean);
  const out = [];
  for (let x = 0; x < picks.length; x++) for (let y = x + 1; y < picks.length; y++) {
    if (picks[x].o.s <= picks[y].o.e && picks[y].o.s <= picks[x].o.e) out.push([picks[x].i, picks[y].i]);
  }
  return out;
}

/* ---------- weather + verdict ---------- */
async function weatherFor(o) {
  const fc = state.forecast;
  const fcDays = fc?.destinations?.[0]?.days || [];
  const fcLast = fcDays.length ? fcDays[fcDays.length - 1].date : null;
  if (fcLast && o.start <= fcLast) {
    return {
      mode: "forecast",
      partial: o.end > fcLast,
      fcLast,
      dests: fc.destinations.map((d) => ({ ...d, days: d.days.filter((x) => x.date >= o.start && x.date <= o.end) })),
    };
  }
  if (!state.lastYear.has(o.id)) {
    state.lastYear.set(o.id, loadLastYear(o.start, o.end).catch((e) => { state.lastYear.delete(o.id); throw e; }));
  }
  const ly = await state.lastYear.get(o.id);
  return { mode: "lastyear", forecastFrom: addDays(o.start, -15), dests: ly.destinations };
}

function judge(w) {
  const open = w.dests.filter((d) => openFor(d, d.days.map((x) => x.date)));
  if (!open.length) return { best: null, level: "closed", n: w.dests[0]?.days.length || 0 };
  const scored = open.map((d) => {
    const n = d.days.length || 1;
    if (w.mode === "forecast") {
      const avg = d.days.reduce((a, x) => a + (x.rainProb ?? 0), 0) / n;
      const wet = d.days.filter((x) => (x.rainProb ?? 0) >= 60 || (x.rainMm ?? 0) >= 5).length;
      return { ...d, avg, wet, score: avg };
    }
    const wet = d.days.filter((x) => (x.rainMm ?? 0) >= 5).length;
    const mm = d.days.reduce((a, x) => a + (x.rainMm ?? 0), 0);
    return { ...d, wet, mm, score: (wet / n) * 100 + mm / 10 };
  }).sort((a, b) => a.score - b.score);
  const best = scored[0];
  const n = best.days.length || 1;
  const level = w.mode === "forecast"
    ? (best.avg < 35 ? "go" : best.avg < 60 ? "maybe" : "wet")
    : (best.wet / n <= 0.34 ? "go" : best.wet / n <= 0.67 ? "maybe" : "wet");
  return { best, level, n };
}

function verdictHTML(j, w, o) {
  const { best, level, n } = j;
  const leave = `<div><dt>Apply for leave</dt><dd>${o.leave ? o.leaveDates.map(short).join(", ") : "None needed"}</dd></div>`;
  if (level === "closed") {
    const m = monthName(monthOf(o.start));
    return `<div class="sign verdict wet"><p class="sign-kicker">Verdict</p><p class="sign-title">Malaysia's islands are closed</p>
      <p>Tioman, Aur, Redang and the Perhentians shut for the northeast monsoon, roughly November to February. Fly somewhere that's in season instead.</p></div>
      <dl class="facts">${leave}</dl>
      <p class="hint"><a href="#where">See where to dive in ${m}</a>.</p>`;
  }
  let title, why;
  if (w.mode === "forecast") {
    title = { go: "Go diving", maybe: "Go, but expect some rain", wet: "Expect a wet trip" }[level];
    why = `Average chance of rain at ${esc(best.name)}: ${Math.round(best.avg)}% across ${plural(n, "day")}${w.partial ? `. The forecast only reaches ${short(w.fcLast)}, so check again closer to the date` : ""}.`;
  } else {
    title = { go: "Good odds", maybe: "Mixed odds", wet: "Often wet on these dates" }[level];
    why = `This isn't a forecast yet. On the same dates last year, ${esc(best.name)} had ${plural(best.wet, "rainy day")} out of ${n}. The real forecast opens on ${short(w.forecastFrom)}.`;
  }
  return `<div class="sign verdict ${level}"><p class="sign-kicker">Verdict</p><p class="sign-title">${title}</p><p>${why}</p></div>
    <dl class="facts">
      <div><dt>Best bet</dt><dd>${esc(best.name)}</dd></div>
      <div><dt>Getting there</dt><dd>${esc(best.getting)}</dd></div>
      ${leave}
    </dl>
    <p class="hint">Long weekends usually bring heavy traffic at the Causeway. Check the live cameras below before you set off. Don't fly within 18 hours of your last dive.</p>`;
}

function wxTable(w, caption, bestId) {
  const dates = w.dests[0]?.days.map((x) => x.date) || [];
  if (!dates.length) return `<p class="muted">No weather data for these dates.</p>`;
  const cell = (x) => {
    if (w.mode === "forecast") {
      const p = x.rainProb ?? 0;
      return `<td><span class="bar" style="--p:${p}%"></span><b>${p}%</b><small>${wmo(x.code)} · ${Math.round(x.tmax)}°</small></td>`;
    }
    const mm = x.rainMm ?? 0;
    return `<td><span class="bar" style="--p:${Math.min(100, mm * 5)}%"></span><b>${mm.toFixed(1)} mm</b><small>${wmo(x.code)} · ${Math.round(x.tmax)}°</small></td>`;
  };
  return `<div class="wx-wrap"><table class="wx">
    <caption>${caption}</caption>
    <thead><tr><th scope="col">Dive island</th>${dates.map((d) => `<th scope="col">${short(d)}</th>`).join("")}</tr></thead>
    <tbody>${w.dests.map((d) => {
      const open = openFor(d, dates);
      return `<tr class="${d.id === bestId ? "best" : ""}${open ? "" : " closed"}"><th scope="row">${esc(d.name)}<small>${open ? "In season" : "Closed: monsoon"}</small></th>${d.days.map(cell).join("")}</tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

async function loadVerdict(o) {
  const token = `${state.selected}:${o.id}`;
  state.verdictToken = token;
  try {
    const w = await weatherFor(o);
    if (state.verdictToken !== token) return;
    const j = judge(w);
    $("#verdict").innerHTML = verdictHTML(j, w, o);
    const caption = w.mode === "forecast"
      ? "Chance of rain each day · Open-Meteo forecast"
      : "Rain on the same dates last year · Open-Meteo archive";
    $("#wx").innerHTML = wxTable(w, caption, j.best?.id);
  } catch (e) {
    if (state.verdictToken !== token) return;
    $("#verdict").innerHTML = `<div class="sign verdict wet"><p class="sign-kicker">Verdict</p><p class="sign-title">Weather unavailable</p><p>${esc(e.message)}</p></div>`;
    $("#wx").innerHTML = "";
  }
}

/* ---------- rendering ---------- */
function strip(o) {
  const from = Math.max(0, o.s - 1);
  const to = Math.min(state.days.length - 1, o.e + 1);
  return `<ol class="strip">${state.days.slice(from, to + 1).map((d, k) => {
    const i = from + k;
    const inside = i >= o.s && i <= o.e;
    const type = d.hol ? "hol" : d.off ? "wkd" : inside ? "leave" : "work";
    const what = d.hol ? d.hol : d.off ? "Weekend" : inside ? "Take leave" : "Work day";
    return `<li class="day ${type}${inside ? "" : " out"}" title="${esc(`${short(d.date)} · ${what}`)}"><span>${parse(d.date).toLocaleDateString("en-SG", { weekday: "short" })}</span><b>${parse(d.date).getDate()}</b></li>`;
  }).join("")}</ol>`;
}

function chips(bi) {
  const b = state.breaks[bi];
  return `<div class="chips">${b.opts.map((o, oi) => {
    const on = state.chosen[bi] === oi;
    const ratio = o.leave ? `<small>${(o.len / o.leave).toFixed(1)} days per leave</small>` : `<small>free</small>`;
    return `<button type="button" class="chip" data-bi="${bi}" data-oi="${oi}" aria-pressed="${on}"><b>${o.leave}</b> leave → <b>${o.len}</b> days ${ratio}</button>`;
  }).join("")}</div>`;
}

function renderHero() {
  const hero = $("#hero");
  const b = state.breaks[state.selected];
  if (!b) {
    hero.innerHTML = `<p class="muted">No Singapore public holidays found in the next 12 months.</p>`;
    return;
  }
  const o = pick(state.selected);
  const inDays = daysBetween(state.today, o.start);
  const isNext = state.selected === 0;
  hero.innerHTML = `
    <div class="hero-main">
      <p class="kicker">${isNext ? "Next dive trip" : "Selected trip"} · ${inDays <= 0 ? "starts today" : `starts in ${plural(inDays, "day")}`}</p>
      <h2>${esc(b.name)}</h2>
      <p class="hero-dates">${range(o.start, o.end)} · <b>${o.len} days off</b> for ${o.leave ? `<b>${plural(o.leave, "leave day")}</b>` : "<b>no leave</b>"}</p>
      ${o.hols.length > 1 ? `<p class="muted">This stretch also covers ${esc(o.hols.filter((h) => !b.name.includes(h)).join(" and "))}.</p>` : ""}
      ${strip(o)}
      <p class="label">How long do you want to go?</p>
      ${chips(state.selected)}
    </div>
    <div class="hero-side" id="verdict"><div class="sign verdict pending"><p class="sign-kicker">Verdict</p><p>Checking the weather for ${range(o.start, o.end)}…</p></div></div>
    <div class="wx-area" id="wx"></div>`;
  loadVerdict(o);
  if (!state.monthPinned) { state.month = monthOf(o.start); renderMonth(); }
}

/* ---------- where to dive, by month ---------- */
// The cheapest break in month m that's long enough for the trip, or a rough leave estimate if none.
function fitFor(site, m) {
  let best = null;
  state.breaks.forEach((b, bi) => b.opts.forEach((o, oi) => {
    if (o.len < site.tripDays || (monthOf(o.start) !== m && monthOf(o.end) !== m)) return;
    if (!best || o.leave < best.o.leave || (o.leave === best.o.leave && o.start < best.o.start)) best = { b, bi, oi, o };
  }));
  if (best) {
    return `<b>${best.o.leave ? plural(best.o.leave, "leave day") : "No leave"}</b> over ${esc(best.b.name)}, ${range(best.o.start, best.o.end)}.
      <button type="button" class="textbtn" data-open="${best.bi}" data-oi="${best.oi}">Plan this</button>`;
  }
  return `<b>${plural(leaveWithoutHoliday(site.tripDays), "leave day")}</b> if you start on a Saturday. No public holiday helps in ${MONTHS[m - 1]}.`;
}

// Fewest leave days for an n-day trip with no public holiday: start on Saturday and use every weekend.
function leaveWithoutHoliday(n) {
  let work = 0;
  for (let k = 0; k < n; k++) if (![6, 0].includes((6 + k) % 7)) work++;
  return work;
}

function renderMonth() {
  const m = state.month;
  if (!m) return;
  const sites = SITES.filter((s) => s.months.includes(m))
    .sort((a, b) => (a.country.startsWith("Malaysia") ? 0 : 1) - (b.country.startsWith("Malaysia") ? 0 : 1) || a.tripDays - b.tripDays);
  $("#monthPicker").innerHTML = MONTHS.map((n, i) =>
    `<button type="button" class="chip month" data-month="${i + 1}" aria-pressed="${i + 1 === m}">${n}</button>`).join("");
  $("#monthTitle").textContent = `Where to dive in ${monthName(m)}`;
  $("#sites").innerHTML = sites.length ? sites.map((s) => `
    <article class="site">
      <p class="country">${esc(s.country)}</p>
      <h3>${esc(s.place)}</h3>
      <p class="animals">${esc(s.animals)}</p>
      <dl class="site-facts">
        <div><dt>Season</dt><dd>${esc(s.season)}</dd></div>
        <div><dt>Trip</dt><dd>${s.tripDays} days</dd></div>
        <div><dt>Getting there</dt><dd>${esc(s.how)}</dd></div>
        <div><dt>Leave</dt><dd>${fitFor(s, m)}</dd></div>
      </dl>
    </article>`).join("") : `<p class="muted">No sites in this guide are at their best in ${monthName(m)}.</p>`;
  $("#seasonSources").innerHTML = `Seasons are typical, not guaranteed. Check with your dive operator before you book. Sources: ${SEASON_SOURCES.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join(", ")}.`;
}

function renderSummary() {
  const picks = state.breaks.map((b, i) => (state.chosen[i] >= 0 ? b.opts[state.chosen[i]] : null)).filter(Boolean);
  const leave = picks.reduce((a, o) => a + o.leave, 0);
  const off = picks.reduce((a, o) => a + o.len, 0);
  const base = state.breaks.reduce((a, b) => a + b.opts[0].len, 0);
  const warns = [];
  if (leave > state.budget) warns.push(`That's ${leave - state.budget} more leave than your budget of ${state.budget}.`);
  if (overlaps().length) warns.push("Some of your picks overlap. Pick a shorter option for one of them.");
  $("#planSummary").innerHTML = `<p>Spend <b>${plural(leave, "leave day")}</b> → get <b>${off} days off</b> across ${plural(picks.length, "break")}. That's ${off - base} more days off than the long weekends alone.
    ${state.custom ? `<button type="button" class="textbtn" id="reset">Back to the best plan</button>` : `<span class="pill">Best plan for ${state.budget} leave</span>`}
    ${warns.map((w) => `<span class="warn">${w}</span>`).join("")}</p>`;
  const reset = $("#reset");
  if (reset) reset.onclick = () => { optimise(); renderAll(); };
}

function renderBreaks() {
  $("#breaks").innerHTML = state.breaks.map((b, bi) => {
    const o = pick(bi);
    const cov = state.chosen[bi] < 0 ? coveredBy(bi) : -1;
    const inDays = daysBetween(state.today, o.start);
    const note = state.chosen[bi] >= 0
      ? (o.leave ? `<p class="note">Apply for: ${o.leaveDates.map(short).join(", ")}</p>` : `<p class="note">No leave needed.</p>`)
      : cov >= 0 ? `<p class="note">Already inside your ${esc(state.breaks[cov].name)} break.</p>` : `<p class="note">Not in your plan. Pick an option to add it.</p>`;
    return `<article class="break${bi === state.selected ? " is-selected" : ""}${cov >= 0 ? " is-covered" : ""}">
      <div class="break-head">
        <div><h3>${esc(b.name)}</h3><p class="when">${range(o.start, o.end)} · ${inDays <= 0 ? "now" : `in ${plural(inDays, "day")}`}</p></div>
        <button type="button" class="open" data-open="${bi}">Weather &amp; verdict</button>
      </div>
      ${strip(o)}
      ${chips(bi)}
      ${note}
    </article>`;
  }).join("");
}

function renderAll() {
  renderSummary();
  renderBreaks();
  renderHero();
}

function renderWeekend() {
  const el = $("#weekend");
  if (!state.forecast) { el.innerHTML = errorHTML("The forecast didn't load.", "forecast"); return; }
  let d = state.today;
  while (![0, 6].includes(parse(d).getDay())) d = addDays(d, 1);
  const dates = parse(d).getDay() === 6 ? [d, addDays(d, 1)] : [d];
  const w = { mode: "forecast", dests: state.forecast.destinations.map((x) => ({ ...x, days: x.days.filter((y) => dates.includes(y.date)) })) };
  el.innerHTML = wxTable(w, `Chance of rain · ${range(dates[0], dates[dates.length - 1])}`, judge(w).best?.id);
}

async function loadCams() {
  const el = $("#cams");
  try {
    const j = await loadCamData();
    const groups = { woodlands: "Woodlands · for Mersing, Tioman, Aur and the east coast", tuas: "Tuas Second Link · for the west coast and KL" };
    const cam = (c) => {
      const t = new Date(c.timestamp);
      const ago = Math.max(0, Math.round((Date.now() - t) / 60000));
      return `<figure class="cam"><a href="${esc(c.image)}" target="_blank" rel="noopener" title="Open full size"><img src="${esc(c.image)}" alt="Live traffic camera: ${esc(c.label)}" loading="lazy" width="1920" height="1080"></a>
        <figcaption><b>${esc(c.label)}</b><span>Taken ${t.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })} · ${ago < 1 ? "just now" : `${plural(ago, "min")} ago`}</span></figcaption></figure>`;
    };
    el.innerHTML = Object.entries(groups).map(([k, title]) => {
      const list = j.cameras.filter((c) => c.checkpoint === k);
      return `<div class="cam-group"><h3>${title}</h3><div class="cam-row">${list.map(cam).join("") || `<p class="muted">No image from this checkpoint right now.</p>`}</div></div>`;
    }).join("");
    $("#camMeta").textContent = `Live LTA cameras · refreshes every minute · last checked ${new Date().toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (e) {
    el.innerHTML = errorHTML(e.message, "cams");
    $("#camMeta").textContent = "";
  }
}

/* ---------- events ---------- */
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip[data-bi]");
  if (chip) {
    const bi = +chip.dataset.bi;
    state.chosen[bi] = +chip.dataset.oi;
    state.custom = true;
    renderSummary();
    renderBreaks();
    if (bi === state.selected) renderHero();
    return;
  }
  const month = e.target.closest("[data-month]");
  if (month) {
    state.month = +month.dataset.month;
    state.monthPinned = true;
    renderMonth();
    return;
  }
  const open = e.target.closest("[data-open]");
  if (open) {
    state.selected = +open.dataset.open;
    state.monthPinned = false;
    if (open.dataset.oi !== undefined) {   // "Plan this" from the month guide picks that exact option
      state.chosen[state.selected] = +open.dataset.oi;
      state.custom = true;
      renderSummary();
    }
    renderBreaks();
    renderHero();
    $("#hero").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const retry = e.target.closest("[data-retry]");
  if (retry) {
    if (retry.dataset.retry === "cams") loadCams();
    else boot();
  }
});

function setBudget(n) {
  state.budget = Math.max(0, Math.min(40, Number.isFinite(n) ? Math.round(n) : 0));
  $("#budget").value = state.budget;
  try { localStorage.setItem("dive-escape-budget", String(state.budget)); } catch {}
  if (!state.breaks.length) return;
  optimise();
  renderAll();
}
$("#bMinus").onclick = () => setBudget(state.budget - 1);
$("#bPlus").onclick = () => setBudget(state.budget + 1);
$("#budget").addEventListener("change", (e) => setBudget(Number(e.target.value)));

/* ---------- start ---------- */
async function boot() {
  state.today = sgToday();
  try { const saved = Number(localStorage.getItem("dive-escape-budget")); if (saved >= 0 && saved <= 40 && localStorage.getItem("dive-escape-budget") !== null) state.budget = saved; } catch {}
  $("#budget").value = state.budget;

  const [hol, fc] = await Promise.allSettled([loadHolidays(), loadForecast()]);
  state.forecast = fc.status === "fulfilled" ? fc.value : null;
  renderWeekend();

  if (hol.status === "rejected") {
    $("#hero").innerHTML = errorHTML(hol.reason.message, "boot");
    return;
  }
  state.days = buildDays(hol.value);
  state.breaks = buildBreaks();
  state.selected = 0;
  optimise();
  renderAll();
}

boot();
loadCams();
setInterval(loadCams, 60000);
