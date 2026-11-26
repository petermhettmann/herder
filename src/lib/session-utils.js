export const SUCTION_LEVELS = ["off", "very_low", "low", "mid", "high"];
export const SUCTION_LABEL = { off: "Off", very_low: "Very low", low: "Low", mid: "Mid", high: "High" };
export const CYCLE_LEVELS = ["slow", "normal", "fast"];
export const CYCLE_LABEL = { slow: "Slow", normal: "Normal", fast: "Fast" };
export const CONDITIONS = ["fine", "puffy", "tight_numb", "raw"];
export const CONDITION_LABEL = { fine: "Fine", puffy: "Puffy", tight_numb: "Tight / numb", raw: "Raw" };
export const PLAN_LABEL = { full: "Full", forced: "Forced", payoff: "Payoff", denial: "Denial" };
export const CONSTRICTION_LABEL = { traditional: "Traditional", constriction: "Constriction" };
export const TOYS = ["stretcher", "prostate_plug", "wand", "pocket_pussy", "sound", "cock_ring"];
export const TOY_LABEL = {
  stretcher: "Stretcher",
  prostate_plug: "Prostate plug",
  wand: "Wand",
  pocket_pussy: "Pocket pussy",
  sound: "Sound",
  cock_ring: "Cock ring",
};
export const RECEIVERS = ["front", "back", "mouth"];
export const RECEIVER_LABEL = { front: "Front", back: "Back", mouth: "Mouth" };
export const TOY_INSTRUCTION = {
  stretcher: "on before the receiver",
  prostate_plug: "insert at the swap",
};
// Used until the protocol record carries its own kit per plan type.
export const DEFAULT_KIT = {
  full: ["stretcher", "wand"],
  forced: ["stretcher", "prostate_plug", "wand"],
  payoff: ["wand"],
  denial: ["wand"],
};
export function kitFor(protocol, planType) {
  const list = protocol?.default_kit?.[planType];
  return Array.isArray(list) ? list.filter((toy) => TOYS.includes(toy)) : DEFAULT_KIT[planType] ?? [];
}
export const STATUS_LABEL = { planned: "Planned", active: "Active", break: "On break", ended: "Ended" };
export const CALL_LABEL = {
  continue: "Continue",
  hold: "Hold",
  drop: "Drop",
  break: "Break",
  end: "End",
  log_ruin: "Ruin logged",
  hold_then_stop: "Hold, then stop",
  dead_stop: "Dead stop",
  re_drive: "Re-drive",
  remove_stretcher: "Remove stretcher",
  swap_to_traditional: "Swap to traditional",
};
export const CALL_TEXT = {
  continue: "text-call-go",
  hold: "text-call-caution",
  drop: "text-call-caution",
  break: "text-call-stop",
  end: "text-call-stop",
  log_ruin: "text-call-caution",
  hold_then_stop: "text-call-stop",
  dead_stop: "text-call-stop",
  re_drive: "text-call-caution",
  remove_stretcher: "text-call-caution",
  swap_to_traditional: "text-call-caution",
};
export const CALL_DOT = {
  continue: "bg-call-go",
  hold: "bg-call-caution",
  drop: "bg-call-caution",
  break: "bg-call-stop",
  end: "bg-call-stop",
  log_ruin: "bg-call-caution",
  hold_then_stop: "bg-call-stop",
  dead_stop: "bg-call-stop",
  re_drive: "bg-call-caution",
  remove_stretcher: "bg-call-caution",
  swap_to_traditional: "bg-call-caution",
};

export function clock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Math.abs(totalSeconds)));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function elapsedSeconds(startTime, now = Date.now()) {
  const start = Date.parse(startTime);
  return Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
}

// The phase the session is in right now, with the minutes it has left.
export function phaseInfo(plan, elapsedMin) {
  if (!plan) return null;
  const cap = typeof plan.cap_min === "number" ? plan.cap_min : null;

  if (plan.warmup && elapsedMin < Number(plan.warmup.end_min ?? 0)) {
    const end = Number(plan.warmup.end_min);
    return {
      label: "Warmup",
      remaining: end - elapsedMin,
      suction: plan.warmup.suction,
      cycle: plan.warmup.cycle,
    };
  }

  if (plan.drive) {
    const end = plan.drive.end_min === "cap" ? cap : Number(plan.drive.end_min ?? cap);
    return {
      label: "Drive",
      remaining: Number.isFinite(end) ? end - elapsedMin : null,
      suction: plan.drive.suction,
      cycle: plan.drive.cycle,
    };
  }

  return null;
}

export function step(list, value, direction) {
  const index = list.indexOf(value);
  const base = index < 0 ? 0 : index;
  return list[Math.max(0, Math.min(list.length - 1, base + direction))];
}

export function minutesBetween(startTime, endTime) {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / 60000));
}

export function shortDate(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}