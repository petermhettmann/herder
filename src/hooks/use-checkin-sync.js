import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { base44 } from "@/api/base44Client";
import { evaluateCheckIn } from "@/lib/checkins";

// Re-runs the server call for check-ins whose verdict was decided on the device.
export default function useCheckInSync(sessionId, onReconciled) {
  const runEvaluate = useServerFn(evaluateCheckIn);
  const notify = useRef(onReconciled);

  useEffect(() => {
    notify.current = onReconciled;
  }, [onReconciled]);

  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    let running = false;

    async function reconcile() {
      if (running) return;
      running = true;
      try {
        const page = await base44.entities.CheckIn.filter(
          { session: sessionId, unsynced: true },
          { limit: 20 },
        );
        let synced = 0;
        for (const item of page.items ?? []) {
          if (cancelled) return;
          try {
            await runEvaluate({ data: { checkInId: item.id } });
            synced += 1;
          } catch {
            return; // Still offline. The next online event tries again.
          }
        }
        if (synced > 0 && !cancelled) notify.current?.();
      } catch {
        // The list itself failed; nothing to reconcile yet.
      } finally {
        running = false;
      }
    }

    reconcile();
    window.addEventListener("online", reconcile);

    return () => {
      cancelled = true;
      window.removeEventListener("online", reconcile);
    };
  }, [sessionId, runEvaluate]);
}