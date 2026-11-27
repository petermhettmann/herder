import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PhotoStrip from "@/components/session/PhotoStrip";
import { PLAN_LABEL, shortDate } from "@/lib/session-utils";

export const Route = createFileRoute("/_authed/archive")({
  ssr: false,
  head: () => ({ meta: [{ title: "Archive · Herder" }] }),
  component: ArchivePage,
});

function ArchivePage() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    base44.entities.CheckIn.list("-created_date", 300).then(async (items) => {
      const bySession = new Map();
      for (const item of items ?? []) {
        if (!item.photo_burst?.length) continue;
        const entry = bySession.get(item.session) ?? { id: item.session, uris: [], count: 0, latest: item.created_date };
        entry.count += item.photo_burst.length;
        if (entry.uris.length < 3) entry.uris.push(...item.photo_burst.slice(0, 3 - entry.uris.length));
        bySession.set(item.session, entry);
      }
      const found = [...bySession.values()];
      const sessions = await Promise.all(found.map((row) => base44.entities.Session.get(row.id).catch(() => null)));
      setRows(
        found
          .map((row, index) => ({ ...row, session: sessions[index] }))
          .filter((row) => row.session)
          .sort((a, b) => Date.parse(b.latest) - Date.parse(a.latest)),
      );
    });
  }, []);

  if (!rows) {
    return <div className="h-40 animate-pulse rounded-xl border border-border" aria-hidden="true" />;
  }

  return (
    <div className="animate-fade-up pb-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Archive</p>
      <h1 className="mt-2 font-heading text-[24px] font-medium tracking-[-0.02em]">Everything photographed.</h1>

      {rows.length === 0 ? (
        <p className="mt-8 text-[13px] text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="mt-6 border-t border-border">
          {rows.map((row) => (
            <Link
              key={row.id}
              to="/live/$sessionId/log"
              params={{ sessionId: row.id }}
              className="block border-b border-border py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-medium">{shortDate(row.session.start_time)}</p>
                <span className="tnum shrink-0 text-[11px] text-muted-foreground">{row.count} photos</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {PLAN_LABEL[row.session.plan_type]} · {row.session.mode === "quiet" ? "Quiet kit" : "Machine"}
              </p>
              <div className="mt-2">
                <PhotoStrip uris={row.uris} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}