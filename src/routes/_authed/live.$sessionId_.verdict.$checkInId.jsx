import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import useCheckInSync from "@/hooks/use-checkin-sync";
import { CALL_LABEL, CALL_TEXT, CONDITION_LABEL, CYCLE_LABEL, SUCTION_LABEL } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/live/$sessionId_/verdict/$checkInId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Verdict · Herder" }] }),
  component: VerdictPage,
});

function VerdictPage() {
  const { sessionId, checkInId } = Route.useParams();
  const [checkIn, setCheckIn] = useState(null);
  const [overridden, setOverridden] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.CheckIn.get(checkInId).then((record) => {
      setCheckIn(record);
      setOverridden(Boolean(record.overridden));
      setNote(record.override_note ?? "");
    });
  }, [checkInId]);

  // A call decided on the device confirms itself once the connection is back.
  useCheckInSync(sessionId, () => {
    base44.entities.CheckIn.get(checkInId).then((record) => setCheckIn(record));
  });

  async function save(nextOverridden, nextNote) {
    // The stamp is written once, when the call is first overridden, and survives later
    // edits to the note. Taking the override back clears it.
    const stamp = nextOverridden ? checkIn?.overridden_at ?? new Date().toISOString() : null;
    setSaving(true);
    try {
      await base44.entities.CheckIn.update(checkInId, {
        overridden: nextOverridden,
        override_note: nextNote || undefined,
        overridden_at: stamp,
      });
      setCheckIn((previous) => ({ ...previous, overridden: nextOverridden, override_note: nextNote, overridden_at: stamp }));
    } finally {
      setSaving(false);
    }
  }

  if (!checkIn) {
    return <div className="h-40 animate-pulse rounded-xl border border-border" aria-hidden="true" />;
  }

  const call = checkIn.call_issued ?? "continue";

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">The call</p>

      <p className={`mt-3 text-[28px] font-medium leading-none tracking-[-0.02em] ${CALL_TEXT[call]}`}>
        {CALL_LABEL[call]}
      </p>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{checkIn.call_reason}</p>

      <div className="tnum mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Severity {checkIn.effective_severity ?? 0}</span>
        <span>{checkIn.elapsed_min ?? 0} min</span>
        {checkIn.break_minutes > 0 && <span>Break {checkIn.break_minutes} min</span>}
        <span>{SUCTION_LABEL[checkIn.suction] ?? "Suction unset"}</span>
        <span>{CYCLE_LABEL[checkIn.cycle] ?? "Cycle unset"}</span>
        {checkIn.stated_condition && <span>{CONDITION_LABEL[checkIn.stated_condition]}</span>}
      </div>

      {checkIn.unsynced && (
        <p className="mt-4 rounded-xl border border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          This call was made on the device. It confirms with the server the moment the connection is back.
        </p>
      )}

      <div className="mt-7 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">Override this call</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {saving ? "Saving..." : "Kept on the record with your note."}
            </p>
          </div>
          <Switch
            checked={overridden}
            onCheckedChange={(next) => {
              setOverridden(next);
              save(next, note);
            }}
          />
        </div>

        {overridden && (
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => save(overridden, note)}
            rows={3}
            placeholder="What you did instead, and why."
            className="mt-3 rounded-xl"
          />
        )}
      </div>

      <Button asChild className="mt-6 h-14 w-full rounded-xl text-[14px]">
        <Link to="/live/$sessionId" params={{ sessionId }}>
          Back to session
        </Link>
      </Button>

      <Link
        to="/live/$sessionId/log"
        params={{ sessionId }}
        className="mt-3 block text-center text-[12px] text-muted-foreground hover:text-foreground"
      >
        See the log
      </Link>
    </div>
  );
}