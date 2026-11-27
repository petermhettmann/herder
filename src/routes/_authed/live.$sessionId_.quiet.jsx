import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import DeadStopOverlay from "@/components/session/DeadStopOverlay";
import QuietCaptureSheet from "@/components/session/QuietCaptureSheet";
import useCheckInSync from "@/hooks/use-checkin-sync";
import useSessionClock from "@/hooks/use-session-clock";
import { clearActiveSession, loadActiveSession, saveActiveSession } from "@/lib/active-session";
import { evaluateQuietCheckIn } from "@/lib/quiet-checkins";
import { dropIntensity } from "@/lib/quiet-verdict";
import { CYCLE_LABEL, PLAN_LABEL, clock } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/live/$sessionId_/quiet")({
  ssr: false,
  head: () => ({ meta: [{ title: "Quiet session · Herder" }] }),
  component: QuietLivePage,
});

function Readout({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="tnum mt-1 text-[15px] font-medium">{value}</p>
    </div>
  );
}

function QuietLivePage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const runEvaluate = useServerFn(evaluateQuietCheckIn);
  const [session, setSession] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [restored, setRestored] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [freshSession, protocolPage, checkInPage] = await Promise.all([
      base44.entities.Session.get(sessionId),
      base44.entities.Protocol.filter({ active: true }, { limit: 1 }),
      base44.entities.CheckIn.filter({ session: sessionId }, { sort: "-created_date", limit: 100 }),
    ]);
    setSession(freshSession);
    setProtocol((protocolPage.items ?? [])[0] ?? null);
    setCheckIns(checkInPage.items ?? []);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    refresh().catch((err) => {
      if (!cancelled) setError(err?.message || "Could not load that session.");
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // A machine session runs on its own screen.
  useEffect(() => {
    if (session?.mode && session.mode !== "quiet") {
      navigate({ to: "/live/$sessionId", params: { sessionId }, replace: true });
    }
  }, [session?.mode, sessionId]);

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

  useCheckInSync(sessionId, refresh, evaluateQuietCheckIn);

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
  const lastCheckIn = checkIns[0] ?? null;
  const edges = session.edges_total ?? 0;
  const target = Math.min(12, Math.max(1, session.target_edges ?? protocol?.quiet_plan?.edge_target ?? 7));
  const intensity = Number(lastCheckIn?.intensity ?? session.start_intensity ?? 1);
  const pace = lastCheckIn?.pace ?? "slow";
  const grade = lastCheckIn?.effective_severity ?? 0;
  const breakEnd = session.break_ends?.[session.break_ends.length - 1];

  const deadStop = checkIns.find((item) => item.call_issued === "dead_stop" || item.forced) ?? null;
  const deadStopEnd = deadStop ? Date.parse(deadStop.created_date) + 60000 : null;
  const locked = deadStopEnd !== null && now < deadStopEnd;

  async function endSession() {
    setEnding(true);
    setError("");
    try {
      await base44.entities.Session.update(sessionId, { status: "ended", ended_at: new Date().toISOString() });
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
      await refresh();
    } catch (err) {
      setError(err?.message || "Could not resume the session.");
    } finally {
      setResuming(false);
    }
  }

  // A drop by hand: logged as its own call, and the working intensity comes down.
  async function drop() {
    if (busy || ended) return;
    setBusy(true);
    setError("");
    try {
      await base44.entities.CheckIn.create({
        session: sessionId,
        elapsed_min: Math.floor(seconds / 60),
        edge_index: edges,
        intensity: dropIntensity(intensity),
        pace: "slow",
        held_sec: 0,
        stated_condition: lastCheckIn?.stated_condition ?? "fine",
        closeness: lastCheckIn?.closeness ?? 5,
        call_issued: "drop",
        call_reason: "Dropped by hand.",
      });
      await refresh();
    } catch (err) {
      setError(err?.message || "Could not log that drop.");
    } finally {
      setBusy(false);
    }
  }

  // Finished goes through the table, so a finished check-in ends the session.
  async function finish() {
    if (busy || ended) return;
    setBusy(true);
    setError("");
    try {
      const created = await base44.entities.CheckIn.create({
        session: sessionId,
        elapsed_min: Math.floor(seconds / 60),
        edge_index: edges,
        intensity,
        pace,
        held_sec: 0,
        stated_condition: lastCheckIn?.stated_condition ?? "fine",
        closeness: lastCheckIn?.closeness ?? 5,
        finished: true,
      });
      const result = await runEvaluate({ data: { checkInId: created.id } });
      if (result?.call === "end") {
        navigate({ to: "/live/$sessionId/debrief", params: { sessionId } });
        return;
      }
      await refresh();
    } catch (err) {
      setError(err?.message || "Could not log that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up pb-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Link to="/history" className="hover:text-foreground">
          Sessions
        </Link>
        <Link to="/live/$sessionId/debrief" params={{ sessionId }} className="hover:text-foreground">
          Debrief
        </Link>
      </div>

      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {PLAN_LABEL[session.plan_type]} · Quiet kit
        </p>
        <p className="tnum mt-2 text-[40px] font-medium leading-none tracking-[-0.02em]">{clock(seconds)}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{ended ? "Ended" : "Elapsed"}</p>
      </div>

      <div className="mt-6 rounded-xl border border-border p-4">
        <div className="grid grid-cols-2 gap-4">
          <Readout label="Edge" value={`${ended ? edges : Math.min(edges + 1, target)} of ${target}`} />
          <Readout label="Intensity" value={`${intensity}`} />
          <Readout label="Pace" value={CYCLE_LABEL[pace] ?? pace} />
          <Readout label="Grade" value={`${grade}`} />
        </div>
      </div>

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

      {!ended && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={drop}
            disabled={busy}
            className="h-12 rounded-xl border border-border text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Drop
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={busy}
            className="h-12 rounded-xl border border-border text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Finished
          </button>
        </div>
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

      <QuietCaptureSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        session={session}
        protocol={protocol}
        checkIns={checkIns}
        lastCheckIn={lastCheckIn}
        onSubmitted={async (verdict) => {
          setSheetOpen(false);
          if (verdict?.call === "end") {
            navigate({ to: "/live/$sessionId/debrief", params: { sessionId } });
            return;
          }
          await refresh();
        }}
      />

      {locked && <DeadStopOverlay endsAt={new Date(deadStopEnd).toISOString()} />}

      {!locked && session.status === "break" && breakEnd && (
        <BreakOverlay
          breakEnd={breakEnd}
          pingMinutes={protocol?.thresholds?.break_overrun_ping ?? 3}
          onResume={resume}
          busy={resuming}
        />
      )}
    </div>
  );
}