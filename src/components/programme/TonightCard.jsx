import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { MODE_LABEL } from "@/lib/session-utils";
import { lastDate, todayISO } from "@/lib/programme";

// Today's night, when a programme is running.
export default function TonightCard() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const page = await base44.entities.Programme.filter({ status: "active" }, { limit: 1 });
      const programme = (page.items ?? [])[0];
      if (!alive) return;
      if (!programme) {
        setState({ programme: null, night: null, complete: false });
        return;
      }

      const today = todayISO();
      if (today > lastDate(programme.start_date, programme.weeks)) {
        await base44.entities.Programme.update(programme.id, { status: "complete" });
        if (alive) setState({ programme, night: null, complete: true });
        return;
      }

      const found = await base44.entities.Night.filter(
        { programme: programme.id, date: today },
        { limit: 1 }
      );
      if (alive) setState({ programme, night: (found.items ?? [])[0] ?? null, complete: false });
    })().catch(() => {
      if (alive) setState({ programme: null, night: null, complete: false });
    });

    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  if (state.complete) {
    return (
      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Programme complete</p>
        <Link
          to="/programme/$programmeId"
          params={{ programmeId: state.programme.id }}
          className="mt-1 block text-[14px] font-medium transition-colors hover:text-primary"
        >
          {state.programme.name}
        </Link>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          It ran to its last night. Build the next one when you are ready.
        </p>
        <Button asChild variant="outline" className="mt-3 h-12 w-full rounded-xl text-[13px]">
          <Link to="/build">Build a programme</Link>
        </Button>
      </div>
    );
  }

  if (!state.programme) {
    return (
      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="text-[13px] text-muted-foreground">No plan running.</p>
        <div className="mt-2 flex items-center gap-4">
          <Link
            to="/import"
            className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Import one
          </Link>
          <Link
            to="/build"
            className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Build one
          </Link>
        </div>
      </div>
    );
  }

  const { programme, night } = state;
  const dark = night?.status === "dark";

  return (
    <div className="mt-6 rounded-xl border border-border p-4">
      <Link
        to="/programme/$programmeId"
        params={{ programmeId: programme.id }}
        className="flex items-baseline justify-between gap-3 transition-colors hover:text-foreground"
      >
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {dark ? "Dark night" : "Tonight"}
        </span>
        <span className="text-[11px] text-muted-foreground">{programme.name}</span>
      </Link>

      <Link
        to="/programme/$programmeId"
        params={{ programmeId: programme.id }}
        className="mt-1 block text-[14px] font-medium transition-colors hover:text-primary"
      >
        {!night
          ? "Nothing scheduled."
          : dark
            ? "Nothing scheduled."
            : `${night.minutes} min · ${MODE_LABEL[night.mode] ?? night.mode} · level ${night.level}`}
      </Link>

      {night?.denial && <p className="mt-1 text-[11px] text-call-caution">Ends on a denial.</p>}
      {night?.note && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{night.note}</p>
      )}

      {night && (
        <Button asChild className="mt-3 h-12 w-full rounded-xl text-[13px]">
          <Link to="/setup" search={{ night: night.id }}>
            {dark ? "Start anyway" : "Start tonight"}
          </Link>
        </Button>
      )}
    </div>
  );
}