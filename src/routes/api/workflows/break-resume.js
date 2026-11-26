import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { activeProtocol, latestCheckIn, raisePrompt, workflowBase44 } from "@/lib/prompt-queue.server";

// Workflow route: a break that has run out gets a resume prompt, repeated every few minutes
// while it goes unanswered.
export const Route = createFileRoute("/api/workflows/break-resume")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ context }) => {
        const base44 = workflowBase44(context);
        if (!base44) return Response.json({ error: "Forbidden" }, { status: 403 });

        const protocol = await activeProtocol(base44);
        const repeatMin = protocol?.thresholds?.break_overrun_ping ?? 3;

        const page = await base44.entities.Session.filter({ status: "break" }, { sort: "-start_time", limit: 50 });
        const results = [];

        for (const session of page.items ?? []) {
          const breakEnd = (session.break_ends ?? []).slice(-1)[0];
          if (!breakEnd || Date.parse(breakEnd) > Date.now()) continue;

          const lastCheckIn = await latestCheckIn(base44, session.id);
          const outcome = await raisePrompt(base44, session, "resume", "Break is over. Resume now.", {
            lastCheckIn,
            repeatGapMin: repeatMin,
          });
          results.push({ session: session.id, outcome });
        }

        return Response.json({ checked: (page.items ?? []).length, prompts: results });
      },
    },
  },
});