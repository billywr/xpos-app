/**
 * Generate a request ID for API calls. Backend echoes it in responses and errors.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
