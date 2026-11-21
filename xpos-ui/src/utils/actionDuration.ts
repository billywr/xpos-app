/**
 * Global tracker for measuring action and mutation durations across the application.
 * Used to automatically attach exact completion time to toast notifications for delete and mutation actions.
 */

let activeMutationCount = 0;
let mutationStartTime: number | null = null;
let lastFormattedDuration: string | null = null;
let lastEndTime: number | null = null;

/**
 * Intelligent duration formatter:
 * - If under 1000ms: displays in milliseconds (e.g. "40ms", "450ms")
 * - If 1000ms or higher: displays in seconds (e.g. "1s", "1.2s", "15.4s")
 */
export function formatDurationMs(ms: number): string {
  if (ms < 1000) {
    const rounded = Math.round(ms);
    return rounded <= 0 ? "1ms" : `${rounded}ms`;
  }
  const sec = ms / 1000;
  if (sec >= 10) {
    return `${sec.toFixed(1)}s`;
  }
  return `${parseFloat(sec.toFixed(2))}s`;
}

export function recordMutationStart(): void {
  if (activeMutationCount === 0) {
    mutationStartTime = performance.now();
  }
  activeMutationCount++;
}

export function recordMutationEnd(): void {
  activeMutationCount = Math.max(0, activeMutationCount - 1);
  if (activeMutationCount === 0 && mutationStartTime != null) {
    const elapsedMs = performance.now() - mutationStartTime;
    lastFormattedDuration = formatDurationMs(elapsedMs);
    lastEndTime = Date.now();
    mutationStartTime = null;
  }
}

export function recordActionDurationMs(ms: number): void {
  lastFormattedDuration = formatDurationMs(ms);
  lastEndTime = Date.now();
}

export function getLastActionDuration(): string | null {
  if (!lastFormattedDuration || !lastEndTime) return null;
  // Action duration remains valid for up to 5 seconds after completion
  if (Date.now() - lastEndTime < 5000) {
    return lastFormattedDuration;
  }
  return null;
}

export function clearLastActionDuration(): void {
  lastFormattedDuration = null;
  lastEndTime = null;
  activeMutationCount = 0;
  mutationStartTime = null;
}
