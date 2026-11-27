import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Segmented from "@/components/session/Segmented";
import { MODE_LABEL } from "@/lib/session-utils";
import { parsePlan, planSummary, serializePlan, setPlanMode } from "@/lib/plan-text";

export const Route = createFileRoute("/_authed/import")({
  ssr: false,
  validateSearch: (search) => ({ from: typeof search.from === "string" ? search.from : undefined }),
  head: () => ({ meta: [{ title: "Import a plan · Herder" }] }),
  component: ImportPage,
});

const MODE_OPTIONS = ["quiet", "machine"].map((value) => ({ value, label: MODE_LABEL[value] }));

const PLACEHOLDER = `# Masturbation Alpha
mode: quiet
start: 2026-12-15

2026-12-15 | 20 | 1 | full | soft | 4 | - | opener, no glans focus
2026-12-16 | 25 | 2 | full | finish | 5 | - | one held edge at 12
2026-12-19 | 45 | 3 | forced | finish | 7 | 4 | ruin on the fourth round
2026-12-20 | 0 | 0 | full | dark | - | - | -`;

function ImportPage() {
  const navigate = useNavigate();
  const { from } = Route.useSearch();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Re-import: the pasted text comes back, or the nights are written out if it was never kept.
  useEffect(() => {
    if (!from) return;
    (async () => {
      const programme = await base44.entities.Programme.get(from).catch(() => null);
      if (!programme) return;
      if (programme.raw_text) {
        setText(programme.raw_text);
        return;
      }
      const page = await base44.entities.Night.filter({ programme: from }, { sort: "day_index", limit: 200 });
      setText(serializePlan(programme, page.items ?? []));
    })();
  }, [from]);

  const parsed = useMemo(() => parsePlan(text), [text]);
  const summary = planSummary(parsed);
  const ready = parsed.errors.length === 0 && summary.nights >= 3;

  async function confirm() {
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    try {
      await base44.entities.Programme.updateMany({ status: "active" }, { $set: { status: "abandoned" } });

      const startDate = parsed.start ?? parsed.nights[0].date;
      const programme = await base44.entities.Programme.create({
        name: parsed.name,
        mode: parsed.mode,
        weeks: Math.max(1, Math.ceil(parsed.nights.length / 7)),
        start_date: startDate,
        status: "active",
        source: "imported",
        imported_at: new Date().toISOString(),
        raw_text: text,
      });

      const startMs = Date.parse(`${startDate}T12:00:00`);
      const machine = parsed.mode === "machine";
      const rows = parsed.nights.map((night) => {
        const offset = Math.max(0, Math.round((Date.parse(`${night.date}T12:00:00`) - startMs) / 86400000));
        const derivedCap = night.minutes > 45 ? 7 : 6;
        const live = !night.dark;
        return {
          programme: programme.id,
          date: night.date,
          weekday: night.weekday,
          week: Math.floor(offset / 7) + 1,
          day_index: offset,
          minutes: night.minutes,
          level: night.level,
          plan_type: night.plan,
          flag: night.flag,
          status: night.dark ? "dark" : "planned",
          denial: night.denial,
          mode: parsed.mode,
          edge_target: live && !machine ? (night.minutes > 45 ? 8 : 5) : undefined,
          round_cap: live && machine ? night.round_cap ?? derivedCap : undefined,
          ruin_target: live ? night.ruin_target : undefined,
          note: night.note,
        };
      });

      if (typeof base44.entities.Night.bulkCreate === "function") {
        await base44.entities.Night.bulkCreate(rows);
      } else {
        for (const row of rows) await base44.entities.Night.create(row);
      }

      navigate({ to: "/programme/$programmeId", params: { programmeId: programme.id } });
    } catch (err) {
      setError(err?.message || "Could not import the plan.");
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {from ? "Re-import" : "Import"}
      </p>
      <h1 className="mt-2 font-heading text-[24px] font-medium leading-tight tracking-[-0.02em]">
        Paste the plan.
      </h1>

      <div className="mt-6">
        <Segmented
          options={MODE_OPTIONS}
          value={parsed.mode}
          onChange={(mode) => setText(setPlanMode(text, mode))}
        />
      </div>

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        className="mt-4 min-h-[42vh] rounded-xl font-mono text-[12px] leading-relaxed"
      />

      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nights found</span>
            <span className="tnum">{summary.nights}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dark</span>
            <span className="tnum">{summary.dark}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Denials</span>
            <span className="tnum">{summary.denial}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">First</span>
            <span className="tnum">{summary.first ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last</span>
            <span className="tnum">{summary.last ?? "—"}</span>
          </div>
        </div>
      </div>

      {parsed.errors.length > 0 && (
        <div className="mt-3 rounded-xl border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-call-stop">
            {parsed.errors.length} {parsed.errors.length === 1 ? "line" : "lines"} to fix
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-call-stop">
            {parsed.errors.map((item, index) => (
              <li key={`${item.at}-${index}`} className="tnum">
                {item.at ? `Line ${item.at}: ` : ""}
                {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-[11px] text-call-stop">{error}</p>}

      <Button
        type="button"
        onClick={confirm}
        disabled={busy || !ready}
        className="mt-5 h-14 w-full rounded-xl text-[14px]"
      >
        {busy ? "Importing..." : "Import plan"}
      </Button>
      {!ready && !parsed.errors.length && (
        <p className="mt-3 text-[11px] text-muted-foreground">At least three nights are needed.</p>
      )}
    </div>
  );
}