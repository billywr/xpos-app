import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setOrg, setBranch, setTerminal } from "@/store/slices/orgContextSlice";
import { selectHasOperatorContext } from "@/store/selectors/orgContextSelectors";
import { selectToken } from "@/store/selectors/authSelectors";
import { resolveOperatorContext } from "@/utils/resolveOperatorContext";
import { setStoredContext } from "@/utils/contextStorage";

interface OperatorContextGuardProps {
  children: React.ReactNode;
}

/**
 * Ensures operator routes have org + branch + terminal context.
 * Attempts auto-resolve when each level has exactly one choice; otherwise
 * redirects to /select-context.
 */
export function OperatorContextGuard({ children }: OperatorContextGuardProps) {
  const hasContext = useAppSelector(selectHasOperatorContext);
  const token = useAppSelector(selectToken);
  const dispatch = useAppDispatch();
  const location = useLocation();

  const { data: resolvedContext, isLoading, isFetched } = useQuery({
    queryKey: ["resolve-operator-context", token],
    queryFn: () => resolveOperatorContext(token),
    enabled: Boolean(token) && !hasContext,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!resolvedContext || hasContext) return;
    dispatch(
      setOrg({ orgId: resolvedContext.orgId, orgName: resolvedContext.orgName })
    );
    dispatch(
      setBranch({
        branchId: resolvedContext.branchId,
        branchName: resolvedContext.branchName,
      })
    );
    dispatch(
      setTerminal({
        terminalId: resolvedContext.terminalId,
        terminalName: resolvedContext.terminalName,
      })
    );
    setStoredContext(resolvedContext);
  }, [resolvedContext, hasContext, dispatch]);

  if (hasContext) {
    return <>{children}</>;
  }

  if (isLoading || !isFetched || resolvedContext) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 dark:text-primary-400" />
        <p className="text-sm">Loading your session context…</p>
      </div>
    );
  }

  const returnTo = location.pathname + location.search || "/operator";
  return (
    <Navigate
      to={`/select-context?returnTo=${encodeURIComponent(returnTo)}`}
      replace
    />
  );
}
