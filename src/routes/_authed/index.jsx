import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { PLAN_LABEL, STATUS_LABEL, minutesBetween, shortDate } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Herder" },
      { name: "description", content: "Herder, a single-user tracker for what needs herding." },
      { name: "theme-color", content: "#0e0e11" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, isLoadingAuth } = useAuth();
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    base44.entities.Session.list("-start_time", 20).then((items) => setSessions(items ?? []));
  }, []);

  if (isLoadingAuth || !sessions) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-20 rounded-sm bg-secondary" />
        <div className="h-7 w-64 rounded-sm bg-secondary" />
        <div className="mt-8 h-40 rounded-xl border border-border" />
      </div>
    );
  }

  const open = sessions.find((session) => session.status === "active" || session.status === "break");
  const lastEnded = sessions.find((session) => session.status === "ended");

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {user?.full_name ? user.full_name : "Herder"}
      </p>

      <h1 className="mt-2 font-heading text-[27px] font-medium leading-[1.15] tracking-[-0.02em]">
        {open ? "A session is open." : "Nothing running."}
      </h1>

      {open && (
        <Link
          to={
            open.mode === "quiet"
              ? "/live/$sessionId/quiet"
              : open.plan_type === "denial"
                ? "/live/$sessionId/denial"
                : "/live/$sessionId"
          }
          params={{ sessionId: open.id }}
          className="mt-6 block rounded-xl border border-border p-4 transition-colors hover:bg-secondary"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {STATUS_LABEL[open.status]}
          </p>
          <p className="mt-1 text-[14px] font-medium">
            {PLAN_LABEL[open.plan_type]} · started {shortDate(open.start_time)}
          </p>
          <p className="tnum mt-1 text-[11px] text-muted-foreground">
            {open.rounds_total ?? 0} rounds · {open.breaks_total ?? 0} breaks
          </p>
        </Link>
      )}

      <Button asChild className="mt-6 h-14 w-full rounded-xl text-[14px]">
        <Link to="/setup">Start a session</Link>
      </Button>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Link
          to="/blocks"
          className="block h-12 rounded-xl border border-border text-center text-[13px] leading-[3rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          Blocks
        </Link>
        <Link
          to="/history"
          className="block h-12 rounded-xl border border-border text-center text-[13px] leading-[3rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          History
        </Link>
        <Link
          to="/mistress"
          className="block h-12 rounded-xl border border-border text-center text-[13px] leading-[3rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          Mistress
        </Link>
      </div>

      {lastEnded && (
        <Link
          to="/live/$sessionId/debrief"
          params={{ sessionId: lastEnded.id }}
          className="mt-8 block border-t border-border pt-4"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Last session</p>
          <p className="mt-1 text-[13px]">
            {shortDate(lastEnded.start_time)} · {lastEnded.rounds_total ?? 0} rounds ·{" "}
            {lastEnded.ended_at ? `${minutesBetween(lastEnded.start_time, lastEnded.ended_at)} min` : "—"}
          </p>
          <p className="mt-1 text-[11px] text-primary">Open debrief</p>
        </Link>
      )}
    </div>
  );
}