/**
 * Returns today's date in YYYY-MM-DD (local timezone) for use as the default
 * value of a <input type="date"> "Date recorded" field.
 */
export function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converts a YYYY-MM-DD "date recorded" picker value into an ISO instant to send
 * as `createdAt` on a create request — or undefined when the user left the
 * default (today), so the server keeps using its own clock.
 *
 * For backdated entries the instant is anchored to noon UTC on the picked date
 * so date-range filtering and `toLocaleString()` display the same calendar day
 * regardless of viewer timezone.
 */
export function recordedAtToCreatedAt(pickedDate: string): string | undefined {
  if (!pickedDate) return undefined;
  if (pickedDate === todayInputValue()) return undefined;
  return new Date(`${pickedDate}T12:00:00Z`).toISOString();
}
