import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Lock, Unlock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { InlineCopilot } from "@/components/InlineCopilot";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectTerminalId,
} from "@/store/selectors/orgContextSelectors";
import { getCurrentShift, openShift, closeShift } from "@/api/shifts";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDateTime } from "@/utils/formatDate";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";

export function OperatorDashboard() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const terminalId = useAppSelector(selectTerminalId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [openingFloat, setOpeningFloat] = useState("");
  const [closingAmount, setClosingAmount] = useState("");

  const { data: currentShift, isLoading: shiftLoading } = useQuery({
    queryKey: ["operator-current-shift", orgId, branchId, terminalId],
    queryFn: () => getCurrentShift(token, orgId!, branchId!, terminalId!),
    enabled: Boolean(token && orgId && branchId && terminalId),
  });

  useEffect(() => {
    if (
      currentShift?.expectedCashAmount != null &&
      typeof currentShift.expectedCashAmount === "number" &&
      closingAmount === ""
    ) {
      setClosingAmount(String(currentShift.expectedCashAmount));
    }
  }, [currentShift?.id, currentShift?.expectedCashAmount, closingAmount]);

  const openMutation = useMutation({
    mutationFn: (amount: number) =>
      openShift(token, orgId!, branchId!, terminalId!, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-current-shift", orgId, branchId, terminalId],
      });
      setOpeningFloat("");
      toast.success("Shift opened.", { title: "Shift" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({
      shiftId,
      counted,
      expected,
    }: {
      shiftId: string;
      counted: number;
      expected: number;
    }) =>
      closeShift(
        token,
        orgId!,
        branchId!,
        terminalId!,
        shiftId,
        counted,
        expected
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-current-shift", orgId, branchId, terminalId],
      });
      setClosingAmount("");
      toast.success("Shift closed.", { title: "Shift" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(openingFloat) || 0;
    if (amount < 0) return;
    openMutation.mutate(amount);
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    const counted = Number.parseFloat(closingAmount);
    if (Number.isNaN(counted) || counted < 0) {
      toast.error("Enter a valid closing amount.");
      return;
    }
    const expected =
      typeof currentShift.expectedCashAmount === "number"
        ? currentShift.expectedCashAmount
        : counted;
    closeMutation.mutate({
      shiftId: currentShift.id,
      counted,
      expected,
    });
  };

  return (
    <div className="p-6">
      <PageHeader title="Operator Dashboard" fallbackTo="/" />
      <InlineCopilot
        screen="shift"
        label="Why is my drawer off?"
        defaultQuestion="Shift variance"
        className="mb-4"
      />

      {/* Shift panel */}
      {orgId && branchId && terminalId && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Wallet className="h-5 w-5" />
            Shift
          </h2>
          {shiftLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading…
            </p>
          ) : currentShift ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Unlock className="h-3.5 w-3.5" />
                  Open
                </span>{" "}
                since{" "}
                {formatDateTime(currentShift.openedAt)} · Opening
                float: {formatCurrency(currentShift.openingFloatAmount)}
              </p>
              <form
                onSubmit={handleCloseShift}
                className="flex flex-wrap items-end gap-2"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Closing counted amount
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 sm:w-36 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                  {typeof currentShift?.expectedCashAmount === "number" && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Expected in drawer:{" "}
                      {formatCurrency(currentShift.expectedCashAmount)}
                    </span>
                  )}
                </label>
                <button
                  type="submit"
                  disabled={
                    !closingAmount.trim() || closeMutation.isPending
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-slate-700 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  <Lock className="h-4 w-4" />
                  {closeMutation.isPending ? "Closing…" : "Close shift"}
                </button>
              </form>
            </div>
          ) : (
            <form
              onSubmit={handleOpenShift}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Opening float (optional)
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  placeholder="0"
                  className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </label>
              <button
                type="submit"
                disabled={openMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
              >
                <Unlock className="h-4 w-4" />
                {openMutation.isPending ? "Opening…" : "Open shift"}
              </button>
            </form>
          )}
        </div>
      )}

    </div>
  );
}
