import { cn } from "@/lib/utils";

// Week by week, Monday to Sunday. Dark cells stay empty.
export default function NightGrid({ weeks, onSelect }) {
  return (
    <div className="space-y-5">
      {weeks.map(({ week, nights }) => (
        <div key={week}>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Week {week}</p>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {nights.map((night) => {
              const dark = night.status === "dark";
              const skipped = night.status === "skipped";
              return (
                <button
                  key={night.id}
                  type="button"
                  onClick={() => onSelect(night)}
                  aria-label={`${night.weekday} ${night.date}${dark ? ", dark" : `, ${night.minutes} minutes`}`}
                  className={cn(
                    "relative rounded-lg border px-1 py-2 text-center transition-colors hover:bg-secondary",
                    dark ? "border-dashed border-border" : "border-border"
                  )}
                >
                  <span className={cn("block text-[11px] leading-none", dark && "text-muted-foreground")}>
                    {night.weekday}
                  </span>
                  <span className="tnum mt-1 block text-[11px] leading-none text-muted-foreground">
                    {night.date ? night.date.slice(8, 10) : ""}
                  </span>
                  <span
                    className={cn(
                      "tnum mt-1.5 block text-[11px] leading-none",
                      skipped && "text-muted-foreground line-through"
                    )}
                  >
                    {dark ? "" : night.minutes}
                  </span>
                  {night.denial && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-call-caution" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}