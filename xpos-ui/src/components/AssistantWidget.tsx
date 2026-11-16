import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, X } from "lucide-react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { isAssistantWidgetVisible } from "@/config/assistantVisibility";
import { selectToken, selectUsername } from "@/store/selectors/authSelectors";
import { selectOrgId, selectBranchId, selectBranchName } from "@/store/selectors/orgContextSelectors";
import { queryAssistant, type AssistantQueryRequest } from "@/api/assistant";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
}

const DEFAULT_CHIPS = [
  "Sales today",
  "Popular drinks this week",
  "Who am I?",
  "Low stock",
  "Outstanding debt",
];

export function AssistantWidget() {
  const navVisibility = useNavVisibilityContextOrNull();
  const operatorVisibility = navVisibility?.operatorVisibility ?? {};
  const visible = isAssistantWidgetVisible(operatorVisibility);

  const token = useAppSelector(selectToken);
  const username = useAppSelector(selectUsername);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const listRef = useRef<HTMLDivElement>(null);

  const canQuery = Boolean(token && orgId && branchId);

  const mutation = useMutation({
    mutationFn: (message: string) => {
      const body: AssistantQueryRequest = { message, screen: "assistant" };
      return queryAssistant(token, orgId!, branchId!, body);
    },
    onSuccess: (result) => {
      const meta =
        result.requestId != null
          ? `\n\nRef: ${result.requestId}${result.llmUsed ? " · LLM" : ""}`
          : "";
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: result.answer + meta,
        },
      ]);
      if (result.suggestions?.length) {
        setChips(result.suggestions);
      }
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "error",
          text: `${getApiErrorMessage(err)}${requestId ? ` (Ref: ${requestId})` : ""}`,
        },
      ]);
    },
  });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, mutation.isPending]);

  function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !canQuery || mutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: trimmed },
    ]);
    setInput("");
    mutation.mutate(trimmed);
  }

  if (!visible) {
    return null;
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 md:bottom-6 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-900"
          aria-label="Open XPOS assistant"
        >
          <Bot className="h-7 w-7" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="XPOS assistant"
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-black/50"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-[min(85vh,32rem)] w-full flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:mb-0 sm:max-w-md sm:rounded-2xl dark:border-slate-600 dark:bg-slate-800">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-600">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  XPOS Assistant
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {branchName
                    ? `${branchName}${username ? ` · ${username}` : ""} · branch insights`
                    : "Select branch for sales data"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="Close assistant"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
            >
              {messages.length === 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Ask about today&apos;s sales, top items this week, low stock, debt, or who is
                  logged in. Answers come from live branch data — not guesses.
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "ml-auto bg-primary-600 text-white dark:bg-primary-500"
                      : msg.role === "error"
                        ? "border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {mutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up…
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200 px-3 py-2 dark:border-slate-600">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={!canQuery || mutation.isPending}
                    onClick={() => submitMessage(chip)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              {!canQuery && (
                <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                  Select org and branch context to ask branch questions.
                </p>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitMessage(input);
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={500}
                  disabled={!canQuery || mutation.isPending}
                  placeholder="Ask about sales, stock, debt…"
                  aria-label="Assistant message"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!canQuery || mutation.isPending || !input.trim()}
                  className="flex shrink-0 items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
