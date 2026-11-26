// Pure precedence table for a check-in call. No storage, no server, no AI: the same
// function decides the call on the server and previews it in the capture sheet, so the
// verdict on screen cannot drift from the verdict written to the record.
import { SUCTION_LEVELS } from "@/lib/session-utils";

const DROP_FACTOR = 0.6; // a 40% cut from the current suction index

export function suctionIndex(level) {
  const index = SUCTION_LEVELS.indexOf(level);
  return index < 0 ? 0 : index;
}

function levelFromIndex(index) {
  return SUCTION_LEVELS[Math.max(0, Math.min(SUCTION_LEVELS.length - 1, index))];
}

function dropSuction(level) {
  return levelFromIndex(Math.floor(suctionIndex(level) * DROP_FACTOR));
}

export function severityFor(protocol, condition) {
  const value = (protocol?.severity_map ?? {})[condition];
  return typeof value === "number" ? value : 0;
}

// thresholds carry the severity-to-break-length map as break_5: 1, break_8: 2, break_10: 3
export function breakMinutesFor(severity, thresholds) {
  for (const [key, value] of Object.entries(thresholds ?? {})) {
    const match = /^break_(\d+)$/.exec(key);
    if (match && Number(value) === severity) return Number(match[1]);
  }
  return severity >= 3 ? 10 : severity === 2 ? 8 : 5;
}

export function planPhase(plan, elapsed) {
  if (!plan) return null;
  if (plan.warmup && elapsed < Number(plan.warmup.end_min ?? Number.POSITIVE_INFINITY)) {
    return { label: "warmup", suction: plan.warmup.suction, cycle: plan.warmup.cycle };
  }
  if (plan.drive) return { label: "drive", suction: plan.drive.suction, cycle: plan.drive.cycle };
  if (plan.ride) return { label: "ride", suction: plan.ride.suction, cycle: plan.ride.cycle };
  return null;
}

// Start minute of the unbroken run of high suction that ends at the latest check-in.
function highSuctionSince(entries, session) {
  const ordered = [...entries].sort((a, b) => (a.elapsed_min ?? 0) - (b.elapsed_min ?? 0));
  let since = session?.start_suction === "high" ? 0 : null;
  for (const item of ordered) {
    if (item.suction === "high") {
      if (since === null) since = item.elapsed_min ?? 0;
    } else {
      since = null;
    }
  }
  return since;
}

// history: earlier check-ins, newest first. draft: the check-in being judged.
export function computeCall({ protocol, session, history = [], draft = {}, now = Date.now() }) {
  const thresholds = protocol?.thresholds ?? {};
  const plan = (protocol?.plan_tables ?? {})[session?.plan_type] ?? {};

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
  const currentSuction = entry.suction ?? session?.start_suction ?? "off";
  const currentCycle = entry.cycle ?? "normal";
  const roundsBefore = session?.rounds_total ?? 0;

  const phase = planPhase(plan, elapsed);
  const keep = { suction: currentSuction, cycle: currentCycle };
  const next = { suction: phase?.suction ?? currentSuction, cycle: phase?.cycle ?? currentCycle };

  const sinceLastRound = previous && typeof previous.elapsed_min === "number"
    ? elapsed - previous.elapsed_min
    : elapsed;
  const highSince = highSuctionSince([...history, entry], session);
  const highFor = highSince === null ? 0 : elapsed - highSince;
  const highLimit = thresholds.high_suction_max_min ?? 20;

  let call = "continue";
  let reason = "";
  let target = next;
  let breakMinutes = 0;

  if (severity === 3 && elapsed > (thresholds.end_hard_min ?? 150)) {
    call = "end";
    reason = `Severity 3 at ${elapsed} min, past the ${thresholds.end_hard_min ?? 150} min hard limit.`;
    target = keep;
  } else if (severity === 3) {
    breakMinutes = breakMinutesFor(3, thresholds);
    call = "break";
    reason = `Severity 3. Break ${breakMinutes} min.`;
    target = keep;
  } else if (severity === 2) {
    breakMinutes = breakMinutesFor(2, thresholds);
    call = "break";
    reason = `Severity 2. Break ${breakMinutes} min.`;
    target = keep;
  } else if (severity === 1 && previous?.effective_severity === 1 && thresholds.two_consecutive_grade1_ends !== false) {
    call = "end";
    reason = `Two check-ins in a row at severity 1. End the session.`;
    target = keep;
  } else if (severity === 1) {
    breakMinutes = breakMinutesFor(1, thresholds);
    call = "break";
    reason = `Severity 1. Break ${breakMinutes} min.`;
    target = keep;
  } else if (sinceLastRound < 1.5) {
    call = "drop";
    reason = `Only ${sinceLastRound.toFixed(1)} min since the last round. Drop suction 40% and slow the cycle.`;
    target = { suction: dropSuction(currentSuction), cycle: "slow" };
  } else if (roundsBefore === 0 && elapsed > (session?.planned_build_min ?? 0)) {
    call = "hold";
    reason = `No rounds logged yet and ${elapsed} min elapsed, past the ${session?.planned_build_min ?? 0} min build.`;
    target = keep;
  } else if (currentSuction === "high" && highFor > highLimit) {
    call = "drop";
    reason = `Suction has been high for ${highFor} min, over the ${highLimit} min limit. Drop to mid.`;
    target = { suction: "mid", cycle: currentCycle };
  } else if (typeof plan.cap_min === "number" && elapsed >= plan.cap_min) {
    call = "end";
    reason = `Elapsed ${elapsed} min reached the ${plan.cap_min} min cap.`;
    target = keep;
  } else if (typeof plan.max_rounds === "number" && roundsBefore >= plan.max_rounds) {
    call = "end";
    reason = `${roundsBefore} rounds reached the ${plan.max_rounds} round cap.`;
    target = keep;
  } else {
    call = "continue";
    reason = phase
      ? `Continue. ${phase.label} targets: ${target.suction}, ${target.cycle}.`
      : `Continue.`;
    target = next;
  }

  const round = typeof entry.round === "number" ? entry.round : roundsBefore + 1;

  return {
    call,
    reason,
    target_suction: target.suction,
    target_cycle: target.cycle,
    break_minutes: breakMinutes,
    severity,
    elapsed,
    round,
  };
}