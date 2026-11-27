// Pure plan text parsing and serialisation. No storage, no server, no AI.

export const FLAGS = ["finish", "denial", "dark", "soft"];

const PLAN_TYPES = ["full", "forced", "payoff", "denial"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PIPE = /^(\d{4}-\d{2}-\d{2})\s*\|\s*(\d{1,3})\s*\|\s*([0-5])\s*\|\s*(full|forced|payoff|denial)\s*\|\s*(finish|denial|dark|soft|-)\s*(?:\|\s*(.*))?$/i;
const PROSE = /^(?:[-*\u2022]\s*)?(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+(\d{1,2})(?:\s+[a-z]+)?\s*[\u00b7|]\s*(\d{1,3})\s*min\s*[\u00b7|]\s*level\s*([1-5])\s*(?:[\u00b7|]\s*(finish|denial|dark|soft|-))?\s*(?:[\u00b7|]\s*(.*))?$/i;
const PROSE_DARK = /^(?:[-*\u2022]\s*)?(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\s+(\d{1,2})\s*[\u00b7|]\s*dark\b\s*(?:[\u00b7|]\s*(.*))?$/i;

const MAX_DAYS = 120;

// Local calendar date: a night is the date it is lived in.
function iso(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date, count) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count, 12);
}

export function parsePlan(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const errors = [];
  const byDate = new Map();

  let name = "Imported plan";
  let mode = "quiet";
  let start = null;

  function pushNight({ at, date, minutes, level, plan, flag, note }) {
    if (!PLAN_TYPES.includes(plan)) plan = "full";
    const isDark = flag === "dark" || minutes === 0;
    if (!isDark && (minutes < 1 || minutes > 180)) {
      errors.push({ at, reason: `${minutes} min is out of range` });
    }
    byDate.set(iso(date), {
      at,
      date: iso(date),
      weekday: DAY_NAMES[date.getDay()],
      minutes: isDark ? 0 : minutes,
      level: isDark ? 0 : Math.min(5, Math.max(1, level)),
      plan,
      flag: isDark ? "dark" : FLAGS.includes(flag) ? flag : "finish",
      note: (note ?? "").trim().slice(0, 200) || undefined,
      denial: flag === "denial",
      dark: isDark,
    });
  }

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const at = index + 1;
    if (!line) return;

    if (line.startsWith("#")) {
      const value = line.replace(/^#+\s*/, "").trim();
      if (value) name = value.slice(0, 80);
      return;
    }

    const header = /^(mode|start|weeks)\s*:\s*(.+)$/i.exec(line);
    if (header) {
      const key = header[1].toLowerCase();
      const value = header[2].trim();
      if (key === "mode") {
        if (value !== "quiet" && value !== "machine") errors.push({ at, reason: "mode must be quiet or machine" });
        else mode = value;
      } else if (key === "start") {
        const parsed = new Date(`${value}T12:00:00`);
        if (Number.isNaN(parsed.getTime())) errors.push({ at, reason: "bad start date" });
        else start = parsed;
      }
      return;
    }

    const piped = PIPE.exec(line);
    if (piped) {
      const date = new Date(`${piped[1]}T12:00:00`);
      if (Number.isNaN(date.getTime())) {
        errors.push({ at, reason: "bad date" });
        return;
      }
      pushNight({ at, date, minutes: Number(piped[2]), level: Number(piped[3]), plan: piped[4], flag: piped[5], note: piped[6] });
      return;
    }

    const prose = PROSE.exec(line) ?? PROSE_DARK.exec(line);
    if (prose) {
      if (!start) {
        errors.push({ at, reason: "prose lines need a start: line" });
        return;
      }
      const dayNumber = Number(prose[1]);
      const dark = PROSE_DARK.test(line);
      const date = resolveDate(start, dayNumber);
      if (!date) {
        errors.push({ at, reason: `cannot place day ${dayNumber}` });
        return;
      }
      pushNight({
        at,
        date,
        minutes: dark ? 0 : Number(prose[2]),
        level: dark ? 0 : Number(prose[3]),
        plan: "full",
        flag: dark ? "dark" : prose[4] ?? "-",
        note: dark ? prose[2] : prose[5],
      });
      return;
    }

    errors.push({ at, reason: "unrecognised line" });
  });

  const ordered = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (start && ordered.length) {
    const limit = iso(addDays(start, MAX_DAYS));
    const far = ordered.filter((night) => night.date > limit);
    if (far.length) errors.push({ at: 0, reason: `${far.length} nights past ${MAX_DAYS} days from the start` });
  }

  return { name, mode, start: start ? iso(start) : null, nights: ordered, errors };
}

function resolveDate(start, dayNumber) {
  for (let offset = 0; offset <= MAX_DAYS; offset += 1) {
    const candidate = addDays(start, offset);
    if (candidate.getDate() === dayNumber) return candidate;
  }
  return null;
}

export function serializePlan(programme, nights = []) {
  const lines = [`# ${programme?.name ?? "Plan"}`, `mode: ${programme?.mode ?? "quiet"}`];
  if (programme?.start_date) lines.push(`start: ${programme.start_date}`);
  lines.push("");
  for (const night of [...nights].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const flag = night.status === "dark" ? "dark" : night.denial ? "denial" : "finish";
    const note = night.note ? ` | ${night.note}` : "";
    lines.push(`${night.date} | ${night.minutes ?? 0} | ${night.level ?? 0} | ${night.plan_type ?? "full"} | ${flag}${note}`);
  }
  return lines.join("\n");
}

export function planSummary(parsed) {
  const dark = parsed.nights.filter((night) => night.dark).length;
  const denial = parsed.nights.filter((night) => night.denial).length;
  const first = parsed.nights[0]?.date ?? null;
  const last = parsed.nights[parsed.nights.length - 1]?.date ?? null;
  return { nights: parsed.nights.length, dark, denial, first, last };
}

// The mode control edits the header line, so the text stays the source of truth.
export function setPlanMode(text, mode) {
  const lines = String(text ?? "").split(/\r?\n/);
  const index = lines.findIndex((line) => /^mode\s*:/i.test(line.trim()));
  if (index >= 0) lines[index] = `mode: ${mode}`;
  else lines.unshift(`mode: ${mode}`);
  return lines.join("\n");
}