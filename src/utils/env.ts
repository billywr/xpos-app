declare global {
  interface Window {
    __env?: Partial<Record<string, string>>;
  }
}

/**
 * Read a VITE_* environment variable.
 *
 * In production (Docker) the value comes from `window.__env`, which is
 * written by docker-entrypoint.sh before nginx starts. This lets any
 * VITE_* var be overridden at container start time without rebuilding.
 *
 * In local dev `window.__env` is undefined so the call falls through to
 * `import.meta.env`, which Vite populates from `.env` as usual.
 */
export function getEnv(key: string): string | undefined {
  const runtime = window.__env?.[key];
  return runtime !== undefined && runtime !== ""
    ? runtime
    : (import.meta.env[key] as string | undefined);
}
