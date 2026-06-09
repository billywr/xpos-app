import { Outlet } from "react-router-dom";

/**
 * Route outlet wrapper. Intentionally no opacity crossfade here: animating
 * {@link Outlet} with AnimatePresence causes both exit and enter layers to
 * render the *new* route at once (Outlet always reflects current URL), which
 * produces a worse double-flash. Loading flicker is handled by useQueryDisplay
 * + in-table skeletons instead.
 */
export function PageTransition() {
  return <Outlet />;
}
