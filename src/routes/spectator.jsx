import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SUCTION_LABEL, clock } from "@/lib/session-utils";

export const Route = createFileRoute("/spectator")({
  head: () => ({
    meta: [
      { title: "Live · Herder" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SpectatorPage,
});

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="tnum mt-1 text-[15px] font-medium">{value}</p>
    </div>
  );
}

function SpectatorPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/public/spectator", { cache: "no-store" });
        const body = await response.json();
        if (!cancelled) setSnapshot({ ...body, at: Date.now() });
      } catch {
        // Keep the last reading; the next poll picks it up.
      }
    }

    load();
    const poll = setInterval(load, 10000);
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const live = Boolean(snapshot?.live);
  const seconds = live
    ? Math.max(0, (snapshot.elapsed_seconds ?? 0) + Math.floor((now - snapshot.at) / 1000))
    : 0;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-[560px]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {live ? "Live" : "Standby"}
          </p>
          <span
            className={live ? "h-1.5 w-1.5 rounded-full bg-call-go" : "h-1.5 w-1.5 rounded-full bg-muted-foreground"}
            aria-hidden="true"
          />
        </div>

        <p className="tnum mt-4 text-[64px] font-medium leading-none tracking-[-0.02em]">{clock(seconds)}</p>
        <p className="mt-2 text-[12px] text-muted-foreground">Elapsed</p>

        {live ? (
          <div className="mt-7 grid grid-cols-3 gap-4 border-t border-border pt-5">
            <Field label="Round" value={snapshot.round ?? 0} />
            <Field label="Phase" value={snapshot.phase ?? "Open"} />
            <Field label="Suction" value={SUCTION_LABEL[snapshot.suction] ?? "Off"} />
          </div>
        ) : (
          <p className="mt-7 border-t border-border pt-5 text-[13px] text-muted-foreground">
            No session running.
          </p>
        )}
      </div>
    </main>
  );
}