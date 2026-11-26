import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { evaluateCheckIn } from "@/lib/checkins";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import Stepper from "@/components/session/Stepper";
import VoiceNote from "@/components/session/VoiceNote";
import useBurstCamera from "@/components/session/useBurstCamera";
import {
  CONDITIONS,
  CONDITION_LABEL,
  CYCLE_LABEL,
  CYCLE_LEVELS,
  SUCTION_LABEL,
  SUCTION_LEVELS,
  elapsedSeconds,
  step,
} from "@/lib/session-utils";

export default function CaptureSheet({ open, onOpenChange, session, lastCheckIn, onSubmitted }) {
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

  async function submit() {
    if (!session || !condition || busy) return;
    setBusy(true);
    setError("");
    try {
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

      await runEvaluate({ data: { checkInId: created.id } });
      onSubmitted(created.id);
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
          <p className="text-[12px] text-muted-foreground">Three shots, then how it feels.</p>
        </SheetHeader>

        <div className="relative mt-4 overflow-hidden rounded-xl border border-border bg-secondary">
          <video ref={camera.videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />
          {!camera.ready && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] text-muted-foreground">
              {camera.error || "Starting camera..."}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {camera.slots.map((slot, index) => (
            <div key={index} className="relative overflow-hidden rounded-lg border border-border bg-secondary">
              {slot ? (
                <>
                  <img src={slot.url} alt={`Shot ${index + 1}`} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => camera.retake(index)}
                    className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/85 py-1 text-[11px] text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                    Retake
                  </button>
                </>
              ) : (
                <div className="tnum flex aspect-square items-center justify-center text-[11px] text-muted-foreground">
                  {index + 1}
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={camera.fireBurst}
          disabled={!camera.ready || camera.firing}
          className="mt-3 h-11 w-full rounded-xl text-[12px]"
        >
          <Camera className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {camera.firing ? "Firing..." : "Take 3 shots, 1s apart"}
        </Button>

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
      </SheetContent>
    </Sheet>
  );
}