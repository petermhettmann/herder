import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { evaluateCheckInFor, projectEndFor, runInBackground } from "@/lib/checkins.server";

// The only source of truth for a call. Deterministic rules, no AI.
export const evaluateCheckIn = createServerFn({ method: "POST" })
  .validator(z.object({ checkInId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const { result, sessionId } = await evaluateCheckInFor(base44, data.checkInId);
    // Non-blocking: the projection lands after the call is returned.
    await runInBackground(projectEndFor(base44, sessionId));
    return result;
  });

export const projectEnd = createServerFn({ method: "POST" })
  .validator(z.object({ sessionId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const minutes = await projectEndFor(context.getBase44(), data.sessionId);
    return { projected_end_min: minutes };
  });