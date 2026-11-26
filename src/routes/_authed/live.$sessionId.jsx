import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import BreakOverlay from "@/components/session/BreakOverlay";
import CaptureSheet from "@/components/session/CaptureSheet";
import useCheckInSync from "@/hooks/use-checkin-sync";
import useSessionClock from "@/hooks/use-session-clock";
import { clearActiveSession, loadActiveSession, saveActiveSession } from "@/lib/active-session";
import {
  CONSTRICTION_LABEL,
  CYCLE_LABEL,
  PLAN_LABEL,
  SUCTION_LABEL,
  clock,
  phaseInfo,
} from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/live/$sessionId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Session · Herder" }] }),
  component: LivePage,
});

function Readout({ label, value, target }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[15px] font-medium">{value}</p>
      {target && target !== value && (
        <p className="text-[11px] text-muted-foreground">plan {target}</p>
      )}
    </div>
  );
}

function LivePage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [prompt, setPrompt] = useState(null);
  const [restored, setRestored] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      base44.entities.Session.get(sessionId),
      base44.entities.Protocol.filter({ active: true }, { limit: 1 }),
      base44.entities.CheckIn.filter({ session: sessionId }, { sort: "-created_date", limit: 100 }),
      base44.entities.Prompt.filter({ session: sessionId, status: "pending" }, { sort: "-created_date", limit: 1 }),
    ])
      .then(([loadedSession, protocolPage, checkInPage, promptPage]) => {
        if (cancelled) return;
        setSession(loadedSession);
        setProtocol((protocolPage.items ?? [])[0] ?? null);
        setCheckIns(checkInPage.items ?? []);
        setPrompt((promptPage.items ?? [])[0] ?? null);
      })
      .catch((err) => setError(err?.message || "Could not load that session."));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // A denial session runs on its own screen.
  useEffect(() => {
    if (session?.plan_type === "denial") {
      navigate({ to: "/live/$sessionId/denial", params: { sessionId }, replace: true });
    }
  }, [session?.plan_type, sessionId]);

  // The running session is remembered on the device, so a reload restores the timer
  // before the record is fetched.
  useEffect(() => {
    const saved = loadActiveSession();
    if (saved?.id === sessionId) setRestored(saved);
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    if (session.status === "ended") clearActiveSession();
    else saveActiveSession(session);
  }, [session]);

  const startTime = session?.start_time ?? restored?.start_time ?? null;
  const endedAt = session?.status === "ended" ? session.ended_at : null;
  const { now, seconds } = useSessionClock(startTime, endedAt);

  // A call decided on the device confirms itself when the connection is back.
  useCheckInSync(sessionId);

  // The workflows raise prompts while the screen is open; show the newest one as it lands.
  useEffect(() => {
    const unsubscribe = base44.entities.Prompt.subscribe((event) => {
      if (event?.data?.session !== sessionId) return;
      base44.entities.Prompt.filter({ session: sessionId, status: "pending" }, { sort: "-created_date", limit: 1 })
        .then((page) => setPrompt((page.items ?? [])[0] ?? null));
    });
    return unsubscribe;
  }, [sessionId]);

  if (!session) {
    if (!restored) {
      return (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-3 w-24 rounded-sm bg-secondary" />
          <div className="h-10 w-40 rounded-sm bg-secondary" />
          <div className="mt-6 h-32 rounded-xl border border-border" />
        </div>
      );
    }
    return (
      <div className="animate-fade-up pb-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Restoring session</p>
        <p className="tnum mt-2 text-[40px] font-medium leading-none tracking-[-0.02em]">{clock(seconds)}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">Elapsed</p>
      </div>
    );
  }

  const ended = session.status === "ended";
  const elapsedMin = Math.floor(seconds / 60);
  const plan = protocol?.plan_tables?.[session.plan_type] ?? null;
  const phase = phaseInfo(plan, elapsedMin);
  const lastCheckIn = checkIns[0] ?? null;
  const suction = lastCheckIn?.suction ?? session.start_suction ?? "very_low";
  const cycle = lastCheckIn?.cycle ?? phase?.cycle ?? "normal";

  const thresholds = protocol?.thresholds ?? {};
  const forcedSec = thresholds.post_round_forced_checkin_sec ?? 90;
  const staleMin = thresholds.stale_checkin_min ?? 10;
  let dueIn = null;
  if (!ended) {
    const anchor = lastCheckIn
      ? Date.parse(lastCheckIn.created_date) + forcedSec * 1000
      : Date.parse(session.start_time) + staleMin * 60000;
    dueIn = Math.round((anchor - now) / 1000);
  }

  const breakEnd = session.break_ends?.[session.break_ends.length - 1];

  async function endSession() {
    setEnding(true);
    setError("");
    try {
      await base44.entities.Session.update(sessionId, {
        status: "ended",
        ended_at: new Date().toISOString(),
      });
      navigate({ to: "/live/$sessionId/debrief", params: { sessionId } });
    } catch (err) {
      setError(err?.message || "Could not end the session.");
      setEnding(false);
    }
  }

  async function resume() {
    setResuming(true);
    try {
      await base44.entities.Session.update(sessionId, { status: "active" });
      setSession((previous) => ({ ...previous, status: "active" }));
    } catch (err) {
      setError(err?.message || "Could not resume the session.");
    } finally {
      setResuming(false);
    }
  }

  return (
    <div className="animate-fade-up pb-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Link to="/history" className="hover:text-foreground">
          Sessions
        </Link>
        <div className="flex gap-4">
          <Link to="/live/$sessionId/log" params={{ sessionId }} className="hover:text-foreground">
            Log
          </Link>
          <Link to="/live/$sessionId/debrief" params={{ sessionId }} className="hover:text-foreground">
            Debrief
          </Link>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {PLAN_LABEL[session.plan_type]} · {CONSTRICTION_LABEL[session.constriction] ?? "Traditional"}
        </p>
        <p className="tnum mt-2 text-[40px] font-medium leading-none tracking-[-0.02em]">{clock(seconds)}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{ended ? "Ended" : "Elapsed"}</p>
      </div>

      <div className="mt-6 rounded-xl border border-border p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-medium">{phase?.label ?? "Session"}</p>
          <p className="tnum text-[12px] text-muted-foreground">
            {phase?.remaining != null ? `${Math.max(0, Math.ceil(phase.remaining))} min left` : "Open ended"}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Readout
            label="Suction"
            value={SUCTION_LABEL[suction] ?? suction}
            target={phase ? SUCTION_LABEL[phase.suction] : null}
          />
          <Readout
            label="Cycle"
            value={CYCLE_LABEL[cycle] ?? cycle}
            target={phase ? CYCLE_LABEL[phase.cycle] : null}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Next check-in</p>
        <p className={`tnum text-[12px] ${dueIn !== null && dueIn <= 0 ? "text-call-caution" : "text-muted-foreground"}`}>
          {dueIn === null ? "Session ended" : dueIn > 0 ? `in ${clock(dueIn)}` : "due now"}
        </p>
      </div>

      {prompt && !ended && (
        <div className="mt-3 rounded-xl border border-call-caution/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-call-caution">Mistress</p>
          <p className="mt-1 text-[13px] leading-relaxed">{prompt.text}</p>
        </div>
      )}

      {ended ? (
        <Button
          type="button"
          onClick={() => navigate({ to: "/live/$sessionId/debrief", params: { sessionId } })}
          className="mt-6 h-14 w-full rounded-xl text-[14px]"
        >
          Open debrief
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-6 h-14 w-full rounded-xl text-[14px]"
        >
          Check in
        </Button>
      )}

      {session.briefing && (
        <div className="mt-3 rounded-xl border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Briefing</p>
          <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed">{session.briefing}</p>
        </div>
      )}

      {error && <p className="mt-3 text-[11px] text-call-stop">{error}</p>}

      {!ended && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="mt-3 h-11 w-full rounded-xl text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              End session
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-xl border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>End this session?</AlertDialogTitle>
              <AlertDialogDescription>
                The timer stops and the debrief unlocks. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep going</AlertDialogCancel>
              <AlertDialogAction onClick={endSession} disabled={ending}>
                {ending ? "Ending..." : "End session"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <CaptureSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        session={session}
        protocol={protocol}
        checkIns={checkIns}
        lastCheckIn={lastCheckIn}
        onSubmitted={(checkInId) => {
          setSheetOpen(false);
          setPrompt(null);
          base44.entities.Prompt.updateMany(
            { session: sessionId, status: "pending" },
            { $set: { status: "done" } },
          );
          navigate({
            to: "/live/$sessionId/verdict/$checkInId",
            params: { sessionId, checkInId },
          });
        }}
      />

      {session.status === "break" && breakEnd && (
        <BreakOverlay
          breakEnd={breakEnd}
          pingMinutes={thresholds.break_overrun_ping ?? 3}
          onResume={resume}
          busy={resuming}
        />
      )}
    </div>
  );
}