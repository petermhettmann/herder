import { useEffect, useState } from "react";
import { clock } from "@/lib/session-utils";

// Locked screen after a forced ruin: nothing on the page is tappable until the minute clears.
export default function DeadStopOverlay({ endsAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const end = Date.parse(endsAt);
  const remaining = Number.isFinite(end) ? Math.max(0, Math.round((end - now) / 1000)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.16em] text-call-stop">Dead stop</p>
      <p className="tnum mt-4 text-[48px] font-medium leading-none tracking-[-0.02em]">{clock(remaining)}</p>
      <p className="mt-2 text-[12px] text-muted-foreground">Ruined. Hands off until it clears.</p>
    </div>
  );
}