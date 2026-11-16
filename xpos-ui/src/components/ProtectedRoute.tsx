import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Redirects to /login when there is no token. Preserves intended destination in returnTo.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = useAppSelector(selectToken);
  const location = useLocation();

  if (!token) {
    const returnTo = location.pathname + location.search || "/";
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <>{children}</>;
}
