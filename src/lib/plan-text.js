// Pure plan text parsing and serialisation. No storage, no server, no AI.

export const FLAGS = ["finish", "denial", "dark", "soft"];

const PLAN_TYPES = ["full", "forced", "payoff", "denial"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const MAX_DAYS = 120;
const MAX_CAP = 12;
const MAX_RUIN = 12;

// Head of a prose line: weekday, day number, optional month, then the rest.
const PROSE_HEAD = /^(?:[-*\u2022]\s*)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+([a-z]+))?\s*[\u00b7|]\s*(.+)$/i;
const PROSE_DARK = /^dark\b\s*(?:[\u00b7|]\s*(.*))?$/i;
const PROSE_BODY = /^(\d{1,3})\s*min\s*[\u00b7|]\s*level\s*([1-5])\s*(?:[\u00b7|]\s*(.*))?$/i;

const isNumber = (value) => typeof value === "string" && /^\d+$/.test(value);
const isFlag = (word) => word === "-" || FLAGS.includes(word.toLowerCase());
const isPlan = (word) => PLAN_TYPES.includes(word.toLowerCase());

// Local calendar date: a night is the date it is lived in.
function iso(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date, count) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count, 12);
}

// Both the month (when given) and the weekday must agree with the date.
function resolveDate(start, { day, weekday, month }) {
  let matchedDayAndMonth = null;
  for (let offset = 0; offset <= MAX_DAYS; offset += 1) {
    const candidate = addDays(start, offset);
    if (candidate.getDate() !== day) continue;
    if (month !== null && candidate.getMonth() !== month) continue;
    if (!matchedDayAndMonth) matchedDayAndMonth = candidate;
    if (candidate.getDay() === weekday) return { date: candidate };
  }
  if (matchedDayAndMonth) return { error: "date does not match its weekday" };
  return { error: `cannot place day ${day}` };
}

