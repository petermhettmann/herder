import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { base44 } from "@/api/base44Client";
import { evaluateQuietCheckIn } from "@/lib/quiet-checkins";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import Stepper from "@/components/session/Stepper";
import { computeQuietCall } from "@/lib/quiet-verdict";
import {
  CALL_LABEL,
  CALL_TEXT,
  CONDITIONS,
  CONDITION_LABEL,
  CYCLE_LABEL,
  CYCLE_LEVELS,
  elapsedSeconds,
  step,
} from "@/lib/session-utils";

// Quiet kit check-in: intensity, pace and the seconds the edge was held, judged by the same
// table the server writes with.
export default function QuietCaptureSheet({
  open,
  onOpenChange,
  session,
  protocol,
  checkIns = [],
  lastCheckIn,
  onSubmitted,
}) {
  const runEvaluate = useServerFn(evaluateQuietCheckIn);
  const [intensity, setIntensity] = useState(1);
  const [pace, setPace] = useState("slow");
  const [heldSec, setHeldSec] = useState("");
  const [condition, setCondition] = useState("");
  const [closeness, setCloseness] = useState(5);
  const [felt, setFelt] = useState("");
  const [isDry, setIsDry] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setIntensity(Number(lastCheckIn?.intensity ?? session?.start_intensity ?? 1));
    setPace(lastCheckIn?.pace ?? "slow");
    setHeldSec("");
    setCondition("");
    setCloseness(5);
    setFelt("");
    setIsDry(false);
    setFinished(false);
    setError("");
  }, [open, lastCheckIn?.id, session?.id, session?.start_intensity]);

  const held = Number(heldSec) || 0;
  const draft = { intensity, pace, held_sec: held, stated_condition: condition, finished };
  const preview = session && condition
    ? computeQuietCall({ protocol, session, history: checkIns, draft })
    : null;

  async function submit() {
    if (!session || !condition || busy) return;
    setBusy(true);
    setError("");
    try {
      const local = computeQuietCall({ protocol, session, history: checkIns, draft });
      const created = await base44.entities.CheckIn.create({
        session: session.id,
        elapsed_min: Math.floor(elapsedSeconds(session.start_time) / 60),
        intensity,
        pace,
        held_sec: held,
        stated_condition: condition,
        closeness,
        is_dry: isDry,
        finished,
        felt_text: felt || undefined,
      });

      try {
        await runEvaluate({ data: { checkInId: created.id } });
      } catch {
        // The call still stands: keep the device verdict and let the sync hook confirm it.
        await base44.entities.CheckIn.update(created.id, {
          elapsed_min: local.elapsed,
          edge_index: local.edge,
          effective_severity: local.severity,
          call_issued: local.call,
          call_reason: local.reason,
          break_minutes: local.break_minutes,
          unsynced: true,
        }).catch(() => {});
      }
      onSubmitted(local);
    } catch (err) {
      setError(err?.message || "Could not save that check-in.");
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-xl border-border bg-card p-5">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="font-heading text-[18px] font-medium tracking-[-0.01em]">Check in</SheetTitle>
          <p className="text-[12px] text-muted-foreground">How hard, how fast, how long.</p>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stepper
            label="Intensity"
            display={`${intensity}`}
            onDecrease={() => setIntensity((value) => Math.max(1, value - 1))}
            onIncrease={() => setIntensity((value) => Math.min(5, value + 1))}
          />
          <Stepper
            label="Pace"
            display={CYCLE_LABEL[pace]}
            onDecrease={() => setPace((value) => step(CYCLE_LEVELS, value, -1))}
            onIncrease={() => setPace((value) => step(CYCLE_LEVELS, value, 1))}
          />
        </div>

        <div className="mt-4">
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Held</Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={heldSec}
              onChange={(event) => setHeldSec(event.target.value)}
              placeholder="0"
              className="tnum h-11 rounded-xl text-[13px]"
            />
            <span className="text-[12px] text-muted-foreground">seconds</span>
          </div>
        </div>

        <div className="mt-5 space-y-2">
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
              {CALL_LABEL[preview.call] ?? preview.call}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{preview.reason}</p>
          </div>
        )}

        <div className="mt-5">
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

        <div className="mt-5 flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <p className="text-[13px]">Dry</p>
          <Switch checked={isDry} onCheckedChange={setIsDry} />
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <div>
            <p className="text-[13px]">Finished</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Ends the session on this check-in.</p>
          </div>
          <Switch checked={finished} onCheckedChange={setFinished} />
        </div>

        <div className="mt-5">
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">How it feels</Label>
          <Textarea
            value={felt}
            onChange={(event) => setFelt(event.target.value)}
            rows={3}
            placeholder="In your own words."
            className="mt-2 rounded-xl"
          />
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
      </SheetContent>
    </Sheet>
  );
}