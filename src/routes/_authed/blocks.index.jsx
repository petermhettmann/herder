import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { rangeLabel } from "@/lib/block-utils";
import Stepper from "@/components/session/Stepper";

export const Route = createFileRoute("/_authed/blocks/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Blocks · Herder" }] }),
  component: BlocksPage,
});

function BlocksPage() {
  const [blocks, setBlocks] = useState(null);
  const [sessions, setSessions] = useState([]);

  async function load() {
    const [blockList, sessionList] = await Promise.all([
      base44.entities.Block.list("-number", 50),
      base44.entities.Session.list("-start_time", 300),
    ]);
    setBlocks(blockList ?? []);
    setSessions(sessionList ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  if (!blocks) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-20 rounded-sm bg-secondary" />
        <div className="h-7 w-48 rounded-sm bg-secondary" />
        <div className="mt-8 h-24 rounded-xl border border-border" />
      </div>
    );
  }

  const byBlock = new Map();
  for (const session of sessions) {
    if (!session.block) continue;
    const list = byBlock.get(session.block) ?? [];
    list.push(session);
    byBlock.set(session.block, list);
  }

  const open = blocks[0] ?? null;

  async function setSize(value) {
    if (!open) return;
    setBlocks((previous) => previous.map((block) => (block.id === open.id ? { ...block, size: value } : block)));
    await base44.entities.Block.update(open.id, { size: value });
  }

  return (
    <div className="animate-fade-up">
      <Link to="/" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
        Home
      </Link>
      <h1 className="mt-3 font-heading text-[24px] font-medium leading-tight tracking-[-0.02em]">Blocks</h1>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        A block is a count of sessions. Each session you start joins the open block; when it is full, the next one
        begins.
      </p>

      {open && (
        <div className="mt-5">
          <Stepper
            label="Sessions per block"
            display={`${open.size ?? 10}`}
            onDecrease={() => setSize(Math.max(1, (open.size ?? 10) - 1))}
            onIncrease={() => setSize((open.size ?? 10) + 1)}
          />
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="mt-6 text-[12px] text-muted-foreground">
          No blocks yet. The first session you start opens block 1.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {blocks.map((block) => {
            const list = byBlock.get(block.id) ?? [];
            return (
              <Link
                key={block.id}
                to="/blocks/$blockId"
                params={{ blockId: block.id }}
                className="block rounded-xl border border-border p-4 transition-colors hover:bg-secondary"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium">Block {block.number}</p>
                  <p className="tnum shrink-0 text-[11px] text-muted-foreground">
                    {list.length} / {block.size ?? 10}
                  </p>
                </div>
                <p className="tnum mt-1 text-[11px] text-muted-foreground">{rangeLabel(list)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}