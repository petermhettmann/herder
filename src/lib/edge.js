import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { evaluateEdgeFor } from "@/lib/edge.server";

// The only source of truth for an edge in a denial session. Deterministic rules, no AI.
export const evaluateEdge = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ checkInId: z.string().min(1) }))
  .handler(({ data, context }) => evaluateEdgeFor(context.getBase44(), data.checkInId));