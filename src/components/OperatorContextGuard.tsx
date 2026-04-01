import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectHasOperatorContext } from "@/store/selectors/orgContextSelectors";

interface OperatorContextGuardProps {
  children: React.ReactNode;
}

/**
 * Redirects to /select-context when operator context (org, branch, terminal) is missing.
 * Use around operator routes so POS etc. have context.
 */
export function OperatorContextGuard({ children }: OperatorContextGuardProps) {
  const hasContext = useAppSelector(selectHasOperatorContext);
  const location = useLocation();

  if (!hasContext) {
    const returnTo = location.pathname + location.search || "/operator";
    return <Navigate to={`/select-context?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <>{children}</>;
}
