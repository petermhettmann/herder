// Server-only. Deterministic edge rules for denial sessions. No AI, no external calls.
import { elapsedSeconds } from "@/lib/session-utils";

const EDGE_HOLD_SEC = 10;
// The wand the protocol allows per edge, in order. The seventh edge is the last.
const WAND_PROGRESSION = [2, 2, 2, 2, 3, 3, 3];

export async function evaluateEdgeFor(base44, checkInId) {
  const checkIn = await base44.entities.CheckIn.get(checkInId);
  const session = await base44.entities.Session.get(checkIn.session);

  const protocolPage = await base44.entities.Protocol.filter({ active: true }, { limit: 1 });
  const protocol = (protocolPage.items ?? [])[0] ?? {};

  const baseTarget = protocol.denial_target ?? 7;
  const capMin = protocol.denial_cap_min ?? 30;
  const penaltySec = protocol.denial_missed_count_penalty_sec ?? 30;

  const page = await base44.entities.CheckIn.filter({ session: session.id }, { sort: "created_date", limit: 200 });
  const ordered = page.items ?? [];
  const at = ordered.findIndex((item) => item.id === checkIn.id);
  const previous = at > 0 ? ordered[at - 1] : null;

  // The edge counts on from the edge before it, so a repeated evaluation lands on the same number.
  const edgeIndex = Math.max(checkIn.edge_index ?? 0, (previous?.edge_index ?? 0) + 1);
  // Every ruin takes one edge off this session's target.
  const target = Math.max(1, baseTarget - ordered.filter((item) => item.ruined).length);
  const wand = checkIn.wand_intensity ?? previous?.wand_intensity ?? WAND_PROGRESSION[0];
  const elapsedMin = Math.floor(elapsedSeconds(session.start_time) / 60);

  // Every edge holds its ten count. A missed count on the edge before adds the penalty.
  const secondsToHold = EDGE_HOLD_SEC + (previous?.missed_count ? penaltySec : 0);

  let call;
  let storedCall;
  let targetWand = wand;
  let reason;

  if (elapsedMin >= capMin) {
    call = "stop";
    storedCall = "stop";
    reason = `Cap reached at ${elapsedMin} min. Stop.`;
  } else if (checkIn.ruined) {
    storedCall = "log_ruin";
    if (edgeIndex >= 2) {
      call = "continue";
      targetWand = Math.max(1, wand - 1);
      reason = `Ruin logged. Target now ${target}. Wand back to ${targetWand}.`;
    } else {
      call = "stop";
      reason = "Ruin on the first edge. Stop.";
    }
  } else if (edgeIndex >= target) {
    call = "hold_then_stop";
    storedCall = "hold_then_stop";
    reason = `Edge ${edgeIndex} of ${target}. Hold, then stop.`;
  } else {
    call = "continue";
    storedCall = "continue";
    targetWand = WAND_PROGRESSION[Math.min(edgeIndex, WAND_PROGRESSION.length) - 1];
    reason = `Edge ${edgeIndex} of ${target}. Wand ${targetWand}.`;
  }

  await base44.entities.CheckIn.update(checkIn.id, {
    edge_index: edgeIndex,
    call_issued: storedCall,
    call_reason: reason,
  });
  await base44.entities.Session.update(session.id, { rounds_total: edgeIndex });

  return {
    call,
    target_wand: targetWand,
    seconds_to_hold: secondsToHold,
    target,
    edge_index: edgeIndex,
  };
}