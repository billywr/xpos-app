import { useCallback, useEffect, useRef } from "react";
import { getIdleLogoutMs } from "@/config/idleLogout";

/**
 * Calls onIdle after the user has been inactive for idleMs.
 * Default idleMs comes from {@link getIdleLogoutMs} (`VITE_IDLE_LOGOUT_MINUTES`).
 * Scroll events do not bubble, so we use wheel + capture-phase window listeners and focusin.
 */
export function useIdleLogout(
  onIdle: () => void,
  idleMs: number = getIdleLogoutMs()
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

    const handleActivity = () => {
      if (document.visibilityState === "visible") {
        resetTimer();
      }
    };

    const captureOpts: AddEventListenerOptions = { capture: true, passive: true };
    const windowCaptureEvents = [
      "mousedown",
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
      "click",
      "focusin",
    ] as const;

    windowCaptureEvents.forEach((ev) => window.addEventListener(ev, handleActivity, captureOpts));
    document.addEventListener("visibilitychange", handleActivity);

    return () => {
      windowCaptureEvents.forEach((ev) => window.removeEventListener(ev, handleActivity, captureOpts));
      document.removeEventListener("visibilitychange", handleActivity);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [resetTimer]);
}
