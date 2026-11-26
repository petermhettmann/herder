import { createFileRoute } from "@tanstack/react-router";
import { requireUserRoute } from "@/lib/auth-middleware";
import { activeProtocol, workflowBase44 } from "@/lib/prompt-queue.server";

// Workflow route: a new session gets its briefing card written from the protocol.
export const Route = createFileRoute("/api/workflows/briefing")({
  server: {
    middleware: [requireUserRoute],
    handlers: {
      POST: async ({ request, context }) => {
        const base44 = workflowBase44(context);
        if (!base44) return Response.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const session = await base44.entities.Session.get(body?.sessionId).catch(() => null);
        if (!session) return Response.json({ error: "No such session." }, { status: 404 });
        if ((session.briefing ?? "").trim()) {
          return Response.json({ skipped: true, briefing: session.briefing });
        }

        const protocol = await activeProtocol(base44);
        const plan = protocol?.plan_tables?.[session.plan_type] ?? {};

        const limits = [
          `${session.planned_build_min ?? 0} min planned build`,
          typeof plan.cap_min === "number" ? `${plan.cap_min} min cap` : "no cap",
          typeof plan.max_rounds === "number" ? `${plan.max_rounds} rounds maximum` : "no round maximum",
          Array.isArray(plan.breaks) && plan.breaks.length
            ? `breaks at ${plan.breaks.join(" and ")} min`
            : "no scheduled breaks",
        ].join(", ");

        const phases = Object.entries(plan)
          .filter(([, value]) => value && typeof value === "object" && typeof value.suction === "string")
          .map(([name, value]) => `${name} from ${value.start_min ?? value.min ?? 0} min at ${value.suction} suction, ${value.cycle} cycle`)
          .join("; ");

        const briefing = await base44.integrations.Core.InvokeLLM({
          prompt: [
            "Write the briefing card read before a session starts.",
            `Session: ${session.plan_type} plan, ${session.constriction ?? "traditional"} constriction, starting at ${session.start_suction ?? "very_low"} suction.`,
            `Limits, and the only numbers you may use: ${limits}.`,
            phases ? `Phases: ${phases}.` : "No phases defined.",
            "Voice: calculated, impersonal, controlling, second person, flat and clipped.",
            "Six plain sentences maximum. No headings, no bullet points, no markdown, no emoji, no exclamation marks, no encouragement, no advice about safety, no invitation to negotiate.",
            "State what the session is, what the build demands, what the phases demand of the suction and cycle, when breaks fall due, and that a check-in is answered on command.",
            "Never invent a suction number, a break length, a round target or a minute that is not in the numbers above.",
          ].join("\n"),
        });

        const text = String(briefing ?? "").trim();
        if (!text) return Response.json({ skipped: true, reason: "empty" });

        await base44.entities.Session.update(session.id, { briefing: text });
        return Response.json({ briefing: text });
      },
    },
  },
});