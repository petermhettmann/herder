import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { resolveCheckInId } from "@/lib/agent-tools.server";
import { evaluateCheckInFor } from "@/lib/checkins.server";

// Tool route for the Mistress agent. The rules decide the call; nothing here is AI.
export const Route = createFileRoute("/api/agent/evaluate-checkin")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ request, context }) => {
        const body = await request.json().catch(() => ({}));
        const base44 = context.getBase44();

        const checkInId = await resolveCheckInId(base44, body?.checkInId);
        if (!checkInId) {
          return Response.json({ error: "No check-in to judge. Log a check-in in the app first." }, { status: 404 });
        }

        const { result, sessionId } = await evaluateCheckInFor(base44, checkInId);
        const checkIn = await base44.entities.CheckIn.get(checkInId);
        const session = await base44.entities.Session.get(sessionId);

        return Response.json({
          checkInId,
          call: result.call,
          reason: result.reason,
          target_suction: result.target_suction,
          target_cycle: result.target_cycle,
          break_minutes: checkIn.break_minutes ?? 0,
          elapsed_min: checkIn.elapsed_min ?? 0,
          round: checkIn.round ?? 0,
          effective_severity: checkIn.effective_severity ?? 0,
          session_status: session.status,
        });
      },
    },
  },
});