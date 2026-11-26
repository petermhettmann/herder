import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import Segmented from "@/components/session/Segmented";
import Stepper from "@/components/session/Stepper";
import {
  CONSTRICTION_LABEL,
  PLAN_LABEL,
  SUCTION_LABEL,
  SUCTION_LEVELS,
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

function SetupPage() {
  const navigate = useNavigate();
  const [protocol, setProtocol] = useState(null);
  const [planType, setPlanType] = useState("full");
  const [constriction, setConstriction] = useState("traditional");
  const [suction, setSuction] = useState("very_low");
  const [buildMin, setBuildMin] = useState(8);
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

  async function approve() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await base44.entities.Session.create({
        start_time: new Date().toISOString(),
        plan_type: planType,
        planned_build_min: buildMin,
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
          </>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-border p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Briefing</p>
        <div className="mt-3 space-y-1 text-[12px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span>{PLAN_LABEL[planType]}</span>
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

        {error && <p className="mt-3 text-[11px] text-call-stop">{error}</p>}

        <Button
          type="button"
          onClick={approve}
          disabled={busy}
          className="mt-4 h-14 w-full rounded-xl text-[14px]"
        >
          {busy ? "Starting..." : "Approve and start"}
        </Button>
      </div>
    </div>
  );
}