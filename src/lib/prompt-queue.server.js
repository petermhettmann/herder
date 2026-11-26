// Server-only. The prompt queue: one pending prompt per session, answered by the next check-in.
// Shared by the workflow routes so the silence, round, resume and follow-up rules agree.

export function workflowBase44(context) {
  if (context.user?.role !== "admin") return null;
  return context.getBase44().asServiceRole;
}

export async function activeProtocol(base44) {
  const page = await base44.entities.Protocol.filter({ active: true }, { limit: 1 });
  return (page.items ?? [])[0] ?? null;
}

export async function latestCheckIn(base44, sessionId) {
  const page = await base44.entities.CheckIn.filter({ session: sessionId }, { sort: "-created_date", limit: 1 });
  return (page.items ?? [])[0] ?? null;
}

export async function pendingPrompt(base44, sessionId) {
  const page = await base44.entities.Prompt.filter(
    { session: sessionId, status: "pending" },
    { sort: "-created_date", limit: 1 },
  );
  return (page.items ?? [])[0] ?? null;
}

// A check-in newer than the pending prompt answers it.
async function settle(base44, prompt, lastCheckIn) {
  if (!prompt || !lastCheckIn) return prompt;
  const answered = Date.parse(lastCheckIn.created_date) > Date.parse(prompt.created_date);
  if (!answered) return prompt;
  await base44.entities.Prompt.update(prompt.id, { status: "done" });
  return null;
}

// Raises a prompt unless one is already pending. A repeatGapMin refreshes the pending prompt
// in place once it has been ignored that long, instead of stacking a second one.
export async function raisePrompt(base44, session, kind, text, { lastCheckIn = null, repeatGapMin = 0 } = {}) {
  let pending = await pendingPrompt(base44, session.id);
  pending = await settle(base44, pending, lastCheckIn);

  if (pending) {
    if (repeatGapMin > 0 && pending.kind === kind) {
      const ageMin = (Date.now() - Date.parse(pending.created_date)) / 60000;
      if (ageMin >= repeatGapMin) {
        await base44.entities.Prompt.update(pending.id, { text, due_at: new Date().toISOString() });
        return "repeated";
      }
    }
    return "held";
  }

  await base44.entities.Prompt.create({
    session: session.id,
    kind,
    text,
    status: "pending",
    due_at: new Date().toISOString(),
  });
  return "raised";
}

export function minutesSince(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? (Date.now() - parsed) / 60000 : Number.POSITIVE_INFINITY;
}