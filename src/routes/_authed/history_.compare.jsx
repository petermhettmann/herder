import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CALL_LABEL, PLAN_LABEL, STATUS_LABEL, minutesBetween, shortDate } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/history_/compare")({
  ssr: false,
  validateSearch: (search) => ({ a: search.a || undefined, b: search.b || undefined }),
  head: () => ({ meta: [{ title: "Compare · Herder" }] }),
  component: ComparePage,
});

function Row({ label, left, right }) {
  return (
    <div className="border-b border-border py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <span className="tnum text-[13px]">{left}</span>
        <span className="tnum text-[13px]">{right}</span>
      </div>
    </div>
  );
}

function countCalls(checkIns, call) {
  return checkIns.filter((checkIn) => checkIn.call_issued === call).length;
}

function ComparePage() {
  const { a, b } = Route.useSearch();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!a || !b) return;
    Promise.all([
      base44.entities.Session.get(a),
      base44.entities.Session.get(b),
      base44.entities.CheckIn.filter({ session: a }, { sort: "created_date", limit: 200 }),
      base44.entities.CheckIn.filter({ session: b }, { sort: "created_date", limit: 200 }),
    ]).then(([left, right, leftChecks, rightChecks]) =>
      setData({
        left,
        right,
        leftChecks: leftChecks.items ?? [],
        rightChecks: rightChecks.items ?? [],
      })
    );
  }, [a, b]);

  if (!a || !b) {
    return (
      <div className="animate-fade-up">
        <Link to="/history" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
          History
        </Link>
        <p className="mt-6 text-[13px] text-muted-foreground">Pick two sessions to compare.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="h-40 animate-pulse rounded-xl border border-border" aria-hidden="true" />;
  }

  const { left, right, leftChecks, rightChecks } = data;
  const leftDuration = left.ended_at ? minutesBetween(left.start_time, left.ended_at) : null;
  const rightDuration = right.ended_at ? minutesBetween(right.start_time, right.ended_at) : null;

  return (
    <div className="animate-fade-up pb-4">
      <Link to="/history" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
        History
      </Link>

      <h1 className="mt-2 font-heading text-[24px] font-medium tracking-[-0.02em]">Compare</h1>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {[left, right].map((session) => (
          <div key={session.id} className="rounded-xl border border-border p-3">
            <p className="text-[12px] font-medium">{shortDate(session.start_time)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{PLAN_LABEL[session.plan_type]}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-border">
        <Row
          label="Status"
          left={STATUS_LABEL[left.status]}
          right={STATUS_LABEL[right.status]}
        />
        <Row
          label="Duration"
          left={leftDuration != null ? `${leftDuration} min` : "—"}
          right={rightDuration != null ? `${rightDuration} min` : "—"}
        />
        <Row label="Rounds" left={left.rounds_total ?? 0} right={right.rounds_total ?? 0} />
        <Row label="Breaks" left={left.breaks_total ?? 0} right={right.breaks_total ?? 0} />
        <Row label="Dry rounds" left={left.dry_rounds ?? 0} right={right.dry_rounds ?? 0} />
        <Row label="Peak" left={`${left.peak_elapsed_min ?? 0} min`} right={`${right.peak_elapsed_min ?? 0} min`} />
        <Row
          label="Projected end"
          left={left.projected_end_min != null ? `${left.projected_end_min} min` : "—"}
          right={right.projected_end_min != null ? `${right.projected_end_min} min` : "—"}
        />
        <Row label="Check-ins" left={leftChecks.length} right={rightChecks.length} />
        {["continue", "hold", "drop", "break", "end"].map((call) => (
          <Row
            key={call}
            label={CALL_LABEL[call]}
            left={countCalls(leftChecks, call)}
            right={countCalls(rightChecks, call)}
          />
        ))}
        <Row
          label="Would repeat"
          left={left.would_repeat ?? "—"}
          right={right.would_repeat ?? "—"}
        />
      </div>
    </div>
  );
}