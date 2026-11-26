import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import BurstCamera from "@/components/session/BurstCamera";
import useBurstCamera from "@/components/session/useBurstCamera";
import { elapsedSeconds } from "@/lib/session-utils";

export default function DenialCaptureSheet({ open, onOpenChange, session, wand, edgeIndex, onSubmitted }) {
  const camera = useBurstCamera(open);
  const [ruined, setRuined] = useState(false);
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRuined(false);
    setMissed(false);
    setError("");
    camera.reset();
  }, [open, camera.reset]);

  async function submit() {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      const photos = [];
      for (const slot of camera.slots) {
        if (!slot) continue;
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({
          file: new File([slot.blob], "edge.jpg", { type: "image/jpeg" }),
        });
        photos.push(file_uri);
      }

      const created = await base44.entities.CheckIn.create({
        session: session.id,
        elapsed_min: Math.floor(elapsedSeconds(session.start_time) / 60),
        edge_index: edgeIndex + 1,
        wand_intensity: wand,
        ruined,
        missed_count: missed,
        photo_burst: photos,
      });
      onSubmitted(created.id);
    } catch (err) {
      setError(err?.message || "Could not log that edge.");
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-xl border-border bg-card p-5">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="font-heading text-[18px] font-medium tracking-[-0.01em]">Log edge</SheetTitle>
          <p className="text-[12px] text-muted-foreground">
            Edge {edgeIndex + 1} at wand {wand}.
          </p>
        </SheetHeader>

        <div className="mt-4">
          <BurstCamera camera={camera} />
        </div>

        <div className="mt-6 space-y-3">
          <ToggleRow
            label="Missed count"
            hint="The next hold runs longer."
            checked={missed}
            onChange={setMissed}
          />
          <ToggleRow
            label="Ruined"
            hint="Takes one off the target."
            checked={ruined}
            onChange={setRuined}
          />
        </div>

        {error && <p className="mt-4 text-[11px] text-call-stop">{error}</p>}

        <Button type="button" onClick={submit} disabled={busy} className="mt-5 h-14 w-full rounded-xl text-[14px]">
          {busy ? "Logging..." : "Log edge"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}