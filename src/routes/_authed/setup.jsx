import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import KitChecklist from "@/components/session/KitChecklist";
import Segmented from "@/components/session/Segmented";
import Stepper from "@/components/session/Stepper";
import {
  CONSTRICTION_LABEL,
  PLAN_LABEL,
  SUCTION_LABEL,
  SUCTION_LEVELS,
  TOY_LABEL,
  kitFor,
  step,
} from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/setup")({
  ssr: false,
  head: () => ({ meta: [{ title: "Set up a session · Herder" }] }),
  component: SetupPage,
});

const PLAN_OPTIONS = ["full", "forced", "payoff", "denial"].map((value) => ({ value, label: PLAN_LABEL[value] }));
const CONSTRICTION_OPTIONS = ["traditional", "constriction"].map((value) => ({
  value,
  label: CONSTRICTION_LABEL[value],
}));
const RUIN_OPTIONS = ["none", "2", "3", "4", "5"].map((value) => ({
  value,
  label: value === "none" ? "None" : value,
}));

function SetupPage() {
  const navigate = useNavigate();
  const [protocol, setProtocol] = useState(null);
  const [planType, setPlanType] = useState("full");
  const [constriction, setConstriction] = useState("traditional");
  const [suction, setSuction] = useState("very_low");
  const [buildMin, setBuildMin] = useState(8);
  const [ruinRound, setRuinRound] = useState("none");
  const [kitChecked, setKitChecked] = useState({});
  const [kitConfirmed, setKitConfirmed] = useState(false);
  const [stretcherMin, setStretcherMin] = useState(15);
  const [briefing, setBriefing] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.entities.Protocol.filter({ active: true }, { limit: 1 })
      .then((page) => {
        const active = (page.items ?? [])[0];
        setProtocol(active ?? null);
        const warmup = active?.plan_tables?.full?.warmup;
        if (warmup?.suction) setSuction(warmup.suction);
        if (warmup?.end_min) setBuildMin(Number(warmup.end_min));
      })
      .catch(() => {});
  }, []);

  // The kit is pre-ticked from the protocol and starts again whenever the plan changes.
  useEffect(() => {
    const required = kitFor(protocol, planType);
    setKitChecked(Object.fromEntries(required.map((toy) => [toy, true])));
    setKitConfirmed(false);
    setStretcherMin(buildMin);
  }, [protocol, planType]);

  const requiredKit = kitFor(protocol, planType);
  const kitReady = requiredKit.length > 0 && requiredKit.every((toy) => kitChecked[toy]) && kitConfirmed;

  async function approve() {
    if (busy || !kitReady) return;
    setBusy(true);
    setError("");
    try {
      const created = await base44.entities.Session.create({
        start_time: new Date().toISOString(),
        plan_type: planType,
        planned_build_min: buildMin,
        ruin_target_round: ruinRound === "none" ? undefined : Number(ruinRound),
        forced_ruin_done: false,
        toys: requiredKit.filter((toy) => kitChecked[toy]),
        kit_confirmed: true,
        stretcher_remove_at_min: requiredKit.includes("stretcher") ? stretcherMin : undefined,
        constriction,
        start_suction: suction,
        status: "active",
        rounds_total: 0,
        breaks_total: 0,
        dry_rounds: 0,
        peak_elapsed_min: 0,
        briefing: briefing || undefined,
      });
      navigate({
        to: planType === "denial" ? "/live/$sessionId/denial" : "/live/$sessionId",
        params: { sessionId: created.id },
      });
    } catch (err) {
      setError(err?.message || "Could not start the session.");
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Before you start</p>
      <h1 className="mt-2 font-heading text-[24px] font-medium leading-tight tracking-[-0.02em]">
        Set the session up.
      </h1>

      <div className="mt-7 space-y-6">
        <div>
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Plan type</Label>
          <div className="mt-2">
            <Segmented options={PLAN_OPTIONS} value={planType} onChange={setPlanType} />
          </div>
        </div>

        {planType !== "denial" && (
          <>
            <div>
              <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Constriction</Label>
              <div className="mt-2">
                <Segmented options={CONSTRICTION_OPTIONS} value={constriction} onChange={setConstriction} />
              </div>
            </div>

            <Stepper
              label="Start suction"
              display={SUCTION_LABEL[suction]}
              onDecrease={() => setSuction(step(SUCTION_LEVELS, suction, -1))}
              onIncrease={() => setSuction(step(SUCTION_LEVELS, suction, 1))}
            />

            <div>
              <div className="flex items-baseline justify-between">
                <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Planned build</Label>
                <span className="tnum text-[13px] font-medium">{buildMin} min</span>
              </div>
              <Slider
                value={[buildMin]}
                min={0}
                max={120}
                step={5}
                onValueChange={([value]) => setBuildMin(value)}
                className="mt-3"
              />
            </div>

            <div>
              <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Ruin target</Label>
              <div className="mt-2">
                <Segmented options={RUIN_OPTIONS} value={ruinRound} onChange={setRuinRound} />
              </div>
            </div>
          </>
        )}

        <KitChecklist
          required={requiredKit}
          checked={kitChecked}
          onToggle={(toy) => setKitChecked((previous) => ({ ...previous, [toy]: !previous[toy] }))}
          confirmed={kitConfirmed}
          onConfirm={setKitConfirmed}
          stretcherMin={stretcherMin}
          onStretcherMin={setStretcherMin}
        />
      </div>

      <div className="mt-8 rounded-xl border border-border p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Briefing</p>
        <div className="mt-3 space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span>{PLAN_LABEL[planType]}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">Kit</span>
            <span className="text-right">{requiredKit.map((toy) => TOY_LABEL[toy] ?? toy).join(", ")}</span>
          </div>
          {planType === "denial" ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target</span>
                <span className="tnum">{protocol?.denial_target ?? 7} edges</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cap</span>
                <span className="tnum">{protocol?.denial_cap_min ?? 30} min</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Constriction</span>
                <span>{CONSTRICTION_LABEL[constriction]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start suction</span>
                <span>{SUCTION_LABEL[suction]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Build</span>
                <span className="tnum">{buildMin} min</span>
              </div>
              {ruinRound !== "none" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ruin target</span>
                  <span className="tnum">Round {ruinRound}</span>
                </div>
              )}
            </>
          )}
        </div>

        <Textarea
          value={briefing}
          onChange={(event) => setBriefing(event.target.value)}
          rows={3}
          placeholder="One line on what this session is for."
          className="mt-4 rounded-xl"
        />

        {!kitReady && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Tick every item on the kit and confirm it to start.
          </p>
        )}

        {error && <p className="mt-3 text-[11px] text-call-stop">{error}</p>}

        <Button
          type="button"
          onClick={approve}
          disabled={busy || !kitReady}
          className="mt-4 h-14 w-full rounded-xl text-[14px]"
        >
          {busy ? "Starting..." : "Approve and start"}
        </Button>
      </div>
    </div>
  );
}