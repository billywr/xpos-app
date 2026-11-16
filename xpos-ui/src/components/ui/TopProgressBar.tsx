import { useEffect, useState } from "react";
import { useNetworkActivity } from "@/utils/networkActivity";
import { cn } from "@/utils/cn";

/**
 * System-wide top progress indicator.
 * Displays a non-intrusive, sleek progress bar at the very top of the browser viewport
 * whenever any network or backend operation is active across the application.
 */
export function TopProgressBar() {
  const isBusy = useNetworkActivity();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isBusy) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 350);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isBusy, visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed left-0 right-0 top-0 z-[9999] h-0.5 overflow-hidden bg-transparent transition-opacity duration-300 sm:h-1",
        closing ? "opacity-0" : "opacity-100"
      )}
    >
      <div className="relative h-full w-full bg-primary-100/40 dark:bg-primary-950/40">
        <div className="animate-indeterminate-1 rounded-full bg-gradient-to-r from-sky-400 via-primary-500 to-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
        <div className="animate-indeterminate-2 rounded-full bg-gradient-to-r from-sky-300 via-primary-400 to-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
      </div>
    </div>
  );
}
