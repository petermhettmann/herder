import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { raisePrompt, workflowBase44 } from "@/lib/prompt-queue.server";

const FOLLOW_UP_AFTER_MS = 18 * 60 * 60 * 1000;

// Workflow route: eighteen hours after a session ends, ask for the next-day head condition.
export const Route = createFileRoute("/api/workflows/head-followup")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ context }) => {
        const base44 = workflowBase44(context);
        if (!base44) return Response.json({ error: "Forbidden" }, { status: 403 });

        const page = await base44.entities.Session.filter(
          { status: "ended", follow_up_sent: { $ne: true } },
          { sort: "-ended_at", limit: 50 },
        );
        const results = [];

        for (const session of page.items ?? []) {
          const endedMs = Date.parse(session.ended_at ?? session.start_time);
          if (!Number.isFinite(endedMs) || Date.now() - endedMs < FOLLOW_UP_AFTER_MS) continue;

          const answered = session.head_next_day && session.head_next_day !== "unknown";
          if (!answered) {
            const outcome = await raisePrompt(
              base44,
              session,
              "followup",
              "Eighteen hours since the end. Report head condition now: fine, puffy, tight and numb, or raw.",
            );
            results.push({ session: session.id, outcome });
          }

          await base44.entities.Session.update(session.id, { follow_up_sent: true });
        }

        return Response.json({ checked: (page.items ?? []).length, prompts: results });
      },
    },
  },
});