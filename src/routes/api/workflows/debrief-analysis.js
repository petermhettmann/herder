import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { workflowBase44 } from "@/lib/prompt-queue.server";

const CONDITION_LABEL = { fine: "fine", puffy: "puffy", tight_numb: "tight and numb", raw: "raw" };

function summarise(session, checkIns) {
  const breaks = checkIns.filter((item) => item.call_issued === "break");
  const maxSeverity = checkIns.reduce(
    (high, item) => Math.max(high, typeof item.effective_severity === "number" ? item.effective_severity : 0),
    0,
  );
  const breakText = breaks.length
    ? breaks.map((item) => `${item.elapsed_min ?? "?"} min (${item.stated_condition ?? "unstated"})`).join(", ")
    : "none";
  return [
    `${(session.start_time ?? "").slice(0, 10)} ${session.plan_type}`,
    `rounds ${session.rounds_total ?? 0}`,
    `dry ${session.dry_rounds ?? 0}`,
    `breaks at ${breakText}`,
    `peak ${session.peak_elapsed_min ?? 0} min`,
    `max severity ${maxSeverity}`,
    `head next day ${CONDITION_LABEL[session.head_next_day] ?? "unreported"}`,
    session.would_repeat ? `would repeat ${session.would_repeat}/5` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

// Workflow route: once the debrief is saved, read this session against the recent record.
export const Route = createFileRoute("/api/workflows/debrief-analysis")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ request, context }) => {
        const base44 = workflowBase44(context);
        if (!base44) return Response.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const session = await base44.entities.Session.get(body?.sessionId).catch(() => null);
        if (!session) return Response.json({ error: "No such session." }, { status: 404 });
        if (!(session.debrief ?? "").trim()) return Response.json({ skipped: true, reason: "no debrief" });

        const ownPage = await base44.entities.CheckIn.filter(
          { session: session.id },
          { sort: "created_date", limit: 200 },
        );
        const ownCheckIns = ownPage.items ?? [];

        const pastPage = await base44.entities.Session.filter(
          { status: "ended" },
          { sort: "-start_time", limit: 8 },
        );
        const past = (pastPage.items ?? [])
          .filter((item) => item.id !== session.id && (item.debrief ?? "").trim())
          .slice(0, 6);

        const lines = [summarise(session, ownCheckIns)];
        for (const item of past) {
          const page = await base44.entities.CheckIn.filter(
            { session: item.id },
            { sort: "created_date", limit: 200 },
          );
          lines.push(summarise(item, page.items ?? []));
        }

        const analysis = await base44.integrations.Core.InvokeLLM({
          prompt: [
            "You read a single-user session record and state what it shows. Calculated, impersonal, second person, flat and clipped.",
            "Sessions, newest first. Each line: date, plan, rounds, dry rounds, break points with the stated condition, peak minute, highest severity, next-day head, would repeat.",
            ...lines.map((line) => `- ${line}`),
            `Debrief in the user's words: ${session.debrief}`,
            session.where_turned ? `Where it turned: ${session.where_turned}` : "",
            "Write two short paragraphs, plain text, no headings, no bullets, no emoji, no exclamation marks.",
            "First paragraph: what triggers the breaks, naming the minute and condition that recur. Second paragraph: whether the plateau is moving, by comparing the peak minute and highest severity across the sessions listed.",
            "If there are fewer than two past sessions, say in one sentence that the record is too thin to call a trend, then give the break reading only.",
            "Never invent a number that is not above. Ninety words maximum.",
          ]
            .filter(Boolean)
            .join("\n"),
        });

        const text = String(analysis ?? "").trim();
        if (!text) return Response.json({ skipped: true, reason: "empty" });

        await base44.entities.Session.update(session.id, {
          analysis: text,
          analysis_at: new Date().toISOString(),
        });
        return Response.json({ session: session.id, analysis: text });
      },
    },
  },
});