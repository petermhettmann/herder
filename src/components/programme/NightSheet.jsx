import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Segmented from "@/components/session/Segmented";
import Stepper from "@/components/session/Stepper";
import { SUCTION_FOR } from "@/lib/programme";

const LEVEL_OPTIONS = [1, 2, 3, 4].map((value) => ({ value, label: `${value}` }));

export default function NightSheet({ night, busy, onClose, onSave, onSkip }) {
  const [minutes, setMinutes] = useState(0);
  const [level, setLevel] = useState(1);
  const [denial, setDenial] = useState(false);

  useEffect(() => {
    if (!night) return;
    setMinutes(night.minutes ?? 0);
    setLevel(night.level || 1);
    setDenial(Boolean(night.denial));
  }, [night]);

  function save() {
    const dark = minutes === 0;
    onSave({
      minutes,
      level: dark ? 0 : level,
      denial,
      status: dark ? "dark" : night.status === "dark" ? "planned" : night.status,
      suction: !dark && night.mode === "machine" ? SUCTION_FOR[level] : night.suction,
    });
  }

  return (
    <Sheet open={Boolean(night)} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent side="bottom" className="rounded-t-xl p-5">
        <SheetHeader className="p-0 text-left">
          <SheetTitle className="font-heading text-[16px] font-medium">
            {night ? `${night.weekday} ${night.date?.slice(8, 10)}` : ""}
          </SheetTitle>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Week {night?.week}</p>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <Stepper
            label="Minutes"
            display={`${minutes} min`}
            onDecrease={() => setMinutes((value) => Math.max(0, value - 5))}
            onIncrease={() => setMinutes((value) => Math.min(120, value + 5))}
          />

          <div>
            <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Level</Label>
            <div className="mt-2">
              <Segmented options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-[13px]">Ends on a denial</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">The night finishes unspent.</p>
            </div>
            <Switch checked={denial} onCheckedChange={setDenial} aria-label="Ends on a denial" />
          </div>

          {night?.note && <p className="text-[11px] leading-relaxed text-muted-foreground">{night.note}</p>}
        </div>

        <div className="mt-6 space-y-2">
          <Button type="button" onClick={save} disabled={busy} className="h-12 w-full rounded-xl text-[13px]">
            {busy ? "Saving..." : "Save night"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={busy}
            className="h-11 w-full rounded-xl text-[13px] text-muted-foreground"
          >
            Skip this night
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}