export type HeaderNavVisibilityState = Record<string, boolean>;

export function isHeaderNavItemVisible(
  path: string,
  canHide: boolean,
  visibilityState: HeaderNavVisibilityState
): boolean {
  if (!canHide) return true;
  if (path in visibilityState) return visibilityState[path];
  return true;
}
