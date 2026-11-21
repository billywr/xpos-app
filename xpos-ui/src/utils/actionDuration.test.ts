import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordMutationStart,
  recordMutationEnd,
  recordActionDurationMs,
  getLastActionDuration,
  clearLastActionDuration,
  formatDurationMs,
} from "./actionDuration";

describe("actionDuration", () => {
  beforeEach(() => {
    clearLastActionDuration();
  });

  it("returns null when no action has been recorded", () => {
    expect(getLastActionDuration()).toBeNull();
  });

  describe("formatDurationMs intelligent formatting", () => {
    it("formats durations under 1000ms in milliseconds (ms)", () => {
      expect(formatDurationMs(40)).toBe("40ms");
      expect(formatDurationMs(450)).toBe("450ms");
      expect(formatDurationMs(999)).toBe("999ms");
      expect(formatDurationMs(0.4)).toBe("1ms");
    });

    it("formats durations 1000ms and above in seconds (s)", () => {
      expect(formatDurationMs(1000)).toBe("1s");
      expect(formatDurationMs(1200)).toBe("1.2s");
      expect(formatDurationMs(1250)).toBe("1.25s");
      expect(formatDurationMs(10500)).toBe("10.5s");
      expect(formatDurationMs(31820)).toBe("31.8s");
    });
  });

  it("records explicit action duration under 1000ms in ms", () => {
    recordActionDurationMs(450);
    expect(getLastActionDuration()).toBe("450ms");
  });

  it("records explicit action duration 1000ms or higher in s", () => {
    recordActionDurationMs(31820);
    expect(getLastActionDuration()).toBe("31.8s");
  });

  it("tracks mutation start and end using performance.now", () => {
    recordMutationStart();
    recordMutationEnd();
    const duration = getLastActionDuration();
    expect(duration).toMatch(/^\d+(\.\d+)?(s|ms)$/);
  });

  it("expires duration after 5 seconds", () => {
    vi.useFakeTimers();
    recordActionDurationMs(300);
    expect(getLastActionDuration()).toBe("300ms");

    vi.advanceTimersByTime(5100);
    expect(getLastActionDuration()).toBeNull();
    vi.useRealTimers();
  });
});
