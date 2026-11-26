import { cn } from "@/lib/utils";

// The Inspector's severity across the block, oldest to newest, with where it opened and closed.
export default function InspectorTrend({ checkIns = [] }) {
  const graded = checkIns
    .filter((checkIn) => typeof checkIn.inspector_severity === "number")
    .sort((a, b) => (a.elapsed_min ?? 0) - (b.elapsed_min ?? 0));

  if (!graded.length) return null;

  const first = graded[0].inspector_severity;
  const last = graded[graded.length - 1].inspector_severity;

  return (
    <div className="mt-6 rounded-xl border border-border p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Inspector grades</p>

      <div className="mt-3 flex items-end gap-1">
        {graded.map((checkIn) => (
          <div key={checkIn.id} className="flex-1">
            <div
              className={cn("w-full rounded-sm", barTone(checkIn.inspector_severity))}
              style={{ height: `${8 + Math.max(0, Math.min(3, checkIn.inspector_severity)) * 6}px` }}
              title={`${checkIn.elapsed_min ?? 0} min · severity ${checkIn.inspector_severity}`}
            />
          </div>
        ))}
      </div>

      <p className="tnum mt-2 text-[11px] text-muted-foreground">
        {graded.length} grades · opened at {first} · closed at {last}
      </p>
    </div>
  );
}

function barTone(severity) {
  if (severity >= 3) return "bg-foreground";
  if (severity === 2) return "bg-foreground/70";
  if (severity === 1) return "bg-foreground/40";
  return "bg-foreground/20";
}