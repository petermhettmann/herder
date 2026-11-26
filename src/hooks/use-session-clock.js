import { useEffect, useState } from "react";
import { elapsedSeconds } from "@/lib/session-utils";

// One absolute clock for the session. It ticks once a second and re-reads the time the
// moment the app returns from the background, so a suspended timer never drifts.
export default function useSessionClock(startTime, endedAt = null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", tick);
    window.addEventListener("pageshow", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", tick);
      window.removeEventListener("pageshow", tick);
    };
  }, []);

  const endMs = endedAt ? Date.parse(endedAt) : NaN;
  const reference = Number.isFinite(endMs) ? endMs : now;

  return { now, seconds: elapsedSeconds(startTime, reference) };
}