import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { raisePrompt, workflowBase44 } from "@/lib/prompt-queue.server";

// Workflow route: the ruin round has started, so the line goes out once.
export const Route = createFileRoute("/api/workflows/ruin-target")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ request, context }) => {
        const base44 = workflowBase44(context);
        if (!base44) return Response.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const checkIn = await base44.entities.CheckIn.get(body?.checkInId).catch(() => null);
        if (!checkIn) return Response.json({ skipped: true, reason: "no check-in" });

        const session = await base44.entities.Session.get(checkIn.session).catch(() => null);
        if (!session) return Response.json({ skipped: true, reason: "no session" });
        if (!session.ruin_target_round) return Response.json({ skipped: true, reason: "no target" });
        if (session.forced_ruin_done) return Response.json({ skipped: true, reason: "already taken" });
        if ((checkIn.round ?? 0) + 1 !== session.ruin_target_round) {
          return Response.json({ skipped: true, reason: "not the target round" });
        }

        const outcome = await raisePrompt(base44, session, "round", "This round is mine.", {
          lastCheckIn: checkIn,
        });
        return Response.json({ session: session.id, round: session.ruin_target_round, outcome });
      },
    },
  },
});