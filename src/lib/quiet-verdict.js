// Pure precedence table for a quiet-kit masturbation check-in. No storage, no server, no AI:
// the same function decides the call on the server and previews it in the capture sheet, so
// the verdict on screen cannot drift from the verdict written to the record.
import { breakMinutesFor, severityFor } from "@/lib/verdict";

const DROP_FACTOR = 0.5;
const MIN_EDGE_GAP_MIN = 2.5;
const MIN_HOLD_SEC = 45;
const MAX_HOLD_SEC = 150;
const INTENSITY_CEILING = 5;
const CEILING_MAX_MIN = 8;

export function dropIntensity(value) {
  return Math.max(1, Math.round((Number(value) || 1) * DROP_FACTOR));
}

export function computeQuietCall({ protocol, session, history = [], draft = {}, now = Date.now() }) {
  const thresholds = protocol?.thresholds ?? {};
  const plan = protocol?.quiet_plan ?? {};

  const startMs = Date.parse(session?.start_time ?? "");
  const elapsed = Number.isFinite(startMs)
    ? Math.max(0, Math.floor((now - startMs) / 60000))
    : draft.elapsed_min ?? 0;

  const entry = {
    ...draft,
    elapsed_min: typeof draft.elapsed_min === "number" ? draft.elapsed_min : elapsed,
  };
  const previous = history[0] ?? null;

  const severity = Math.max(severityFor(protocol, entry.stated_condition), entry.inspector_severity ?? 0);
  const intensity = Number(entry.intensity ?? session?.start_intensity ?? 1);
  const pace = entry.pace ?? "slow";
  const edgesBefore = session?.edges_total ?? 0;
  const target = Math.min(12, Math.max(1, session?.target_edges ?? plan.edge_target ?? 7));
  const capMin = Number(plan.cap_min ?? 30);

  const sinceLastEdge = previous && typeof previous.elapsed_min === "number"
    ? elapsed - previous.elapsed_min
    : elapsed;
  const heldSec = Number(entry.held_sec ?? 0);

  let call = "continue";
  let reason = "";
  let targetIntensity = intensity;
  let targetPace = pace;
  let breakMinutes = 0;

  if (severity === 3 && elapsed > (thresholds.end_hard_min ?? 150)) {
    call = "end";
    reason = `Grade 3 at ${elapsed} min, past the hard limit.`;
  } else if (severity === 3) {
    breakMinutes = breakMinutesFor(3, thresholds);
    call = "break";
    reason = `Grade 3. Off it for ${breakMinutes} min.`;
  } else if (severity === 2) {
    breakMinutes = breakMinutesFor(2, thresholds);
    call = "break";
    reason = `Grade 2. Off it for ${breakMinutes} min.`;
  } else if (severity === 1 && previous?.effective_severity === 1) {
    call = "end";
    reason = "Two grade 1s running. Done.";
  } else if (severity === 1) {
    breakMinutes = breakMinutesFor(1, thresholds);
    call = "break";
    reason = `Grade 1. Off it for ${breakMinutes} min.`;
  } else if (entry.finished) {
    call = "end";
    reason = "Finished. Hands off.";
  } else if (edgesBefore + 1 >= target) {
    call = "hold_then_stop";
    reason = `Edge ${edgesBefore + 1} of ${target}. Hold, then stop.`;
  } else if (heldSec > 0 && heldSec < MIN_HOLD_SEC) {
    call = "hold_longer";
    reason = `Held ${heldSec} s. Get it to ${MIN_HOLD_SEC}.`;
  } else if (heldSec > MAX_HOLD_SEC) {
    targetIntensity = dropIntensity(intensity);
    targetPace = "slow";
    call = "drop";
    reason = `Held ${heldSec} s. Down to ${targetIntensity}.`;
  } else if (sinceLastEdge < MIN_EDGE_GAP_MIN) {
    targetIntensity = dropIntensity(intensity);
    targetPace = "slow";
    call = "drop";
    reason = `${sinceLastEdge.toFixed(1)} min since the last edge. Down to ${targetIntensity}.`;
  } else if (intensity >= INTENSITY_CEILING && elapsed > CEILING_MAX_MIN) {
    targetIntensity = 3;
    call = "drop";
    reason = `Intensity ${INTENSITY_CEILING} past ${CEILING_MAX_MIN} min. Down to 3.`;
  } else if (elapsed >= capMin) {
    call = "end";
    reason = `${elapsed} min reached the ${capMin} min cap.`;
  } else {
    call = "continue";
    reason = `Continue. Intensity ${intensity}, ${pace}.`;
  }

  const advancesEdge = entry.finished
    ? true
    : !["break", "end", "hold_longer", "drop"].includes(call);
  const edge = advancesEdge
    ? (typeof entry.edge_index === "number" ? entry.edge_index : edgesBefore + 1)
    : edgesBefore;

  return {
    call,
    reason,
    advances_edge: advancesEdge,
    target_intensity: targetIntensity,
    target_pace: targetPace,
    break_minutes: breakMinutes,
    severity,
    elapsed,
    edge,
    target,
  };
}