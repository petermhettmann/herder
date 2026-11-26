// Server-only. Deterministic check-in rules for Herder. No AI, no external calls.
// The precedence table itself lives in @/lib/verdict, so the capture sheet previews
// exactly the call this file writes.
import { computeCall, suctionIndex } from "@/lib/verdict";

export async function evaluateCheckInFor(base44, checkInId) {
  const checkIn = await base44.entities.CheckIn.get(checkInId);
  const session = await base44.entities.Session.get(checkIn.session);

  const protocolPage = await base44.entities.Protocol.filter({ active: true }, { limit: 1 });
  const protocol = (protocolPage.items ?? [])[0] ?? null;

  const checkInPage = await base44.entities.CheckIn.filter({ session: session.id }, { sort: "-created_date", limit: 200 });
  const history = (checkInPage.items ?? []).filter((item) => item.id !== checkIn.id);

  const verdict = computeCall({ protocol, session, history, draft: checkIn, now: Date.now() });
  const roundsAfter = Math.max(session.rounds_total ?? 0, verdict.round);

  await base44.entities.CheckIn.update(checkIn.id, {
    elapsed_min: verdict.elapsed,
    round: verdict.round,
    effective_severity: verdict.severity,
    call_issued: verdict.call,
    call_reason: verdict.reason,
    break_minutes: verdict.break_minutes,
    unsynced: false,
  });

  const sessionPatch = {
    rounds_total: roundsAfter,
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

  return {
    result: {
      call: verdict.call,
      reason: verdict.reason,
      target_suction: verdict.target_suction,
      target_cycle: verdict.target_cycle,
    },
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