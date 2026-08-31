// Persists the logged-in session to localStorage so a page refresh (or the
// browser reloading a backgrounded tab, common on low-memory Android)
// doesn't drop the user straight back to the login screen.
//
// This intentionally does NOT just resume with a fresh idle-timeout clock —
// this app already auto-logs-out after 20 minutes of no interaction because
// it's often used on a shared family device (see hooks/useIdleLogout.js). If
// a refresh reset that clock to a full 20 minutes every time, someone could
// stay signed in indefinitely on a shared device just by reloading the page
// occasionally, which would defeat the whole point of the timeout. So this
// file tracks the *real* last-activity timestamp alongside the session, and
// on load hands back how much idle budget is actually left — the caller
// (useIdleLogout, wired up in Layout.jsx) resumes the countdown from there
// instead of restarting it.

const SESSION_KEY = "committee_app_session";

// Must match the timeoutMs used in Layout.jsx's useIdleLogout call — this
// is only used here to decide whether a restored session has already
// idle-expired (e.g. the tab was closed and reopened 25 minutes later).
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * @returns {{ session: object, remainingMs: number } | null}
 *   null if there's no valid, still-active session to restore.
 */
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.session || !parsed.lastActivityAt) return null;

    const elapsed = Date.now() - parsed.lastActivityAt;
    if (elapsed >= IDLE_TIMEOUT_MS) {
      // Already idle-expired while the tab was closed/refreshed — don't
      // silently resume; require login again, same as if the in-app idle
      // timer had fired.
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return { session: parsed.session, remainingMs: IDLE_TIMEOUT_MS - elapsed };
  } catch {
    // localStorage unavailable (private mode, storage disabled, corrupted
    // JSON, etc.) — just don't restore anything; login screen as before.
    return null;
  }
}

/**
 * Call right after login/onboarding completes, and whenever the session
 * object itself changes (e.g. committee settings updated).
 */
export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ session, lastActivityAt: Date.now() }));
  } catch {
    // Storage write failed — the app still works fine for this tab, it
    // just won't survive a refresh. Not worth surfacing to the user.
  }
}

/**
 * Bumps the stored last-activity timestamp without touching the session
 * payload — called (throttled) on real user interaction, wired up via
 * useIdleLogout's onActivity so the persisted clock stays in sync with
 * the in-memory idle timer.
 */
export function touchSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.session) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ session: parsed.session, lastActivityAt: Date.now() }));
  } catch {
    // ignore — same reasoning as saveSession
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
