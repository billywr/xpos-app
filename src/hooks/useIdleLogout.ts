import { useEffect, useRef } from "react";
import { getIdleLogoutMs } from "@/config/idleLogout";

/**
 * Calls `onIdle` after the user has been inactive for `idleMs`.
 *
 * Default idleMs comes from {@link getIdleLogoutMs} (`VITE_IDLE_LOGOUT_MINUTES`).
 *
 * How it works:
 * - Records `lastActivityTs` on every user interaction.
 * - Uses `setTimeout` to schedule a check, but on mobile browsers timers are
 *   throttled / batched when the tab is backgrounded, so `setTimeout` alone
 *   is unreliable for long durations.
 * - On `visibilitychange` → "visible" (user returns to tab), we re-check
 *   elapsed time since last activity and fire immediately if the idle window
 *   has already passed. This prevents the "logs me out while I'm using it"
 *   problem: the logout only triggers after the *real* idle time has elapsed.
 * - Listens in capture phase so events inside overflow-scroll containers
 *   (tables, modals, sidebars) are caught even if they don't bubble.
 */
export function useIdleLogout(
  onIdle: () => void,
  idleMs: number = getIdleLogoutMs(),
) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const idleMsRef = useRef(idleMs);
  idleMsRef.current = idleMs;

  useEffect(() => {
    let lastActivityTs = Date.now();
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    /** Schedule (or reschedule) the idle check. */
    function scheduleCheck() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (disposed) return;

      const elapsed = Date.now() - lastActivityTs;
      const remaining = idleMsRef.current - elapsed;

      if (remaining <= 0) {
        onIdleRef.current();
        return;
      }

      timerId = setTimeout(() => {
        timerId = null;
        // Re-check actual elapsed time — timer may have fired late (throttled).
        const now = Date.now();
        if (now - lastActivityTs >= idleMsRef.current) {
          onIdleRef.current();
        } else {
          // Not idle yet — reschedule for the true remaining time.
          scheduleCheck();
        }
      }, remaining);
    }

    /** Mark the user as active and restart the idle countdown. */
    function onActivity() {
      lastActivityTs = Date.now();
      scheduleCheck();
    }

    /**
     * When the tab becomes visible again, check real elapsed time.
     * This is the key fix: on mobile, the setTimeout callback may have been
     * delayed arbitrarily. By checking here we get an accurate reading.
     */
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastActivityTs;
        if (elapsed >= idleMsRef.current) {
          onIdleRef.current();
        } else {
          // User came back before idle expired — reschedule with correct remaining time.
          scheduleCheck();
        }
      }
    }

    // Start the initial countdown.
    scheduleCheck();

    // Capture-phase listeners catch events inside overflow containers / iframes.
    const captureOpts: AddEventListenerOptions = { capture: true, passive: true };
    const activityEvents = [
      "mousedown",
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
      "click",
      "focusin",
      "input",
    ] as const;

    activityEvents.forEach((ev) =>
      window.addEventListener(ev, onActivity, captureOpts),
    );
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, onActivity, captureOpts),
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };
  }, [idleMs]);
}