export function parsePlan(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const errors = [];
  const byDate = new Map();

  let name = "Imported plan";
  let mode = null;
  let weeks = null;
  let start = null;

  function pushNight({ at, date, minutes, level, plan, flag, note, cap, ruin }) {
    const key = iso(date);
    if (byDate.has(key)) {
      errors.push({ at, reason: `${key} is already listed on line ${byDate.get(key).at}` });
      return;
    }

    const isDark = flag === "dark" || minutes === 0;
    if (!isDark && (minutes < 1 || minutes > 180)) {
      errors.push({ at, reason: `${minutes} min is out of range` });
      return;
    }

    const keptCap = isDark ? null : cap ?? null;
    const keptRuin = isDark ? null : ruin ?? null;

    byDate.set(key, {
      at,
      date: key,
      weekday: DAY_NAMES[date.getDay()],
      minutes: isDark ? 0 : minutes,
      level: isDark ? 0 : Math.min(5, Math.max(1, level)),
      plan: PLAN_TYPES.includes(plan) ? plan : "full",
      flag: isDark ? "dark" : FLAGS.includes(flag) ? flag : "finish",
      note: (note ?? "").trim().slice(0, 200) || undefined,
      denial: flag === "denial",
      dark: isDark,
      cap: keptCap ?? undefined,
      ruin: keptRuin ?? undefined,
      round_cap: keptCap ?? undefined,
      ruin_target: keptRuin ?? undefined,
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
        const normalized = value.toLowerCase();
        if (normalized !== "quiet" && normalized !== "machine") {
          errors.push({ at, reason: "mode must be quiet or machine" });
        } else {
          mode = normalized;
        }
      } else if (key === "start") {
        const parsed = new Date(`${value}T12:00:00`);
        if (Number.isNaN(parsed.getTime())) errors.push({ at, reason: "bad start date" });
        else start = parsed;
      } else if (!isNumber(value) || Number(value) < 1 || Number(value) > 52) {
        errors.push({ at, reason: "weeks must be 1 to 52" });
      } else {
        weeks = Number(value);
      }
      return;
    }

    const prose = PROSE_HEAD.exec(line);
    if (prose) {
      if (!start) {
        errors.push({ at, reason: "prose lines need a start: line" });
        return;
      }
      const weekday = WEEKDAY_INDEX[prose[1].toLowerCase()];
      const day = Number(prose[2]);
      const monthWord = prose[3] ? prose[3].toLowerCase().slice(0, 3) : "";
      const month = MONTHS.includes(monthWord) ? MONTHS.indexOf(monthWord) : null;
      const placed = resolveDate(start, { day, weekday, month });
      if (placed.error) {
        errors.push({ at, reason: placed.error });
        return;
      }

      const tail = prose[4].trim();
      const dark = PROSE_DARK.exec(tail);
      if (dark) {
        pushNight({
          at,
          date: placed.date,
          minutes: 0,
          level: 0,
          plan: "full",
          flag: "dark",
          note: dark[1],
        });
        return;
      }

      const body = PROSE_BODY.exec(tail);
      if (!body) {
        errors.push({ at, reason: "unrecognised line" });
        return;
      }

      const tokens = (body[3] ?? "")
        .split(/[\u00b7|]/)
        .map((token) => token.trim())
        .filter(Boolean);

      let plan = "full";
      let flag = "-";
      if (tokens.length && isFlag(tokens[0])) {
        flag = tokens.shift().toLowerCase();
      } else if (tokens.length && isPlan(tokens[0])) {
        plan = tokens.shift().toLowerCase();
        if (tokens.length && isFlag(tokens[0])) flag = tokens.shift().toLowerCase();
      }

      pushNight({
        at,
        date: placed.date,
        minutes: Number(body[1]),
        level: Number(body[2]),
        plan,
        flag,
        note: tokens.join(" \u00b7 "),
      });
      return;
    }

    if (line.includes("|")) {
      const cells = line.split("|").map((cell) => cell.trim());
      const dateCell = cells[0];
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateCell) ? new Date(`${dateCell}T12:00:00`) : null;
      if (!date || Number.isNaN(date.getTime())) {
        errors.push({ at, reason: "bad date" });
        return;
      }
      if (!isNumber(cells[1]) || !isNumber(cells[2])) {
        errors.push({ at, reason: "minutes and level must be numbers" });
        return;
      }

      let index = 5;
      let cap;
      let ruin;
      if (isNumber(cells[index])) {
        cap = Number(cells[index]);
        index += 1;
      } else if (cells[index] === "-") {
        index += 1;
      }
      if (isNumber(cells[index])) {
        ruin = Number(cells[index]);
        index += 1;
      } else if (cells[index] === "-") {
        index += 1;
      }
      const note = cells.slice(index).join(" | ");

      if (cap !== undefined && (cap < 0 || cap > MAX_CAP)) {
        errors.push({ at, reason: `cap must be 0 to ${MAX_CAP}` });
        return;
      }
      if (ruin !== undefined && (ruin < 1 || ruin > MAX_RUIN)) {
        errors.push({ at, reason: `ruin must be 1 to ${MAX_RUIN}` });
        return;
      }

      pushNight({
        at,
        date,
        minutes: Number(cells[1]),
        level: Number(cells[2]),
        plan: (cells[3] ?? "").toLowerCase(),
        flag: (cells[4] ?? "").toLowerCase(),
        note,
        cap,
        ruin,
      });
      return;
    }

    errors.push({ at, reason: "unrecognised line" });
  });

  if (!mode) errors.push({ at: 0, reason: "mode: quiet or mode: machine is required" });

  const ordered = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (start && ordered.length) {
    const limit = iso(addDays(start, MAX_DAYS));
    const far = ordered.filter((night) => night.date > limit);
    if (far.length) {
      const label = far.length === 1 ? "night" : "nights";
      errors.push({ at: far[0].at, reason: `${far.length} ${label} past ${MAX_DAYS} days from the start` });
    }
  }

  return { name, mode, weeks, start: start ? iso(start) : null, nights: ordered, errors };
}

export function serializePlan(programme, nights = []) {
  const lines = [`# ${programme?.name ?? "Plan"}`, `mode: ${programme?.mode ?? "quiet"}`];
  if (programme?.start_date) lines.push(`start: ${programme.start_date}`);
  if (programme?.weeks) lines.push(`weeks: ${programme.weeks}`);
  lines.push("");

  for (const night of [...nights].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const flag =
      night.flag ?? (night.status === "dark" ? "dark" : night.denial ? "denial" : "finish");
    const cap = night.round_cap ?? night.cap;
    const ruin = night.ruin_target ?? night.ruin;
    const cells = [night.date, night.minutes ?? 0, night.level ?? 0, night.plan_type ?? "full", flag];
    if (cap != null || ruin != null) {
      cells.push(cap != null ? String(cap) : "-");
      if (ruin != null) cells.push(String(ruin));
    }
    if (night.note) cells.push(night.note);
    lines.push(cells.join(" | "));
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