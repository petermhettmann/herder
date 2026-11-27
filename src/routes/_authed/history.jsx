import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLAN_LABEL, STATUS_LABEL, minutesBetween, shortDate } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/history")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sessions · Herder" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    base44.entities.Session.list("-start_time", 100).then((items) => setSessions(items ?? []));
  }, []);

  function toggle(id) {
    setSelected((previous) => {
      if (previous.includes(id)) return previous.filter((value) => value !== id);
      if (previous.length >= 2) return [previous[1], id];
      return [...previous, id];
    });
  }

  if (!sessions) {
    return <div className="h-40 animate-pulse rounded-xl border border-border" aria-hidden="true" />;
  }

  return (
    <div className="animate-fade-up pb-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sessions</p>
        <div className="flex items-center gap-4">
          <Link
            to="/import"
            className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:underline"
          >
            Import
          </Link>
          <Link to="/setup" className="text-[11px] uppercase tracking-[0.14em] text-primary hover:underline">
            New
          </Link>
        </div>
      </div>

      <h1 className="mt-2 font-heading text-[24px] font-medium tracking-[-0.02em]">History</h1>

      {sessions.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border p-6 text-center">
          <p className="text-[13px] text-muted-foreground">No sessions yet.</p>
          <Button asChild className="mt-4 h-12 w-full rounded-xl text-[13px]">
            <Link to="/setup">Set one up</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 border-t border-border">
            {sessions.map((session) => {
              const duration = session.ended_at ? minutesBetween(session.start_time, session.ended_at) : null;
              const isSelected = selected.includes(session.id);
              return (
                <div key={session.id} className="flex items-center gap-3 border-b border-border py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{shortDate(session.start_time)}</p>
                    <p className="tnum mt-1 text-[11px] text-muted-foreground">
                      {PLAN_LABEL[session.plan_type]} · {STATUS_LABEL[session.status]} ·{" "}
                      {session.rounds_total ?? 0} rounds
                      {duration != null ? ` · ${duration} min` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggle(session.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "h-8 rounded-md border px-2 text-[11px] transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Compare
                  </button>

                  <Link
                    to={session.status === "ended" ? "/live/$sessionId/debrief" : "/live/$sessionId"}
                    params={{ sessionId: session.id }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Open
                  </Link>

                  <Link
                    to="/live/$sessionId/log"
                    params={{ sessionId: session.id }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Log
                  </Link>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            disabled={selected.length !== 2}
            onClick={() => navigate({ to: "/history/compare", search: { a: selected[0], b: selected[1] } })}
            className="mt-6 h-12 w-full rounded-xl text-[13px]"
          >
            {selected.length === 2 ? "Compare these two" : "Pick two to compare"}
          </Button>
        </>
      )}
    </div>
  );
}