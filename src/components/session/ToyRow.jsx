import { Label } from "@/components/ui/label";
import { TOY_LABEL } from "@/lib/session-utils";
import { cn } from "@/lib/utils";

// What is still on at this check-in. Tapping the stretcher off is how the kit stays honest.
export default function ToyRow({ toys = [], value = [], onChange }) {
  if (!toys.length) return null;

  return (
    <div>
      <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Toys on</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {toys.map((toy) => {
          const on = value.includes(toy);
          return (
            <button
              key={toy}
              type="button"
              onClick={() => onChange(on ? value.filter((item) => item !== toy) : [...value, toy])}
              className={cn(
                "h-9 rounded-xl border px-3 text-[12px] transition-colors",
                on
                  ? "border-primary bg-primary/10 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {TOY_LABEL[toy] ?? toy}
            </button>
          );
        })}
      </div>
    </div>
  );
}