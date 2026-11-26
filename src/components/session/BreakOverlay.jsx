import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { clock } from "@/lib/session-utils";

// Dimmed break screen: counts down the break and pings again every few minutes past the end.
export default function BreakOverlay({ breakEnd, pingMinutes = 3, onResume, busy = false }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const end = Date.parse(breakEnd);
  const remaining = Number.isFinite(end) ? Math.round((end - now) / 1000) : 0;
  const overrun = remaining < 0 ? -remaining : 0;
  const pings = pingMinutes > 0 ? Math.floor(overrun / (pingMinutes * 60)) : 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/90 px-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">On break</p>

      <p className="tnum mt-4 text-[40px] font-medium leading-none tracking-[-0.02em]">
        {clock(remaining)}
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        {remaining > 0 ? "Left in this break" : "Break is over"}
      </p>

      {pings > 0 && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border px-3 py-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-call-caution" aria-hidden="true" />
          <p className="text-[12px] text-call-caution">
            {pings * pingMinutes} min past the break. End it or extend deliberately.
          </p>
        </div>
      )}

      <Button
        type="button"
        onClick={onResume}
        disabled={busy}
        className="mt-8 h-12 w-full max-w-[280px] rounded-xl text-[13px]"
      >
        {remaining > 0 ? "End break early" : "Resume session"}
      </Button>
    </div>
  );
}