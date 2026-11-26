import { PLAN_LABEL, minutesBetween, shortDate } from "@/lib/session-utils";

// Dry count for the block, then projected against actual end, session by session.
export default function BlockTotals({ sessions = [] }) {
  const dry = sessions.reduce((total, session) => total + (session.dry_rounds ?? 0), 0);

  return (
    <div className="mt-6 rounded-xl border border-border px-4 py-2">
      <div className="flex items-baseline justify-between py-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Sessions</span>
        <span className="tnum text-[13px]">{sessions.length}</span>
      </div>
      <div className="flex items-baseline justify-between border-t border-border py-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Dry rounds</span>
        <span className="tnum text-[13px]">{dry}</span>
      </div>

      {sessions.map((session) => {
        const actual = session.ended_at ? minutesBetween(session.start_time, session.ended_at) : null;
        return (
          <div
            key={session.id}
            className="flex items-baseline justify-between gap-3 border-t border-border py-2"
          >
            <span className="truncate text-[11px] text-muted-foreground">
              {PLAN_LABEL[session.plan_type] ?? session.plan_type} · {shortDate(session.start_time)}
            </span>
            <span className="tnum shrink-0 text-[12px]">
              {session.projected_end_min != null ? `${session.projected_end_min}` : "—"} / {actual != null ? actual : "—"} min
            </span>
          </div>
        );
      })}
    </div>
  );
}