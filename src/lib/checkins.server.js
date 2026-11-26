// Server-only. Deterministic check-in rules for Herder. No AI, no external calls.

const SUCTION_LEVELS = ["off", "very_low", "low", "mid", "high"];
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

function severityFor(protocol, condition) {
  const map = protocol?.severity_map ?? {};
  const value = map[condition];
  return typeof value === "number" ? value : 0;
}

// thresholds carry the severity-to-break-length map as break_5: 1, break_8: 2, break_10: 3
function breakMinutesFor(severity, thresholds) {
  for (const [key, value] of Object.entries(thresholds ?? {})) {
    const match = /^break_(\d+)$/.exec(key);
    if (match && Number(value) === severity) return Number(match[1]);
  }
  return severity >= 3 ? 10 : severity === 2 ? 8 : 5;
}

function phaseFor(plan, elapsed) {
  if (!plan) return null;
  if (plan.warmup && elapsed < Number(plan.warmup.end_min ?? Number.POSITIVE_INFINITY)) {
    return { label: "warmup", suction: plan.warmup.suction, cycle: plan.warmup.cycle };
  }
  if (plan.drive) return { label: "drive", suction: plan.drive.suction, cycle: plan.drive.cycle };
  if (plan.ride) return { label: "ride", suction: plan.ride.suction, cycle: plan.ride.cycle };
  return null;
}

// Start minute of the unbroken run of high suction that ends at the latest check-in.
function highSuctionSince(checkIns, session) {
  const ordered = [...checkIns].sort((a, b) => (a.elapsed_min ?? 0) - (b.elapsed_min ?? 0));
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

export async function evaluateCheckInFor(base44, checkInId) {
  const checkIn = await base44.entities.CheckIn.get(checkInId);
  const session = await base44.entities.Session.get(checkIn.session);

  const protocolPage = await base44.entities.Protocol.filter({ active: true }, { limit: 1 });
  const protocol = (protocolPage.items ?? [])[0] ?? null;
  const thresholds = protocol?.thresholds ?? {};
  const plan = (protocol?.plan_tables ?? {})[session.plan_type] ?? {};

  const startMs = Date.parse(session.start_time);
  const elapsed = Number.isFinite(startMs)
    ? Math.max(0, Math.floor((Date.now() - startMs) / 60000))
    : checkIn.elapsed_min ?? 0;

  const checkInPage = await base44.entities.CheckIn.filter({ session: session.id }, { sort: "-created_date", limit: 200 });
  const checkIns = checkInPage.items ?? [];
  const previous = checkIns.find((item) => item.id !== checkIn.id) ?? null;

  const severity = Math.max(severityFor(protocol, checkIn.stated_condition), checkIn.inspector_severity ?? 0);
  const currentSuction = checkIn.suction ?? session.start_suction ?? "off";
  const currentCycle = checkIn.cycle ?? "normal";
  const roundsBefore = session.rounds_total ?? 0;

  const phase = phaseFor(plan, elapsed);
  const keep = { suction: currentSuction, cycle: currentCycle };
  const next = { suction: phase?.suction ?? currentSuction, cycle: phase?.cycle ?? currentCycle };

  const sinceLastRound = previous && typeof previous.elapsed_min === "number"
    ? elapsed - previous.elapsed_min
    : elapsed;
  const highSince = highSuctionSince(checkIns, session);
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
  } else if (roundsBefore === 0 && elapsed > (session.planned_build_min ?? 0)) {
    call = "hold";
    reason = `No rounds logged yet and ${elapsed} min elapsed, past the ${session.planned_build_min} min build.`;
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

  const round = typeof checkIn.round === "number" ? checkIn.round : roundsBefore + 1;
  const roundsAfter = Math.max(roundsBefore, round);

  await base44.entities.CheckIn.update(checkIn.id, {
    elapsed_min: elapsed,
    round,
    effective_severity: severity,
    call_issued: call,
    call_reason: reason,
    break_minutes: breakMinutes,
  });

  const sessionPatch = {
    rounds_total: roundsAfter,
    breaks_total: (session.breaks_total ?? 0) + (call === "break" ? 1 : 0),
    dry_rounds: (session.dry_rounds ?? 0) + (checkIn.is_dry ? 1 : 0),
    peak_elapsed_min: Math.max(session.peak_elapsed_min ?? 0, elapsed),
  };

  if (call === "break") {
    sessionPatch.status = "break";
    sessionPatch.break_ends = [
      ...(session.break_ends ?? []),
      new Date(Date.now() + breakMinutes * 60000).toISOString(),
    ];
  } else if (call === "end") {
    sessionPatch.status = "ended";
    sessionPatch.ended_at = new Date().toISOString();
  } else if (session.status === "break") {
    sessionPatch.status = "active";
  }

  await base44.entities.Session.update(session.id, sessionPatch);

  return {
    result: { call, reason, target_suction: target.suction, target_cycle: target.cycle },
    sessionId: session.id,
  };
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);

  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (Math.abs(rows[pivot][col]) < 1e-9) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    for (let index = col; index <= size; index += 1) rows[col][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      if (factor === 0) continue;
      for (let index = col; index <= size; index += 1) rows[row][index] -= factor * rows[col][index];
    }
  }

  return rows.map((row) => row[size]);
}

