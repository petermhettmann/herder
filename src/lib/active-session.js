// The running session is remembered on the device, so a reload or a discarded tab
// restores the timer from the record's start time before anything is fetched.
const KEY = "herder.active_session";

export function saveActiveSession(session) {
  if (!session?.id || !session.start_time) return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        id: session.id,
        start_time: session.start_time,
        status: session.status ?? "active",
      }),
    );
  } catch {
    // Storage refused; the record still holds the timer.
  }
}

export function loadActiveSession() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id && parsed?.start_time ? parsed : null;
  } catch {
    return null;
  }
}

export function clearActiveSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}