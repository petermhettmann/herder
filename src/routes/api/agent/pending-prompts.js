import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";

// Tool route for the Mistress agent: the prompt that is waiting, so the conversation opens with it.
export const Route = createFileRoute("/api/agent/pending-prompts")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ context }) => {
        const base44 = context.getBase44();

        const page = await base44.entities.Prompt.filter(
          { status: "pending" },
          { sort: "-due_at", limit: 3 },
        );
        const prompts = (page.items ?? []).map((item) => ({
          id: item.id,
          session: item.session,
          kind: item.kind,
          text: item.text,
          due_at: item.due_at,
        }));

        return Response.json({ count: prompts.length, prompts });
      },
    },
  },
});