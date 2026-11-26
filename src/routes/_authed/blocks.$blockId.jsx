import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import BlockReport from "@/components/block/BlockReport";
import DayLogSheet from "@/components/block/DayLogSheet";
import { rangeLabel } from "@/lib/block-utils";

export const Route = createFileRoute("/_authed/blocks/$blockId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Block · Herder" }] }),
  component: BlockPage,
});

function BlockPage() {
  const { blockId } = Route.useParams();
  const [block, setBlock] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [days, setDays] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function load() {
    const record = await base44.entities.Block.get(blockId).catch(() => null);
    setBlock(record);
    if (!record) {
      setLoaded(true);
      return;
    }

    const [sessionPage, checkInList, dayPage] = await Promise.all([
      base44.entities.Session.filter({ block: blockId }, { sort: "start_time", limit: 200 }),
      base44.entities.CheckIn.list("-created_date", 500),
      base44.entities.DayLog.filter({ block: blockId }, { sort: "-date", limit: 400 }),
    ]);

    const blockSessions = sessionPage.items ?? [];
    const ids = new Set(blockSessions.map((session) => session.id));

    setSessions(blockSessions);
    setCheckIns((checkInList ?? []).filter((checkIn) => ids.has(checkIn.session)));
    setDays(dayPage.items ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, [blockId]);

  if (!loaded) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-20 rounded-sm bg-secondary" />
        <div className="h-7 w-56 rounded-sm bg-secondary" />
        <div className="mt-8 h-32 rounded-xl border border-border" />
      </div>
    );
  }

  if (!block) {
    return (
      <div className="animate-fade-up">
        <p className="text-[12px] text-muted-foreground">That block is not here.</p>
        <Link to="/blocks" className="mt-3 inline-block text-[12px] text-primary">
          Back to blocks
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/blocks" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
        Blocks
      </Link>

      <div className="mt-4">
        <BlockReport
          number={block.number}
          size={block.size}
          dates={rangeLabel(sessions)}
          sessions={sessions}
          checkIns={checkIns}
          days={days}
          onLogDay={() => setSheetOpen(true)}
        />
      </div>

      <DayLogSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        blockId={blockId}
        days={days}
        onSaved={load}
      />
    </div>
  );
}