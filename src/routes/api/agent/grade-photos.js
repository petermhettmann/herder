import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { resolveCheckInId } from "@/lib/agent-tools.server";

const GRADE_SCHEMA = {
  type: "object",
  properties: {
    inspector_severity: { type: "integer", minimum: 0, maximum: 3 },
    redness: { type: "integer", minimum: 0, maximum: 3 },
    seal_quality: { type: "integer", minimum: 0, maximum: 3 },
    inspector_note: { type: "string" },
  },
  required: ["inspector_severity", "redness", "seal_quality", "inspector_note"],
};

const PROMPT = `You are a clinical photo inspector for a vacuum-therapy session log. Grade the attached photos of the device seal and the tissue it covers.

inspector_severity, 0 to 3: 0 no swelling or discoloration, 1 mild puffiness, 2 marked swelling or dusky tone, 3 deep discoloration, broken surface or petechiae.
redness, 0 to 3: 0 none, 1 faint, 2 clear, 3 pronounced or spreading.
seal_quality, 0 to 3: 3 clean seal with no leakage, 2 minor leakage, 1 poor seal, 0 no seal visible.
inspector_note: one clinical sentence, 12 words or fewer, numbers only where they were read from the photo.

Report only what is visible. No advice, no reassurance, no diagnosis.`;

const grade = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(3, Math.max(0, Math.round(number)));
};

// Tool route for the Mistress agent: the photos are graded here, never by the agent.
export const Route = createFileRoute("/api/agent/grade-photos")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ request, context }) => {
        const body = await request.json().catch(() => ({}));
        const base44 = context.getBase44();

        const checkInId = await resolveCheckInId(base44, body?.checkInId);
        if (!checkInId) {
          return Response.json({ error: "No check-in to grade. Log a check-in with photos first." }, { status: 404 });
        }

        const checkIn = await base44.entities.CheckIn.get(checkInId);
        const photos = (checkIn.photo_burst ?? []).filter(Boolean).slice(0, 3);
        if (photos.length === 0) {
          return Response.json({ error: "That check-in has no photos." }, { status: 400 });
        }

        const graded = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: PROMPT,
          file_urls: photos,
          response_json_schema: GRADE_SCHEMA,
        });

        const result = {
          inspector_severity: grade(graded?.inspector_severity),
          redness: grade(graded?.redness),
          seal_quality: grade(graded?.seal_quality),
          inspector_note: String(graded?.inspector_note ?? "").slice(0, 240),
        };

        await base44.entities.CheckIn.update(checkInId, result);

        return Response.json({ checkInId, ...result });
      },
    },
  },
});