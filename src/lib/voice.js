import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Turns an uploaded voice note into text. Runs server-side only.
export const transcribeNote = createServerFn({ method: "POST" })
  .validator(z.object({ fileUri: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const text = await context
      .getBase44()
      .asServiceRole.integrations.Core.TranscribeAudio({ audio_url: data.fileUri });
    return { text: typeof text === "string" ? text.trim() : "" };
  });