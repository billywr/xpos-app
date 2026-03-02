/**
 * Decode JWT payload without verification (UI only; backend validates).
 * Returns payload object or null if invalid.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getSubFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== "string") return null;
  return payload.sub;
}
