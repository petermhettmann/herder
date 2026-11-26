import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { workflowBase44 } from "@/lib/prompt-queue.server";

// Workflow route: an ended session gets its stats written, which unlocks the debrief numbers.
export const Route = createFileRoute("/api/workflows/end-stats")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ request, context }) => {
        const base44 = workflowBase44(context);
        if (!base44) return Response.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const session = await base44.entities.Session.get(body?.sessionId).catch(() => null);
        if (!session) return Response.json({ error: "No such session." }, { status: 404 });
        if (session.status !== "ended") return Response.json({ skipped: true, reason: session.status });

        const endedAt = session.ended_at ?? new Date().toISOString();
        const startMs = Date.parse(session.start_time);
        const endMs = Date.parse(endedAt);
        const elapsedMin = Number.isFinite(startMs) && Number.isFinite(endMs)
          ? Math.max(0, Math.round((endMs - startMs) / 60000))
          : null;

        const page = await base44.entities.CheckIn.filter({ session: session.id }, { sort: "created_date", limit: 200 });
        const checkIns = page.items ?? [];

        const firstBreak = checkIns.find((item) => item.call_issued === "break");
        const maxSeverity = checkIns.reduce(
          (high, item) => Math.max(high, typeof item.effective_severity === "number" ? item.effective_severity : 0),
          0,
        );
        const gaps = [];
        for (let index = 1; index < checkIns.length; index += 1) {
          const gap = (checkIns[index].elapsed_min ?? 0) - (checkIns[index - 1].elapsed_min ?? 0);
          if (gap >= 0) gaps.push(gap);
        }

        const stats = {
          elapsed_min: elapsedMin,
          check_ins: checkIns.length,
          rounds: session.rounds_total ?? 0,
          breaks: session.breaks_total ?? 0,
          dry_rounds: session.dry_rounds ?? 0,
          peak_min: session.peak_elapsed_min ?? 0,
          first_break_min: firstBreak?.elapsed_min ?? null,
          max_severity: maxSeverity,
          avg_round_gap_min: gaps.length
            ? Math.round((gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) * 10) / 10
            : null,
          last_call: checkIns.slice(-1)[0]?.call_issued ?? null,
        };

        await base44.entities.Session.update(session.id, {
          ...(session.ended_at ? {} : { ended_at: endedAt }),
          stats,
        });

        return Response.json({ session: session.id, stats });
      },
    },
  },
});