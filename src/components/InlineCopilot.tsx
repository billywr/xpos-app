import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, X } from "lucide-react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId, selectBranchId } from "@/store/selectors/orgContextSelectors";
import { queryAssistant, type AssistantQueryRequest } from "@/api/assistant";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { isAssistantWidgetVisible } from "@/config/assistantVisibility";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";

export interface InlineCopilotProps {
  screen: string;
  label?: string;
  placeholder?: string;
  defaultQuestion?: string;
  filters?: Record<string, string>;
  className?: string;
}

export function InlineCopilot({
  screen,
  label = "Ask about this screen",
  placeholder = "Ask a question…",
  defaultQuestion,
  filters,
  className = "",
}: InlineCopilotProps) {
  const navVisibility = useNavVisibilityContextOrNull();
  const visible = isAssistantWidgetVisible(navVisibility?.operatorVisibility ?? {});

  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(defaultQuestion ?? "");
  const [answer, setAnswer] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canQuery = Boolean(token && orgId && branchId && visible);

  const mutation = useMutation({
    mutationFn: (message: string) => {
      const body: AssistantQueryRequest = { message, screen, filters };
      return queryAssistant(token, orgId!, branchId!, body);
    },
    onSuccess: (result) => {
      setAnswer(result.answer);
      const parts: string[] = [];
      if (result.requestId) parts.push(`Ref: ${result.requestId}`);
      if (result.llmUsed) parts.push("LLM routed");
      if (result.latencyMs != null) parts.push(`${result.latencyMs}ms`);
      setMeta(parts.length ? parts.join(" · ") : null);
      setError(null);
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      setError(`${getApiErrorMessage(err)}${requestId ? ` (Ref: ${requestId})` : ""}`);
      setAnswer(null);
      setMeta(null);
    },
  });

  if (!visible) {
    return null;
  }

  function submit() {
    const trimmed = input.trim();
    if (!trimmed || !canQuery || mutation.isPending) return;
    mutation.mutate(trimmed);
  }

  return (
    <div className={className}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!canQuery}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Bot className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          {label}
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-800 dark:text-white">{label}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              disabled={!canQuery || mutation.isPending}
              placeholder={placeholder}
              aria-label="Assistant question"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!canQuery || mutation.isPending || !input.trim()}
              className="flex shrink-0 items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500"
              aria-label="Ask"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          {answer && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
              {answer}
            </p>
          )}
          {meta && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta}</p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
