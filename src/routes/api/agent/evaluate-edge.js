import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireUserRoute } from "@/lib/auth-middleware";
import { evaluateEdgeFor } from "@/lib/edge.server";

const Body = z.object({ checkInId: z.string().min(1) });

export const Route = createFileRoute("/api/agent/evaluate-edge")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ request, context }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "checkInId is required." }, { status: 400 });
        const result = await evaluateEdgeFor(context.getBase44(), parsed.data.checkInId);
        return Response.json(result);
      },
    },
  },
});