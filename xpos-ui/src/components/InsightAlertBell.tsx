import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2, X } from "lucide-react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId, selectBranchId } from "@/store/selectors/orgContextSelectors";
import {
  acknowledgeInsight,
  fetchInsightCount,
  fetchInsights,
  type InsightEvent,
} from "@/api/insights";
import { getApiErrorMessage } from "@/utils/apiError";
import { isAssistantWidgetVisible } from "@/config/assistantVisibility";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { toSentenceCase } from "@/utils/textCase";

const INSIGHTS_QUERY_KEY = "assistant-insights";

function severityClass(severity: string): string {
  if (severity === "WARN") {
    return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30";
  }
  return "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/40";
}

export function InsightAlertBell() {
  const navVisibility = useNavVisibilityContextOrNull();
  const visible = isAssistantWidgetVisible(navVisibility?.operatorVisibility ?? {});

  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const enabled = Boolean(token && orgId && branchId && visible);

  const countQuery = useQuery({
    queryKey: [INSIGHTS_QUERY_KEY, "count", orgId, branchId],
    queryFn: () => fetchInsightCount(token, orgId!, branchId!),
    enabled,
    refetchInterval: 5 * 60 * 1000,
  });

  const listQuery = useQuery({
    queryKey: [INSIGHTS_QUERY_KEY, "list", orgId, branchId],
    queryFn: () => fetchInsights(token, orgId!, branchId!, 0, 10),
    enabled: enabled && open,
  });

  const ackMutation = useMutation({
    mutationFn: (insightId: string) =>
      acknowledgeInsight(token, orgId!, branchId!, insightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INSIGHTS_QUERY_KEY] });
    },
  });

  if (!enabled) {
    return null;
  }

  const count = countQuery.data?.unacknowledged ?? 0;
  const insights = listQuery.data?.content ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-white/90 dark:hover:bg-white/10"
        aria-label={`Alerts${count > 0 ? `, ${count} unread` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-600">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Control alerts
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close alerts"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {listQuery.isLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              )}
              {listQuery.isError && (
                <p className="py-4 text-center text-sm text-red-700 dark:text-red-300">
                  {getApiErrorMessage(listQuery.error)}
                </p>
              )}
              {!listQuery.isLoading && insights.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No active alerts for this branch.
                </p>
              )}
              {insights.map((event: InsightEvent) => (
                <div
                  key={event.id}
                  className={`mb-2 rounded-lg border p-3 last:mb-0 ${severityClass(event.severity)}`}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {event.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{event.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">
                      {toSentenceCase(event.insightType)}
                    </span>
                    <button
                      type="button"
                      disabled={ackMutation.isPending}
                      onClick={() => ackMutation.mutate(event.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      <Check className="h-3 w-3" />
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
