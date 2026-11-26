import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PhotoStrip from "@/components/session/PhotoStrip";
import {
  CALL_DOT,
  CALL_LABEL,
  CALL_TEXT,
  CONDITION_LABEL,
  CYCLE_LABEL,
  SUCTION_LABEL,
  shortDate,
} from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/live/$sessionId_/log")({
  ssr: false,
  head: () => ({ meta: [{ title: "Log · Herder" }] }),
  component: LogPage,
});

function LogPage() {
  const { sessionId } = Route.useParams();
  const [checkIns, setCheckIns] = useState(null);

  useEffect(() => {
    base44.entities.CheckIn.filter({ session: sessionId }, { sort: "-created_date", limit: 200 })
      .then((page) => setCheckIns(page.items ?? []));
  }, [sessionId]);

  if (!checkIns) {
    return <div className="h-40 animate-pulse rounded-xl border border-border" aria-hidden="true" />;
  }

  return (
    <div className="animate-fade-up">
      <Link to="/live/$sessionId" params={{ sessionId }} className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
        Session
      </Link>

      <h1 className="mt-2 font-heading text-[24px] font-medium tracking-[-0.02em]">Log</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        <span className="tnum">{checkIns.length}</span> check-ins, newest first.
      </p>

      {checkIns.length === 0 ? (
        <p className="mt-8 text-[13px] text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <div className="mt-6 border-t border-border">
          {checkIns.map((checkIn) => {
            const call = checkIn.call_issued ?? "continue";
            return (
              <Collapsible key={checkIn.id} className="border-b border-border">
                <CollapsibleTrigger className="group flex w-full items-center gap-3 py-3 text-left">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CALL_DOT[call]}`} aria-hidden="true" />
                  <span className="tnum w-12 shrink-0 text-[12px] text-muted-foreground">
                    {checkIn.elapsed_min ?? 0}m
                  </span>
                  <span className={`text-[13px] font-medium ${CALL_TEXT[call]}`}>{CALL_LABEL[call]}</span>
                  <span className="tnum ml-auto text-[11px] text-muted-foreground">
                    sev {checkIn.effective_severity ?? 0}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.75} aria-hidden="true" />
                </CollapsibleTrigger>

                <CollapsibleContent className="pb-4 pl-[3.5rem] pr-1">
                  <p className="text-[12px] leading-relaxed text-muted-foreground">{checkIn.call_reason}</p>

                  <div className="tnum mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {checkIn.stated_condition && <span>{CONDITION_LABEL[checkIn.stated_condition]}</span>}
                    {checkIn.closeness != null && <span>closeness {checkIn.closeness}</span>}
                    {checkIn.suction && <span>{SUCTION_LABEL[checkIn.suction]}</span>}
                    {checkIn.cycle && <span>{CYCLE_LABEL[checkIn.cycle]}</span>}
                    {checkIn.break_minutes > 0 && <span>break {checkIn.break_minutes}m</span>}
                    {checkIn.is_dry && <span>dry</span>}
                  </div>

                  {checkIn.photo_burst?.length > 0 && (
                    <div className="mt-3">
                      <PhotoStrip uris={checkIn.photo_burst} />
                    </div>
                  )}

                  {checkIn.felt_text && (
                    <p className="mt-3 text-[12px] leading-relaxed text-foreground">{checkIn.felt_text}</p>
                  )}

                  {checkIn.overridden && (
                    <div className="mt-3 rounded-lg border border-border px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-call-caution">Overridden</p>
                      {checkIn.override_note && (
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{checkIn.override_note}</p>
                      )}
                    </div>
                  )}

                  <p className="mt-3 text-[11px] text-muted-foreground">{shortDate(checkIn.created_date)}</p>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}