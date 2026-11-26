import { CONDITION_LABEL, CYCLE_LABEL, PLAN_LABEL, RECEIVER_LABEL, SUCTION_LABEL, TOY_LABEL, minutesBetween, shortDate } from "@/lib/session-utils";

// One session inside a block: what was on, and every round in order.
export default function BlockSession({ session, checkIns = [] }) {
  const rounds = [...checkIns].sort((a, b) => (a.elapsed_min ?? 0) - (b.elapsed_min ?? 0));
  const actual = session.ended_at ? minutesBetween(session.start_time, session.ended_at) : null;
  const toys = session.toys ?? [];

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium">{PLAN_LABEL[session.plan_type] ?? session.plan_type}</p>
        <p className="tnum shrink-0 text-[11px] text-muted-foreground">
          {shortDate(session.start_time)}
          {actual != null ? ` · ${actual} min` : ""}
        </p>
      </div>

      {toys.length > 0 && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {toys.map((toy) => TOY_LABEL[toy] ?? toy).join(", ")}
          {typeof session.stretcher_remove_at_min === "number"
            ? ` · stretcher off at ${session.stretcher_remove_at_min} min`
            : ""}
        </p>
      )}

      {(session.receivers ?? []).length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          On: {(session.receivers ?? []).map((receiver) => RECEIVER_LABEL[receiver] ?? receiver).join(", ")}
        </p>
      )}

      {rounds.length > 0 && (
        <div className="mt-3">
          {rounds.map((checkIn, index) => (
            <RoundRow key={checkIn.id} checkIn={checkIn} previous={rounds[index - 1] ?? null} />
          ))}
        </div>
      )}

      {(session.best_moment || session.where_turned || session.would_change || session.would_repeat) && (
        <div className="mt-3 border-t border-border pt-2">
          {session.best_moment && <DebriefLine label="Best" value={session.best_moment} />}
          {session.where_turned && <DebriefLine label="Turned" value={session.where_turned} />}
          {session.would_change && <DebriefLine label="Change" value={session.would_change} />}
          {session.would_repeat ? <DebriefLine label="Repeat" value={`${session.would_repeat} / 5`} /> : null}
        </div>
      )}

      {session.head_next_day && session.head_next_day !== "unknown" && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Next day: {CONDITION_LABEL[session.head_next_day] ?? session.head_next_day}
        </p>
      )}
    </div>
  );
}

function DebriefLine({ label, value }) {
  return (
    <p className="mt-1 text-[11px] leading-relaxed">
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

function outcomeOf(checkIn) {
  if (checkIn.forced) return { text: "Forced ruin", tone: "text-call-stop" };
  if (checkIn.ruined) return { text: "Slipped ruin", tone: "text-call-caution" };
  if (checkIn.is_dry) return { text: "Blank", tone: "text-muted-foreground" };
  return null;
}

function RoundRow({ checkIn, previous }) {
  const outcome = outcomeOf(checkIn);
  const ride = typeof checkIn.elapsed_min === "number"
    ? checkIn.elapsed_min - (previous?.elapsed_min ?? 0)
    : null;
  const note = checkIn.override_note || checkIn.felt_text;

  return (
    <div className="border-b border-border py-2 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="tnum text-[12px]">
          R{checkIn.round ?? "-"} · {checkIn.elapsed_min ?? 0} min
        </span>
        <span className={`text-[11px] ${outcome?.tone ?? "text-muted-foreground"}`}>{outcome?.text ?? "—"}</span>
      </div>
      <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
        grade {checkIn.effective_severity ?? "—"}
        {" · "}close {checkIn.closeness ?? "—"}
        {" · "}{SUCTION_LABEL[checkIn.suction] ?? "—"}
        {" / "}{CYCLE_LABEL[checkIn.cycle] ?? "—"}
        {ride != null ? ` · ride ${ride} min` : ""}
        {checkIn.overridden ? " · overridden" : ""}
      </p>
      {note && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}