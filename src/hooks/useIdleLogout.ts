import { useCallback, useEffect, useRef } from "react";

const DEFAULT_IDLE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Calls onIdle after the user has been inactive for idleMs.
 * Resets the timer on visibility change (tab focus) and on user events:
 * mousedown, keydown, scroll, touchstart.
 */
export function useIdleLogout(
  onIdle: () => void,
  idleMs: number = DEFAULT_IDLE_MS
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onIdleRef.current();
    }, idleMs);
  }, [idleMs]);

  useEffect(() => {
    resetTimer();

    const events = ["mousedown", "keydown", "scroll", "touchstart", "visibilitychange"];
    const handleActivity = () => {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    };

    events.forEach((ev) => document.addEventListener(ev, handleActivity));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, handleActivity));
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [resetTimer]);
}
