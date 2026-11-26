import { Label } from "@/components/ui/label";
import { RECEIVERS, RECEIVER_LABEL } from "@/lib/session-utils";
import { cn } from "@/lib/utils";

// What the session is taken on, picked from a fixed list before it starts.
export default function ReceiverPicker({ value = [], onChange }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Receivers</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {RECEIVERS.map((receiver) => {
          const on = value.includes(receiver);
          return (
            <button
              key={receiver}
              type="button"
              onClick={() =>
                onChange(on ? value.filter((item) => item !== receiver) : [...value, receiver])
              }
              className={cn(
                "h-9 rounded-xl border px-3 text-[12px] transition-colors",
                on
                  ? "border-primary bg-primary/10 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {RECEIVER_LABEL[receiver]}
            </button>
          );
        })}
      </div>
    </div>
  );
}