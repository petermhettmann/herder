import { Minus, Plus } from "lucide-react";

export default function Stepper({ label, display, onDecrease, onIncrease, disabled = false }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-border">
        <button
          type="button"
          onClick={onDecrease}
          disabled={disabled}
          aria-label={`Lower ${label}`}
          className="flex h-11 w-11 items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <Minus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className="text-[13px] font-medium">{display}</span>
        <button
          type="button"
          onClick={onIncrease}
          disabled={disabled}
          aria-label={`Raise ${label}`}
          className="flex h-11 w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}