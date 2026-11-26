import BlockConditions from "@/components/block/BlockConditions";
import BlockSession from "@/components/block/BlockSession";
import BlockTotals from "@/components/block/BlockTotals";
import InspectorTrend from "@/components/block/InspectorTrend";

// BLOCK [n] — [dates]. Takes the block's sessions, every check-in in it, and its daily log.
export default function BlockReport({ number, dates, size, sessions = [], checkIns = [], days = [], onLogDay }) {
  const ordered = [...sessions].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));

  const bySession = new Map();
  for (const checkIn of checkIns) {
    const list = bySession.get(checkIn.session) ?? [];
    list.push(checkIn);
    bySession.set(checkIn.session, list);
  }

  return (
    <div className="animate-fade-up pb-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Block {number}</p>
      <h1 className="mt-1 font-heading text-[24px] font-medium leading-tight tracking-[-0.02em]">{dates}</h1>
      <p className="tnum mt-1 text-[11px] text-muted-foreground">
        {ordered.length} of {size ?? "—"} sessions
      </p>

      <BlockConditions days={days} onLogDay={onLogDay} />
      <BlockTotals sessions={ordered} />
      <InspectorTrend checkIns={checkIns} />

      {ordered.length === 0 ? (
        <p className="mt-6 text-[12px] text-muted-foreground">No sessions in this block yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {ordered.map((session) => (
            <BlockSession key={session.id} session={session} checkIns={bySession.get(session.id) ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}