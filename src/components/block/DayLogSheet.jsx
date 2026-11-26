import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import Stepper from "@/components/session/Stepper";

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// One day of conditions inside a block.
export default function DayLogSheet({ open, onOpenChange, blockId, days = [], onSaved }) {
  const [date, setDate] = useState(today);
  const [sleep, setSleep] = useState(7);
  const [water, setWater] = useState(6);
  const [cage, setCage] = useState(false);
  const [denial, setDenial] = useState(false);
  const [edges, setEdges] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const existing = days.find((day) => day.date === date) ?? null;

  useEffect(() => {
    if (!open) return;
    setError("");
    const entry = days.find((day) => day.date === date) ?? null;
    setSleep(entry?.sleep_hours ?? 7);
    setWater(entry?.hydration ?? 6);
    setCage(entry?.cage ?? false);
    setDenial(entry?.denial ?? false);
    setEdges(entry?.edges ?? 0);
  }, [open, date, days]);

  async function save() {
    if (busy || !blockId) return;
    setBusy(true);
    setError("");
    try {
      const payload = { block: blockId, date, sleep_hours: sleep, hydration: water, cage, denial, edges };
      if (existing) await base44.entities.DayLog.update(existing.id, payload);
      else await base44.entities.DayLog.create(payload);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || "Could not save that day.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-xl border-border bg-card p-5">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="font-heading text-[18px] font-medium tracking-[-0.01em]">
            {existing ? "Edit the day" : "Log a day"}
          </SheetTitle>
          <p className="text-[12px] text-muted-foreground">Sleep, water, cage, denial, edges.</p>
        </SheetHeader>

        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Date</p>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 h-11 rounded-xl"
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stepper
            label="Slept"
            display={`${sleep} h`}
            onDecrease={() => setSleep((value) => clamp(Number((value - 0.5).toFixed(1)), 0, 14))}
            onIncrease={() => setSleep((value) => clamp(Number((value + 0.5).toFixed(1)), 0, 14))}
          />
          <Stepper
            label="Water"
            display={`${water}`}
            onDecrease={() => setWater((value) => clamp(value - 1, 0, 20))}
            onIncrease={() => setWater((value) => clamp(value + 1, 0, 20))}
          />
        </div>

        <div className="mt-3">
          <Stepper
            label="Edges"
            display={`${edges}`}
            onDecrease={() => setEdges((value) => clamp(value - 1, 0, 50))}
            onIncrease={() => setEdges((value) => clamp(value + 1, 0, 50))}
          />
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
            <span className="text-[12px]">Cage on</span>
            <Switch checked={cage} onCheckedChange={setCage} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
            <span className="text-[12px]">Held in denial</span>
            <Switch checked={denial} onCheckedChange={setDenial} />
          </div>
        </div>

        {error && <p className="mt-4 text-[11px] text-call-stop">{error}</p>}

        <Button
          type="button"
          onClick={save}
          disabled={busy || !date}
          className="mt-5 h-14 w-full rounded-xl text-[14px]"
        >
          {busy ? "Saving..." : existing ? "Save the day" : "Log the day"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}