import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import DenialCaptureSheet from "@/components/session/DenialCaptureSheet";
import Stepper from "@/components/session/Stepper";
import useSessionClock from "@/hooks/use-session-clock";
import { evaluateEdge } from "@/lib/edge";
import { CALL_LABEL, clock } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/live/$sessionId_/denial")({
  ssr: false,
  head: () => ({ meta: [{ title: "Denial · Herder" }] }),
  component: DenialPage,
});

const WAND_LEVELS = [1, 2, 3, 4, 5];

function DenialPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const runEdge = useServerFn(evaluateEdge);
  const [session, setSession] = useState(null);
  const [protocol, setProtocol] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [wand, setWand] = useState(2);
  const [hold, setHold] = useState(0);
  const [verdict, setVerdict] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      base44.entities.Session.get(sessionId),
      base44.entities.Protocol.filter({ active: true }, { limit: 1 }),
      base44.entities.CheckIn.filter({ session: sessionId }, { sort: "-created_date", limit: 200 }),
    ])
      .then(([loadedSession, protocolPage, checkInPage]) => {
        if (cancelled) return;
        const items = checkInPage.items ?? [];
        setSession(loadedSession);
        setProtocol((protocolPage.items ?? [])[0] ?? null);
        setCheckIns(items);
        setWand(items[0]?.wand_intensity ?? 2);
      })
      .catch((err) => setError(err?.message || "Could not load that session."));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const endedAt = session?.status === "ended" ? session.ended_at : null;
  const { seconds } = useSessionClock(session?.start_time, endedAt);
  const elapsedMin = Math.floor(seconds / 60);

  // The ten count after every edge. The button stays locked until it runs out.
  useEffect(() => {
    if (hold <= 0) return undefined;
    const timer = setInterval(() => setHold((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [hold > 0]);

  async function endSession() {
    if (ending) return;
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

  // A stop lands once the hold has run out.
  useEffect(() => {
    if (hold > 0 || !verdict) return;
    if (verdict.call === "stop" || verdict.call === "hold_then_stop") endSession();
  }, [hold, verdict]);

  async function handleEdge(checkInId) {
    setSheetOpen(false);
    setError("");
    try {
      const result = await runEdge({ data: { checkInId } });
      setVerdict(result);
      setWand(result.target_wand);
      setHold(result.seconds_to_hold);
      const page = await base44.entities.CheckIn.filter({ session: sessionId }, { sort: "-created_date", limit: 200 });
      setCheckIns(page.items ?? []);
    } catch (err) {
      setError(err?.message || "Could not read that edge.");
    }
  }

  if (!session) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-24 rounded-sm bg-secondary" />
        <div className="h-10 w-40 rounded-sm bg-secondary" />
        <div className="mt-6 h-32 rounded-xl border border-border" />
      </div>
    );
  }

  const ended = session.status === "ended";
  const lastCheckIn = checkIns[0] ?? null;
  const edges = lastCheckIn?.edge_index ?? 0;
  const ruinedCount = checkIns.filter((item) => item.ruined).length;
  const target = Math.max(1, (protocol?.denial_target ?? 7) - ruinedCount);
  const capMin = protocol?.denial_cap_min ?? 30;
  const atCap = elapsedMin >= capMin;
  const locked = hold > 0;

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
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Denial · cap {capMin} min</p>
        <p className="tnum mt-2 text-[40px] font-medium leading-none tracking-[-0.02em]">{clock(seconds)}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{ended ? "Ended" : "Elapsed"}</p>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Edges</p>
        <p className="tnum text-[15px] font-medium">
          {edges} of {target}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-border px-4 py-3">
        <Stepper
          label="Wand intensity"
          display={String(wand)}
          onDecrease={() => setWand((value) => Math.max(1, value - 1))}
          onIncrease={() => setWand((value) => Math.min(5, value + 1))}
          disabled={ended || locked}
        />
      </div>

      {locked && (
        <div className="mt-3 rounded-xl border border-border p-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Hold</p>
          <p className="tnum mt-1 text-[34px] font-medium leading-none">{hold}</p>
        </div>
      )}

      {lastCheckIn?.call_reason && !locked && (
        <div className="mt-3 rounded-xl border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {CALL_LABEL[lastCheckIn.call_issued] ?? "Edge"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed">{lastCheckIn.call_reason}</p>
        </div>
      )}

      {atCap && !ended && (
        <p className="mt-3 text-[11px] text-call-caution">Cap reached. The session stops here.</p>
      )}

      {error && <p className="mt-3 text-[11px] text-call-stop">{error}</p>}

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
          onClick={() => (atCap ? endSession() : setSheetOpen(true))}
          disabled={locked || ending}
          className="mt-6 h-14 w-full rounded-xl text-[14px]"
        >
          {locked ? `Hold ${hold}` : atCap ? (ending ? "Stopping..." : "Stop at cap") : "Log edge"}
        </Button>
      )}

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

      {session.briefing && (
        <div className="mt-3 rounded-xl border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Briefing</p>
          <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed">{session.briefing}</p>
        </div>
      )}

      <DenialCaptureSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        session={session}
        wand={wand}
        edgeIndex={edges}
        onSubmitted={handleEdge}
      />
    </div>
  );
}