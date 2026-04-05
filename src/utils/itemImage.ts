import { getEnv } from "@/utils/env";

/**
 * Extracts the filename from an image URL or path for display.
 * e.g. /uploads/items/orgId/uuid.jpg -> uuid.jpg
 */
export function getItemImageName(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      const segments = u.pathname.split("/").filter(Boolean);
      return segments.length > 0 ? segments[segments.length - 1] : null;
    }
    const segments = trimmed.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  } catch {
    return trimmed;
  }
}

/**
 * Returns the full URL for an item image. Handles both absolute URLs
 * (e.g. https://...) and relative paths (e.g. /uploads/items/...).
 */
export function getItemImageUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const base = (getEnv("VITE_API_BASE_URL") ?? "").replace(/\/$/, "");
  return base ? `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}` : trimmed;
}
