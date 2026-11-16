/**
 * True if the ISO instant falls on the same local calendar day as `reference` (default: now).
 */
export function isSameLocalCalendarDay(iso: string, reference: Date = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth() &&
    d.getDate() === reference.getDate()
  );
}
