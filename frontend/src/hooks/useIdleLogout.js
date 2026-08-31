import { useEffect, useRef, useCallback } from "react";

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "wheel"];

// How often (at most) a real activity event is allowed to trigger
// onActivity (used to persist the idle clock to localStorage) — no point
// writing to storage on every single mousemove.
const ACTIVITY_PERSIST_THROTTLE_MS = 30 * 1000;

// Logs the user out after a period of no interaction. This is a financial
// app that people often use on a shared family device, so leaving a session
// open indefinitely is a real risk — this closes it automatically instead.
// Fires a warning shortly before the actual logout, timed off the same
// reset so an idle-but-present user gets a chance to stay signed in.
//
// `initialRemainingMs` (optional): if a session was just restored from a
// previous page load (see utils/session.js), pass how much idle budget was
// actually left instead of letting the very first countdown start fresh —
// otherwise a page refresh would silently reset the clock to a full
// timeout, undermining the whole point of the timeout on a shared device.
// Only the very first timer start uses this; every real activity event
// after that resets to the full timeoutMs as usual.
//
// `onActivity` (optional): called (throttled) on real user interaction —
// used to keep a persisted "last active" timestamp in sync.
export function useIdleLogout({
  onLogout,
  onWarning,
  onActivity,
  timeoutMs = 20 * 60 * 1000,
  warnBeforeMs = 60 * 1000,
  initialRemainingMs,
}) {
  const warnTimer = useRef(null);
  const logoutTimer = useRef(null);
  const isFirstRun = useRef(true);
  const lastPersistedAt = useRef(0);

  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();

    const useResumeBudget = isFirstRun.current && initialRemainingMs != null;
    const effectiveTimeout = useResumeBudget ? Math.max(0, initialRemainingMs) : timeoutMs;
    isFirstRun.current = false;

    warnTimer.current = setTimeout(() => {
      onWarning?.();
    }, Math.max(0, effectiveTimeout - warnBeforeMs));
    logoutTimer.current = setTimeout(() => {
      onLogout();
    }, effectiveTimeout);
  }, [clearTimers, onLogout, onWarning, timeoutMs, warnBeforeMs, initialRemainingMs]);

  // Wraps resetTimers for real activity events specifically — also
  // (throttled) persists the "still active" timestamp so a later refresh
  // resumes the countdown accurately instead of restarting it.
  const handleActivity = useCallback(() => {
    resetTimers();
    const now = Date.now();
    if (now - lastPersistedAt.current > ACTIVITY_PERSIST_THROTTLE_MS) {
      lastPersistedAt.current = now;
      onActivity?.();
    }
  }, [resetTimers, onActivity]);

  useEffect(() => {
    resetTimers(); // initial mount — uses the resume budget if provided
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [resetTimers, clearTimers, handleActivity]);
}
