import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Segmented from "@/components/session/Segmented";
import { LENGTHS, todayISO } from "@/lib/programme";
import { createProgramme } from "@/lib/programme-fns";
import { MODE_LABEL } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/build")({
  ssr: false,
  head: () => ({ meta: [{ title: "Build a programme · Herder" }] }),
  component: BuildPage,
});

const MODE_OPTIONS = ["machine", "quiet"].map((value) => ({ value, label: MODE_LABEL[value] }));
const LENGTH_OPTIONS = LENGTHS.map((value) => ({ value, label: `${value} weeks` }));

function BuildPage() {
  const navigate = useNavigate();
  const create = useServerFn(createProgramme);
  const [mode, setMode] = useState("machine");
  const [weeks, setWeeks] = useState(4);
  const [startDate, setStartDate] = useState(todayISO());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await create({
        data: { weeks, mode, startDate, name: name.trim() || undefined },
      });
      navigate({ to: "/programme/$programmeId", params: { programmeId: result.programmeId } });
    } catch (err) {
      setError(err?.message || "Could not build the programme.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Programme</p>
      <h1 className="mt-2 font-heading text-[24px] font-medium leading-tight tracking-[-0.02em]">
        Set the weeks.
      </h1>

      <div className="mt-7 space-y-6">
        <div>
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Mode</Label>
          <div className="mt-2">
            <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
          </div>
        </div>

        <div>
          <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Length</Label>
          <div className="mt-2">
            <Segmented options={LENGTH_OPTIONS} value={weeks} onChange={setWeeks} />
          </div>
        </div>

        <div>
          <Label htmlFor="start-date" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Start date
          </Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
            className="mt-2 h-11 rounded-xl"
          />
        </div>

        <div>
          <Label htmlFor="programme-name" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Name
          </Label>
          <Input
            id="programme-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional"
            maxLength={80}
            className="mt-2 h-11 rounded-xl"
          />
        </div>
      </div>

      {error && <p className="mt-5 text-[11px] text-call-stop">{error}</p>}

      <Button type="submit" disabled={busy} className="mt-8 h-14 w-full rounded-xl text-[14px]">
        {busy ? "Building..." : `Build ${weeks} weeks`}
      </Button>

      <Link
        to="/import"
        className="mt-4 block text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        Paste a plan instead
      </Link>
    </form>
  );
}