import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { evaluateQuietCheckInFor } from "@/lib/quiet-checkins.server";

// The only source of truth for a quiet call. Deterministic rules, no AI.
export const evaluateQuietCheckIn = createServerFn({ method: "POST" })
  .validator(z.object({ checkInId: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const { result } = await evaluateQuietCheckInFor(context.getBase44(), data.checkInId);
    return result;
  });