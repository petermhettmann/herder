// Server-only. Deterministic quiet-kit check-in rules. No AI, no external calls.
// The precedence table itself lives in @/lib/quiet-verdict, so the capture sheet previews
// exactly the call this file writes.
import { computeQuietCall } from "@/lib/quiet-verdict";

export async function evaluateQuietCheckInFor(base44, checkInId) {
  const checkIn = await base44.entities.CheckIn.get(checkInId);
  const session = await base44.entities.Session.get(checkIn.session);

  const protocolPage = await base44.entities.Protocol.filter({ active: true }, { limit: 1 });
  const protocol = (protocolPage.items ?? [])[0] ?? null;

  const checkInPage = await base44.entities.CheckIn.filter({ session: session.id }, { sort: "-created_date", limit: 200 });
  const history = (checkInPage.items ?? []).filter((item) => item.id !== checkIn.id);

  const verdict = computeQuietCall({ protocol, session, history, draft: checkIn, now: Date.now() });

  await base44.entities.CheckIn.update(checkIn.id, {
    elapsed_min: verdict.elapsed,
    edge_index: verdict.edge,
    effective_severity: verdict.severity,
    call_issued: verdict.call,
    call_reason: verdict.reason,
    break_minutes: verdict.break_minutes,
    unsynced: false,
  });

  const sessionPatch = {
    // Only an edge that was taken moves the count; a break or a hold writes it back unchanged.
    edges_total: verdict.advances_edge ? verdict.edge : session.edges_total ?? 0,
    breaks_total: (session.breaks_total ?? 0) + (verdict.call === "break" ? 1 : 0),
    dry_rounds: (session.dry_rounds ?? 0) + (checkIn.is_dry ? 1 : 0),
    peak_elapsed_min: Math.max(session.peak_elapsed_min ?? 0, verdict.elapsed),
  };

  if (verdict.call === "break") {
    sessionPatch.status = "break";
    sessionPatch.break_ends = [
      ...(session.break_ends ?? []),
      new Date(Date.now() + verdict.break_minutes * 60000).toISOString(),
    ];
  } else if (verdict.call === "end") {
    sessionPatch.status = "ended";
    sessionPatch.ended_at = new Date().toISOString();
  } else if (session.status === "break") {
    sessionPatch.status = "active";
  }

  await base44.entities.Session.update(session.id, sessionPatch);

  const result = {
    call: verdict.call,
    reason: verdict.reason,
    target_intensity: verdict.target_intensity,
    target_pace: verdict.target_pace,
    break_minutes: verdict.break_minutes,
    edge: verdict.edge,
    target: verdict.target,
  };

  return { result, sessionId: session.id };
}