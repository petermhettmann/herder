import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { resolveCheckInId } from "@/lib/agent-tools.server";

// Tool route for the Inspector agent: hands it the photos and nothing that would bias the grade.
export const Route = createFileRoute("/api/agent/checkin-photos")({
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

        const signed = await Promise.all(
          photos.map(async (fileUri) => {
            const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
              file_uri: fileUri,
              expires_in: 3600,
            });
            return signed_url;
          }),
        );

        return Response.json({ checkInId, count: signed.length, photos: signed });
      },
    },
  },
});