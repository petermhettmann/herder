import { createFileRoute } from "@tanstack/react-router";
import { phaseInfo } from "@/lib/session-utils";

// Public, read-only snapshot for a stream overlay. Only the four display values leave
// the app: no ids, no photos, no written check-ins, no session notes.
export const Route = createFileRoute("/api/public/spectator")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const base44 = context.getBase44().asServiceRole;
        const headers = { "cache-control": "no-store" };

        const sessionPage = await base44.entities.Session.filter(
          { status: { $in: ["active", "break"] } },
          { sort: "-created_date", limit: 1 },
        );
        const session = (sessionPage.items ?? [])[0] ?? null;
        if (!session) return Response.json({ live: false }, { headers });

        const [protocolPage, checkInPage] = await Promise.all([
          base44.entities.Protocol.filter({ active: true }, { limit: 1 }),
          base44.entities.CheckIn.filter({ session: session.id }, { sort: "-created_date", limit: 1 }),
        ]);
        const protocol = (protocolPage.items ?? [])[0] ?? null;
        const lastCheckIn = (checkInPage.items ?? [])[0] ?? null;
        const plan = protocol?.plan_tables?.[session.plan_type] ?? null;

        const startMs = Date.parse(session.start_time);
        const elapsed = Number.isFinite(startMs)
          ? Math.max(0, Math.floor((Date.now() - startMs) / 1000))
          : 0;
        const phase = phaseInfo(plan, Math.floor(elapsed / 60));

        return Response.json(
          {
            live: true,
            status: session.status,
            elapsed_seconds: elapsed,
            round: session.rounds_total ?? 0,
            phase: phase?.label ?? null,
            suction: lastCheckIn?.suction ?? session.start_suction ?? "off",
          },
          { headers },
        );
      },
    },
  },
});