// Pure, deterministic programme builder. No storage, no server, no AI.

export const LENGTHS = [4, 8, 12];

const ORDER = {
  4: ["recovery", "load", "pressure", "consolidation"],
  8: ["recovery", "load", "stretch", "pressure", "endurance", "density", "peak", "consolidation"],
  12: [
    "recovery", "load", "stretch", "pressure", "endurance", "density",
    "peak", "plateau", "endurance", "peak", "pressure", "consolidation",
  ],
};

// Monday to Sunday: [minutes, level, plan, denial]
const SHAPE = {
  recovery: [[25, 1, "full", 0], [20, 1, "full", 0], [25, 2, "full", 0], [30, 2, "full", 0], [45, 3, "full", 0], [60, 4, "full", 0], [0, 0, "full", 0]],
  load: [[25, 2, "full", 0], [30, 2, "full", 0], [30, 2, "full", 1], [30, 2, "full", 0], [50, 3, "full", 0], [60, 4, "full", 0], [0, 0, "full", 0]],
  stretch: [[30, 2, "full", 0], [30, 2, "full", 0], [35, 2, "full", 0], [35, 3, "full", 0], [50, 3, "full", 0], [60, 4, "full", 0], [0, 0, "full", 0]],
  pressure: [[30, 2, "full", 0], [30, 2, "full", 0], [30, 2, "full", 1], [30, 3, "full", 0], [55, 3, "full", 0], [60, 4, "full", 0], [0, 0, "full", 0]],
  endurance: [[25, 1, "full", 0], [30, 2, "full", 0], [30, 2, "full", 0], [35, 3, "full", 1], [55, 3, "full", 0], [60, 4, "full", 0], [0, 0, "full", 0]],
  density: [[30, 2, "full", 0], [30, 2, "full", 0], [30, 2, "full", 0], [35, 3, "full", 0], [55, 3, "full", 0], [60, 4, "full", 0], [0, 0, "full", 0]],
  peak: [[30, 2, "full", 0], [30, 2, "full", 0], [30, 2, "full", 1], [35, 3, "full", 0], [55, 3, "full", 0], [60, 4, "full", 1], [0, 0, "full", 0]],
  plateau: [[30, 2, "full", 0], [30, 2, "full", 1], [30, 2, "full", 0], [35, 3, "full", 0], [50, 3, "full", 0], [60, 4, "full", 0], [0, 0, "full", 0]],
  consolidation: [[30, 2, "full", 0], [30, 2, "full", 0], [30, 2, "full", 0], [30, 2, "full", 0], [45, 3, "full", 0], [60, 3, "full", 0], [0, 0, "full", 0]],
};

const DENIAL_CAP = { peak: 2 };
export const SUCTION_FOR = { 1: "very_low", 2: "low", 3: "mid", 4: "high" };
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const NOTE = {
  recovery: "Rebuild the seal. Hands first, low level, finish every night.",
  load: "First denial. Sit in the raised baseline instead of dropping to zero.",
  stretch: "Minutes up, level flat. Stall at the halfway mark.",
  pressure: "Long kit night. Plug out before the last climb.",
  endurance: "Back-to-back load. Hold the ceiling until the last eight minutes.",
  density: "Edges closer together, less easy work between them.",
  peak: "Two denials, both where they cost. The Saturday one ends the week unspent.",
  plateau: "Hold the peak shape without climbing. No new minutes.",
  consolidation: "Everything comes down. Saturday is a lap, not a test.",
};

// Local calendar date, so a night is the date it is lived in, not its UTC twin.
export function localDate(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayISO() {
  return localDate(new Date());
}

function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12);
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

export function lastDate(startDate, weeks) {
  const start = parseDate(startDate);
  if (!start) return startDate;
  return localDate(addDays(start, weeks * 7 - 1));
}

export function buildNights({ startDate, weeks, mode }) {
  const order = ORDER[weeks];
  if (!order) throw new Error("Unsupported length");

  const start = parseDate(startDate);
  if (!start) throw new Error("Bad start date");

  const nights = [];
  let lastDenial = -2;

  for (let offset = 0; offset < weeks * 7; offset += 1) {
    const date = addDays(start, offset);
    const week = Math.floor(offset / 7) + 1;
    const type = order[week - 1];
    const dow = (date.getDay() + 6) % 7;
    const [minutes, level, plan, wantsDenial] = SHAPE[type][dow];
    const dark = minutes === 0;

    let denial = Boolean(wantsDenial);
    if (denial) {
      const used = nights.filter((night) => night.week === week && night.denial).length;
      if (used >= (DENIAL_CAP[type] ?? 1)) denial = false;
      if (offset - lastDenial === 1) denial = false;
    }
    if (denial) lastDenial = offset;

    const weekend = dow >= 4;
    nights.push({
      week,
      day_index: offset,
      weekday: DAY_NAMES[dow],
      date: localDate(date),
      mode,
      status: dark ? "dark" : "planned",
      plan_type: plan,
      minutes,
      level: dark ? 0 : level,
      suction: !dark && mode === "machine" ? SUCTION_FOR[level] : undefined,
      round_cap: !dark && mode === "machine" ? (weekend ? 7 : 6) : undefined,
      edge_target: !dark && mode === "quiet" ? (weekend ? 8 : 5) : undefined,
      denial,
      note: NOTE[type],
    });
  }

  return nights;
}