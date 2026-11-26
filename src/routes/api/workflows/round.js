import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { latestCheckIn, raisePrompt, workflowBase44 } from "@/lib/prompt-queue.server";

// Workflow route: ninety seconds after a round is logged, a check-in is forced unless one landed.
export const Route = createFileRoute("/api/workflows/round")({
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
        if (session.status !== "active" && session.status !== "break") {
          return Response.json({ skipped: true, reason: `session ${session.status}` });
        }

        const newest = await latestCheckIn(base44, session.id);
        if (newest && newest.id !== checkIn.id) {
          return Response.json({ skipped: true, reason: "answered" });
        }

        const outcome = await raisePrompt(base44, session, "round", "Round logged. Check in now.", {
          lastCheckIn: newest,
        });
        return Response.json({ session: session.id, checkIn: checkIn.id, outcome });
      },
    },
  },
});