function leastSquares(points, width) {
  const matrix = Array.from({ length: width }, () => new Array(width).fill(0));
  const vector = new Array(width).fill(0);
  for (const point of points) {
    for (let row = 0; row < width; row += 1) {
      for (let col = 0; col < width; col += 1) matrix[row][col] += point.x[row] * point.x[col];
      vector[row] += point.x[row] * point.y;
    }
  }
  return solveLinearSystem(matrix, vector);
}

// Linear fit of severity over elapsed minutes, round interval and suction, projected to severity 3.
export async function projectEndFor(base44, sessionId) {
  const page = await base44.entities.CheckIn.filter({ session: sessionId }, { sort: "created_date", limit: 200 });
  const scored = (page.items ?? []).filter((item) => typeof item.effective_severity === "number");
  if (scored.length < 2) return null;

  const ordered = [...scored].sort((a, b) => (a.elapsed_min ?? 0) - (b.elapsed_min ?? 0));
  const intervals = ordered.map((item, index) =>
    index === 0 ? item.elapsed_min ?? 0 : (item.elapsed_min ?? 0) - (ordered[index - 1].elapsed_min ?? 0)
  );
  const meanInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const lastSuction = suctionIndex(ordered[ordered.length - 1].suction);
  const points = ordered.map((item, index) => ({
    x: [1, item.elapsed_min ?? 0, Math.max(0, intervals[index]), suctionIndex(item.suction)],
    y: item.effective_severity,
  }));

  let slope = null;
  let intercept = null;

  const fit = leastSquares(points, 4);
  if (fit && Math.abs(fit[1]) > 1e-9) {
    slope = fit[1];
    intercept = fit[0] + fit[2] * meanInterval + fit[3] * lastSuction;
  } else {
    const simple = leastSquares(points.map((point) => ({ x: [1, point.x[1]], y: point.y })), 2);
    if (simple && Math.abs(simple[1]) > 1e-9) {
      slope = simple[1];
      intercept = simple[0];
    }
  }

  if (slope === null || slope <= 0 || !Number.isFinite(intercept)) return null;

  const lastElapsed = ordered[ordered.length - 1].elapsed_min ?? 0;
  const projected = Math.max(lastElapsed, Math.round((3 - intercept) / slope));
  if (!Number.isFinite(projected)) return null;

  await base44.entities.Session.update(sessionId, { projected_end_min: projected });
  return projected;
}

// Keeps post-response work alive when the runtime supports it.
export async function runInBackground(promise) {
  const guarded = promise.catch(() => null);
  try {
    const runtime = await import("base44:runtime");
    if (typeof runtime?.waitUntil === "function") {
      runtime.waitUntil(guarded);
      return;
    }
  } catch {
    // runtime hook not available here
  }
  guarded.catch(() => null);
}