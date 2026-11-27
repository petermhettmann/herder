import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import NightGrid from "@/components/programme/NightGrid";
import NightSheet from "@/components/programme/NightSheet";
import { MODE_LABEL } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/programme/$programmeId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Programme · Herder" }] }),
  component: ProgrammePage,
});

const STATUS_LABEL = { draft: "Draft", active: "Active", complete: "Complete", abandoned: "Abandoned" };

function dateLabel(value) {
  const [year, month, day] = String(value ?? "").split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupWeeks(nights) {
  const map = new Map();
  for (const night of nights) {
    if (!map.has(night.week)) map.set(night.week, []);
    map.get(night.week).push(night);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, list]) => ({ week, nights: list }));
}

function ProgrammePage() {
  const { programmeId } = Route.useParams();
  const navigate = useNavigate();
  const [programme, setProgramme] = useState(null);
  const [nights, setNights] = useState(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const found = await base44.entities.Programme.get(programmeId).catch(() => null);
    if (!found) {
      setMissing(true);
      return;
    }
    setProgramme(found);
    const page = await base44.entities.Night.filter(
      { programme: programmeId },
      { sort: "day_index", limit: 200 }
    );
    setNights(page.items ?? []);
  }, [programmeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNight(patch) {
    if (!editing || busy) return;
    setBusy(true);
    await base44.entities.Night.update(editing.id, patch);
    setEditing(null);
    setBusy(false);
    load();
  }

  async function skipNight() {
    if (!editing || busy) return;
    setBusy(true);
    await base44.entities.Night.update(editing.id, { status: "skipped" });
    setEditing(null);
    setBusy(false);
    load();
  }

  async function endProgramme() {
    if (busy || !programme) return;
    setBusy(true);
    await base44.entities.Programme.update(programme.id, { status: "complete" });
    navigate({ to: "/" });
  }

  if (missing) {
    return <p className="text-[13px] text-muted-foreground">That programme is gone.</p>;
  }

  if (!programme || !nights) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-24 rounded-sm bg-secondary" />
        <div className="h-7 w-48 rounded-sm bg-secondary" />
        <div className="mt-6 h-64 rounded-xl border border-border" />
      </div>
    );
  }

  const denials = nights.filter((night) => night.denial).length;
  const dark = nights.filter((night) => night.status === "dark").length;

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {STATUS_LABEL[programme.status] ?? programme.status}
      </p>
      <h1 className="mt-2 font-heading text-[24px] font-medium leading-tight tracking-[-0.02em]">
        {programme.name}
      </h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {programme.weeks} weeks · {MODE_LABEL[programme.mode] ?? programme.mode} · from{" "}
        {dateLabel(programme.start_date)}
      </p>

      <div className="mt-7">
        <NightGrid weeks={groupWeeks(nights)} onSelect={setEditing} />
      </div>

      <div className="mt-8 border-t border-border pt-4">
        <div className="space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nights</span>
            <span className="tnum">{nights.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Denials</span>
            <span className="tnum">{denials}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dark nights</span>
            <span className="tnum">{dark}</span>
          </div>
        </div>

        {programme.status === "active" && (
          <Button
            type="button"
            variant="outline"
            onClick={endProgramme}
            disabled={busy}
            className="mt-4 h-12 w-full rounded-xl text-[13px]"
          >
            End programme
          </Button>
        )}
      </div>

      <NightSheet
        night={editing}
        busy={busy}
        onClose={() => setEditing(null)}
        onSave={saveNight}
        onSkip={skipNight}
      />
    </div>
  );
}