import { cn } from "@/lib/utils";

export default function Segmented({ options, value, onChange, disabled = false }) {
  return (
    <div className="flex gap-1 rounded-xl border border-border p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={cn(
            "flex-1 rounded-lg px-2 py-2 text-[12px] transition-colors disabled:opacity-50",
            value === option.value
              ? "bg-secondary font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}