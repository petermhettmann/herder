// The daily log, totalled for the block.
export default function BlockConditions({ days = [], onLogDay }) {
  const slept = days.filter((day) => typeof day.sleep_hours === "number");
  const drank = days.filter((day) => typeof day.hydration === "number");
  const average = (list, key) =>
    list.length ? list.reduce((total, day) => total + (day[key] ?? 0), 0) / list.length : null;

  const sleepAvg = average(slept, "sleep_hours");
  const waterAvg = average(drank, "hydration");
  const cageDays = days.filter((day) => day.cage).length;
  const denialDays = days.filter((day) => day.denial).length;
  const edges = days.reduce((total, day) => total + (day.edges ?? 0), 0);

  const recent = [...days]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 7);

  return (
    <div className="mt-3 rounded-xl border border-border px-4 py-2">
      <Row label="Nights" value={slept.length ? `${slept.length} · ${sleepAvg.toFixed(1)} h avg` : "—"} />
      <Row label="Hydration" value={waterAvg != null ? `${waterAvg.toFixed(1)} glasses avg` : "—"} />
      <Row label="Cage days" value={cageDays} />
      <Row label="Denial days" value={denialDays} />
      <Row label="Edges" value={edges} last={recent.length === 0} />

      {recent.map((day, index) => (
        <div key={day.id} className="flex items-baseline justify-between gap-3 border-t border-border py-2">
          <span className="tnum shrink-0 text-[11px] text-muted-foreground">{dayLabel(day.date)}</span>
          <span className="tnum truncate text-right text-[11px] text-muted-foreground">
            {[
              typeof day.sleep_hours === "number" ? `${day.sleep_hours} h` : null,
              typeof day.hydration === "number" ? `${day.hydration} glasses` : null,
              day.cage ? "cage" : null,
              day.denial ? "denial" : null,
              day.edges ? `${day.edges} edges` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </span>
        </div>
      ))}

      <button
        type="button"
        onClick={onLogDay}
        className="mt-2 h-11 w-full rounded-xl border border-border text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Log a day
      </button>
    </div>
  );
}

function Row({ label, value, last = false }) {
  return (
    <div className={`flex items-baseline justify-between py-2 ${last ? "" : "border-b border-border"}`}>
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="tnum text-[13px]">{value}</span>
    </div>
  );
}

function dayLabel(date) {
  const parsed = Date.parse(`${date}T12:00:00`);
  if (!Number.isFinite(parsed)) return date ?? "";
  return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}