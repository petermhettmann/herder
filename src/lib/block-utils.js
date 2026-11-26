function dayLabel(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// "Nov 1 to Nov 20" for a block's sessions, or a single day when they all fall on one.
export function rangeLabel(sessions = []) {
  const starts = sessions.map((session) => Date.parse(session.start_time)).filter(Number.isFinite);
  if (!starts.length) return "No sessions yet";
  const first = dayLabel(new Date(Math.min(...starts)).toISOString());
  const ends = sessions.map((session) => Date.parse(session.ended_at ?? session.start_time)).filter(Number.isFinite);
  const last = dayLabel(new Date(Math.max(...ends)).toISOString());
  return first === last ? first : `${first} to ${last}`;
}