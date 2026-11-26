import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TOY_INSTRUCTION, TOY_LABEL } from "@/lib/session-utils";
import { cn } from "@/lib/utils";

// The required kit for the plan, pre-ticked from the protocol. Nothing starts until every
// item is ticked and the kit is confirmed.
export default function KitChecklist({
  required = [],
  checked = {},
  onToggle,
  confirmed,
  onConfirm,
  stretcherMin,
  onStretcherMin,
}) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Kit</Label>

      <div className="mt-2 space-y-2">
        {required.map((toy) => {
          const on = Boolean(checked[toy]);
          return (
            <button
              key={toy}
              type="button"
              onClick={() => onToggle(toy)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                on ? "border-primary/60" : "border-border"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                )}
              >
                {on && <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px]">{TOY_LABEL[toy] ?? toy}</span>
                {TOY_INSTRUCTION[toy] && (
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{TOY_INSTRUCTION[toy]}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {required.includes("stretcher") && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Stretcher off at</Label>
            <span className="tnum text-[13px] font-medium">{stretcherMin} min</span>
          </div>
          <Slider
            value={[stretcherMin]}
            min={0}
            max={90}
            step={5}
            onValueChange={([value]) => onStretcherMin(value)}
            className="mt-3"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">off at the swap</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <div>
          <p className="text-[13px] font-medium">Kit confirmed</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Everything on the list is on the bed.</p>
        </div>
        <Switch checked={confirmed} onCheckedChange={onConfirm} />
      </div>
    </div>
  );
}