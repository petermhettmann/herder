import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { base44 } from "@/api/base44Client";
import { evaluateCheckIn } from "@/lib/checkins";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import BurstCamera from "@/components/session/BurstCamera";
import Stepper from "@/components/session/Stepper";
import VoiceNote from "@/components/session/VoiceNote";
import useBurstCamera from "@/components/session/useBurstCamera";
import { computeCall } from "@/lib/verdict";
import {
  CALL_LABEL,
  CALL_TEXT,
  CONDITIONS,
  CONDITION_LABEL,
  CYCLE_LABEL,
  CYCLE_LEVELS,
  SUCTION_LABEL,
  SUCTION_LEVELS,
  elapsedSeconds,
  step,
} from "@/lib/session-utils";

export default function CaptureSheet({
  open,
  onOpenChange,
  session,
  protocol,
  checkIns = [],
  lastCheckIn,
  onSubmitted,
  now = Date.now(),
  onForcedRuin,
}) {
  const runEvaluate = useServerFn(evaluateCheckIn);
  const camera = useBurstCamera(open);
  const [condition, setCondition] = useState("");
  const [closeness, setCloseness] = useState(5);
  const [suction, setSuction] = useState("very_low");
  const [cycle, setCycle] = useState("normal");
  const [felt, setFelt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCondition("");
    setCloseness(5);
    setFelt("");
    setError("");
    setSuction(lastCheckIn?.suction ?? session?.start_suction ?? "very_low");
    setCycle(lastCheckIn?.cycle ?? "normal");
    camera.reset();
  }, [open, lastCheckIn?.id, session?.start_suction, camera.reset]);

  // The call for what is picked, decided here with the same table the server uses.
  const preview = session && condition
    ? computeCall({
        protocol,
        session,
        history: checkIns,
        draft: { stated_condition: condition, suction, cycle },
      })
    : null;

  async function submit() {
    if (!session || !condition || busy) return;
    setBusy(true);
    setError("");
    try {
      const local = computeCall({
        protocol,
        session,
        history: checkIns,
        draft: { stated_condition: condition, suction, cycle },
      });
      const photos = [];
      for (const slot of camera.slots) {
        if (!slot) continue;
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({
          file: new File([slot.blob], "burst.jpg", { type: "image/jpeg" }),
        });
        photos.push(file_uri);
      }

      const created = await base44.entities.CheckIn.create({
        session: session.id,
        elapsed_min: Math.floor(elapsedSeconds(session.start_time) / 60),
        round: (session.rounds_total ?? 0) + 1,
        suction,
        cycle,
        stated_condition: condition,
        closeness,
        photo_burst: photos,
        felt_text: felt || undefined,
        is_dry: false,
      });

      try {
        await runEvaluate({ data: { checkInId: created.id } });
      } catch {
        // The call still stands: keep the device verdict on the record and let the
        // sync hook confirm it once the connection is back.
        await base44.entities.CheckIn.update(created.id, {
          elapsed_min: local.elapsed,
          round: local.round,
          effective_severity: local.severity,
          call_issued: local.call,
          call_reason: local.reason,
          break_minutes: local.break_minutes,
          unsynced: true,
        }).catch(() => {});
      }
      onSubmitted(created.id);
    } catch (err) {
      setError(err?.message || "Could not save that check-in.");
      setBusy(false);
    }
  }

  // The ruin can be taken inside the ninety second window a round leaves open.
  const ruinAnchor = lastCheckIn ? Date.parse(lastCheckIn.created_date) : Date.parse(session?.start_time ?? "");
  const ruinOpen =
    Boolean(session) &&
    !session.forced_ruin_done &&
    Number.isFinite(ruinAnchor) &&
    now - ruinAnchor <= 90000;

  async function ruin() {
    if (!session || !ruinOpen || busy) return;
    setBusy(true);
    setError("");
    try {
      const elapsed = Math.floor(elapsedSeconds(session.start_time) / 60);
      const created = await base44.entities.CheckIn.create({
        session: session.id,
        elapsed_min: elapsed,
        round: (session.rounds_total ?? 0) + 1,
        ruined: true,
        forced: true,
        call_issued: "dead_stop",
        call_reason: "Forced ruin. Dead stop, one minute.",
        break_minutes: 1,
        suction: lastCheckIn?.suction ?? session.start_suction ?? "very_low",
        cycle: lastCheckIn?.cycle ?? "normal",
      });
      await base44.entities.Session.update(session.id, {
        status: "break",
        forced_ruin_done: true,
        rounds_total: (session.rounds_total ?? 0) + 1,
        breaks_total: (session.breaks_total ?? 0) + 1,
        peak_elapsed_min: Math.max(session.peak_elapsed_min ?? 0, elapsed),
        break_ends: [...(session.break_ends ?? []), new Date(Date.now() + 60000).toISOString()],
      });
      onForcedRuin?.(created.id);
    } catch (err) {
      setError(err?.message || "Could not log that ruin.");
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-xl border-border bg-card p-5">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="font-heading text-[18px] font-medium tracking-[-0.01em]">Check in</SheetTitle>
          <p className="text-[12px] text-muted-foreground">Three shots, then how it feels.</p>
        </SheetHeader>

        <div className="mt-4">
          <BurstCamera camera={camera} />
        </div>

        <div className="mt-6 space-y-2">
          {CONDITIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCondition(value)}
              className={cn(
                "h-12 w-full rounded-xl border text-[13px] transition-colors",
                condition === value
                  ? "border-primary bg-primary/10 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {CONDITION_LABEL[value]}
            </button>
          ))}
        </div>

        {preview && (
          <div className="mt-4 rounded-xl border border-border p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Call</p>
            <p className={`mt-1 text-[15px] font-medium ${CALL_TEXT[preview.call]}`}>
              {CALL_LABEL[preview.call]}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{preview.reason}</p>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Closeness</Label>
            <span className="tnum text-[13px] font-medium">{closeness}</span>
          </div>
          <Slider
            value={[closeness]}
            min={1}
            max={10}
            step={1}
            onValueChange={([value]) => setCloseness(value)}
            className="mt-3"
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stepper
            label="Suction"
            display={SUCTION_LABEL[suction]}
            onDecrease={() => setSuction(step(SUCTION_LEVELS, suction, -1))}
            onIncrease={() => setSuction(step(SUCTION_LEVELS, suction, 1))}
          />
          <Stepper
            label="Cycle"
            display={CYCLE_LABEL[cycle]}
            onDecrease={() => setCycle(step(CYCLE_LEVELS, cycle, -1))}
            onIncrease={() => setCycle(step(CYCLE_LEVELS, cycle, 1))}
          />
        </div>

        <div className="mt-6 space-y-2">
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">How it feels</Label>
          <Textarea
            value={felt}
            onChange={(event) => setFelt(event.target.value)}
            rows={3}
            placeholder="Type it, or record it."
            className="rounded-xl"
          />
          <VoiceNote onTranscript={(text) => setFelt((previous) => (previous ? `${previous} ${text}` : text))} />
        </div>

        {error && <p className="mt-4 text-[11px] text-call-stop">{error}</p>}

        <Button
          type="button"
          onClick={submit}
          disabled={busy || !condition}
          className="mt-5 h-14 w-full rounded-xl text-[14px]"
        >
          {busy ? "Saving..." : "Submit check-in"}
        </Button>

        <button
          type="button"
          onClick={ruin}
          disabled={!ruinOpen || busy}
          className="mt-3 h-12 w-full rounded-xl border border-border text-[12px] text-call-stop transition-colors disabled:text-muted-foreground/60"
        >
          Click — ruin
        </button>
        {!ruinOpen && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {session?.forced_ruin_done
              ? "The ruin is already taken."
              : "Open in the ninety seconds after a round."}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}