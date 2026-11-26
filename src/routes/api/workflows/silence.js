import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { activeProtocol, latestCheckIn, minutesSince, raisePrompt, workflowBase44 } from "@/lib/prompt-queue.server";

// Workflow route: an active session with no check-in for the stale window gets a prompt.
export const Route = createFileRoute("/api/workflows/silence")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ context }) => {
        const base44 = workflowBase44(context);
        if (!base44) return Response.json({ error: "Forbidden" }, { status: 403 });

        const protocol = await activeProtocol(base44);
        const staleMin = protocol?.thresholds?.stale_checkin_min ?? 10;

        const page = await base44.entities.Session.filter({ status: "active" }, { sort: "-start_time", limit: 50 });
        const results = [];

        for (const session of page.items ?? []) {
          const lastCheckIn = await latestCheckIn(base44, session.id);
          const anchor = lastCheckIn?.created_date ?? session.start_time;
          if (minutesSince(anchor) < staleMin) continue;

          const outcome = await raisePrompt(
            base44,
            session,
            "silence",
            `${staleMin} minutes of silence. Report condition now.`,
            { lastCheckIn },
          );
          results.push({ session: session.id, outcome });
        }

        return Response.json({ checked: (page.items ?? []).length, prompts: results });
      },
    },
  },
});