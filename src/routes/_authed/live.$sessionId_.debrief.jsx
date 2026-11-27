import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_LABEL, PLAN_LABEL, TOY_LABEL, minutesBetween, shortDate } from "@/lib/session-utils";

const HEAD_OPTIONS = ["fine", "puffy", "tight_numb", "raw"];

export const Route = createFileRoute("/_authed/live/$sessionId_/debrief")({
  ssr: false,
  head: () => ({ meta: [{ title: "Debrief · Herder" }] }),
  component: DebriefPage,
});

function Stat({ label, value }) {
  return (
    <div className="border-b border-border py-2 last:border-b-0">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <span className="tnum text-[13px]">{value}</span>
      </div>
    </div>
  );
}

function DebriefPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [best, setBest] = useState("");
  const [turned, setTurned] = useState("");
  const [change, setChange] = useState("");
  const [repeat, setRepeat] = useState(0);
  const [head, setHead] = useState("unknown");
  const [state, setState] = useState("idle");

  useEffect(() => {
    Promise.all([
      base44.entities.Session.get(sessionId),
      base44.entities.CheckIn.filter({ session: sessionId }, { sort: "created_date", limit: 200 }),
    ]).then(([loadedSession, checkInPage]) => {
      setSession(loadedSession);
      setCheckIns(checkInPage.items ?? []);
      setBest(loadedSession.best_moment ?? "");
      setTurned(loadedSession.where_turned ?? "");
      setChange(loadedSession.would_change ?? "");
      setRepeat(loadedSession.would_repeat ?? 0);
      setHead(loadedSession.head_next_day ?? "unknown");
    });
  }, [sessionId]);

  // The cross-session reading is written after the save lands; pick it up without a reload.
  useEffect(() => {
    if (state !== "saved" || session?.analysis) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > 15) {
        clearInterval(timer);
        return;
      }
      base44.entities.Session.get(sessionId).then(setSession);
    }, 10000);
    return () => clearInterval(timer);
  }, [state, session?.analysis, sessionId]);

  if (!session) {
    return <div className="h-40 animate-pulse rounded-xl border border-border" aria-hidden="true" />;
  }

  if (session.status !== "ended") {
    return (
      <div className="animate-fade-up">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <Link to="/live/$sessionId" params={{ sessionId }} className="hover:text-foreground">Session</Link>
          <Link to="/live/$sessionId/log" params={{ sessionId }} className="hover:text-foreground">Log</Link>
        </div>
        <div className="mt-8 rounded-xl border border-border p-6 text-center">
          <Lock className="mx-auto h-5 w-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 text-[14px] font-medium">Debrief is locked</p>
          <p className="mt-1 text-[12px] text-muted-foreground">It opens once the session has ended.</p>
          <Button asChild className="mt-5 h-12 w-full rounded-xl text-[13px]">
            <Link to="/live/$sessionId" params={{ sessionId }}>
              Back to session
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const elapsed = minutesBetween(session.start_time, session.ended_at);
  const counts = checkIns.reduce((totals, checkIn) => {
    totals.checks += 1;
    if (checkIn.forced) totals.forced += 1;
    else if (checkIn.ruined) totals.slipped += 1;
    return totals;
  }, { checks: 0, forced: 0, slipped: 0 });

  // Each toy with the first and last minute it was still on, in the order it appeared.
  const kitRows = (() => {
    const byToy = new Map();
    for (const checkIn of checkIns) {
      const at = checkIn.elapsed_min ?? 0;
      for (const toy of checkIn.toys_active ?? []) {
        const row = byToy.get(toy) ?? { toy, first: at, last: at };
        row.first = Math.min(row.first, at);
        row.last = Math.max(row.last, at);
        byToy.set(toy, row);
      }
    }
    return [...byToy.values()].sort((a, b) => a.first - b.first);
  })();
  const stretcherOff = session.stretcher_remove_at_min;

  async function save() {
    setState("saving");
    try {
      await base44.entities.Session.update(sessionId, {
        best_moment: best || undefined,
        where_turned: turned || undefined,
        would_change: change || undefined,
        would_repeat: repeat || undefined,
        head_next_day: head,
      });
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="animate-fade-up pb-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Link to="/live/$sessionId" params={{ sessionId }} className="hover:text-foreground">Session</Link>
        <Link to="/live/$sessionId/log" params={{ sessionId }} className="hover:text-foreground">Log</Link>
      </div>

      <h1 className="mt-2 font-heading text-[24px] font-medium tracking-[-0.02em]">Debrief</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {PLAN_LABEL[session.plan_type]} · {shortDate(session.start_time)}
      </p>

      <div className="mt-6 rounded-xl border border-border px-4 py-2">
        <Stat label="Elapsed" value={elapsed != null ? `${elapsed} min` : "—"} />
        <Stat
          label={session.mode === "quiet" ? "Edges" : "Rounds"}
          value={
            session.mode === "quiet"
              ? `${session.edges_total ?? 0} edges`
              : `${session.rounds_total ?? 0}`
          }
        />
        <Stat label="Breaks" value={session.breaks_total ?? 0} />
        <Stat label="Dry rounds" value={session.dry_rounds ?? 0} />
        <Stat label="Forced ruins" value={counts.forced} />
        <Stat label="Slipped ruins" value={counts.slipped} />
        <Stat label="Peak" value={`${session.peak_elapsed_min ?? 0} min`} />
        <Stat label="Projected end" value={session.projected_end_min != null ? `${session.projected_end_min} min` : "—"} />
        <Stat label="Check-ins" value={counts.checks} />
        {session.stats && (
          <>
            <Stat
              label="First break"
              value={session.stats.first_break_min != null ? `${session.stats.first_break_min} min` : "none"}
            />
            <Stat label="Highest severity" value={session.stats.max_severity ?? 0} />
            <Stat
              label="Average round gap"
              value={session.stats.avg_round_gap_min != null ? `${session.stats.avg_round_gap_min} min` : "—"}
            />
          </>
        )}
      </div>

      {kitRows.length > 0 && (
        <div className="mt-6 rounded-xl border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Kit</p>
          <div className="mt-3 space-y-2">
            {kitRows.map((row) => {
              const late = row.toy === "stretcher" && typeof stretcherOff === "number" && row.last >= stretcherOff;
              return (
                <div key={row.toy} className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px]">{TOY_LABEL[row.toy] ?? row.toy}</p>
                    {late && (
                      <p className="mt-0.5 text-[11px] text-call-stop">
                        left on past the swap, due off at {stretcherOff} min
                      </p>
                    )}
                  </div>
                  <span className="tnum shrink-0 text-[12px] text-muted-foreground">
                    {row.first === row.last ? `from ${row.first} min` : `${row.first} to ${row.last} min`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-7 space-y-5">
        <div>
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Best moment</Label>
          <Textarea value={best} onChange={(event) => setBest(event.target.value)} rows={2} className="mt-2 rounded-xl" />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Where it turned</Label>
          <Textarea value={turned} onChange={(event) => setTurned(event.target.value)} rows={2} className="mt-2 rounded-xl" />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">What you would change</Label>
          <Textarea value={change} onChange={(event) => setChange(event.target.value)} rows={2} className="mt-2 rounded-xl" />
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Would repeat</Label>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRepeat(value)}
                className={`tnum h-11 flex-1 rounded-xl border text-[13px] transition-colors ${
                  repeat === value
                    ? "border-primary bg-primary/10 font-medium text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Head next day</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {HEAD_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setHead(value)}
                className={`h-11 rounded-xl border text-[12px] transition-colors ${
                  head === value
                    ? "border-primary bg-primary/10 font-medium text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {CONDITION_LABEL[value]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {session.analysis && (
        <div className="mt-7 rounded-xl border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">What the record shows</p>
          <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed">{session.analysis}</p>
        </div>
      )}

      {state === "error" && <p className="mt-4 text-[11px] text-call-stop">Could not save the debrief.</p>}

      <Button type="button" onClick={save} disabled={state === "saving"} className="mt-6 h-14 w-full rounded-xl text-[14px]">
        {state === "saving" ? "Saving..." : state === "saved" ? "Saved" : "Save debrief"}
      </Button>

      <Link to="/history" className="mt-3 block text-center text-[12px] text-muted-foreground hover:text-foreground">
        All sessions
      </Link>
    </div>
  );
}