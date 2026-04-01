import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, LayoutDashboard, Wallet, Lock, Unlock, ArrowDownToLine, ArrowUpFromLine, CalendarCheck } from "lucide-react";
import { FLOATING_MENU_CARD } from "@/utils/floatingCardClasses";
import { PageHeader } from "@/components/PageHeader";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectTerminalId,
} from "@/store/selectors/orgContextSelectors";
import { getCurrentShift, openShift, closeShift } from "@/api/shifts";
import { createCashMovement, getCashMovementsByShift } from "@/api/cashMovements";
import { postDayClose } from "@/api/dayClose";
import { formatCurrency } from "@/utils/formatCurrency";
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
  const [cashMovementAmount, setCashMovementAmount] = useState("");
  const [dayCloseDate, setDayCloseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const { data: currentShift, isLoading: shiftLoading } = useQuery({
    queryKey: ["operator-current-shift", orgId, branchId, terminalId],
    queryFn: () =>
      getCurrentShift(token, orgId!, branchId!, terminalId!),
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
    mutationFn: ({ shiftId, counted, expected }: { shiftId: string; counted: number; expected: number }) =>
      closeShift(token, orgId!, branchId!, terminalId!, shiftId, counted, expected),
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

  const { data: cashMovements = [], refetch: refetchCashMovements } = useQuery({
    queryKey: ["operator-cash-movements", orgId, branchId, terminalId, currentShift?.id],
    queryFn: () =>
      getCashMovementsByShift(token, orgId!, branchId!, terminalId!, currentShift!.id),
    enabled: Boolean(token && orgId && branchId && terminalId && currentShift?.id),
  });

  const cashMovementMutation = useMutation({
    mutationFn: ({ type, amount }: { type: "PAID_IN" | "PAID_OUT"; amount: number }) =>
      createCashMovement(token, orgId!, branchId!, terminalId!, type, amount),
    onSuccess: () => {
      refetchCashMovements();
      setCashMovementAmount("");
      toast.success("Cash movement recorded.", { title: "Cash" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const dayCloseMutation = useMutation({
    mutationFn: (businessDate: string) =>
      postDayClose(token, orgId!, branchId!, businessDate),
    onSuccess: () => {
      toast.success("Day closed.", { title: "Day close" });
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

  const handleCashMovement = (type: "PAID_IN" | "PAID_OUT") => (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(cashMovementAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    cashMovementMutation.mutate({ type, amount });
  };

  const handleDayClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayCloseDate.trim()) {
      toast.error("Select a business date.");
      return;
    }
    dayCloseMutation.mutate(dayCloseDate);
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Operator Dashboard"
        fallbackTo="/"
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
                since {new Date(currentShift.openedAt).toLocaleString()} · Opening float:{" "}
                {formatCurrency(currentShift.openingFloatAmount)}
              </p>
              <form onSubmit={handleCloseShift} className="flex flex-wrap items-end gap-2">
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
                    className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                  {typeof currentShift?.expectedCashAmount === "number" && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Expected in drawer: {formatCurrency(currentShift.expectedCashAmount)}
                    </span>
                  )}
                </label>
                <button
                  type="submit"
                  disabled={!closingAmount.trim() || closeMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-slate-700 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  <Lock className="h-4 w-4" />
                  {closeMutation.isPending ? "Closing…" : "Close shift"}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleOpenShift} className="flex flex-wrap items-end gap-2">
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

      {/* Cash movements (when shift open) */}
      {orgId && branchId && terminalId && currentShift && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            Paid in / Paid out
          </h2>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Amount
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={cashMovementAmount}
                onChange={(e) => setCashMovementAmount(e.target.value)}
                placeholder="0.00"
                className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={handleCashMovement("PAID_IN")}
              disabled={!cashMovementAmount.trim() || cashMovementMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Paid in
            </button>
            <button
              type="button"
              onClick={handleCashMovement("PAID_OUT")}
              disabled={!cashMovementAmount.trim() || cashMovementMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Paid out
            </button>
          </div>
          {cashMovements.length > 0 && (
            <div className="border-t border-slate-200 pt-3 dark:border-slate-600">
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Recent movements
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-sm text-slate-600 dark:text-slate-400">
                {cashMovements.slice(0, 10).map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span>
                      {m.type === "PAID_IN" ? (
                        <ArrowDownToLine className="inline h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ArrowUpFromLine className="inline h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      )}{" "}
                      {m.type.replace("_", " ")} · {formatCurrency(m.amount)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-500">
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Day close */}
      {orgId && branchId && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <CalendarCheck className="h-5 w-5" />
            Day close
          </h2>
          <form onSubmit={handleDayClose} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Business date
              </span>
              <input
                type="date"
                value={dayCloseDate}
                onChange={(e) => setDayCloseDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </label>
            <button
              type="submit"
              disabled={dayCloseMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50"
            >
              <CalendarCheck className="h-4 w-4" />
              {dayCloseMutation.isPending ? "Closing…" : "Close day"}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/operator/menu-order"
          className={`${FLOATING_MENU_CARD} p-6 text-slate-900 dark:text-white`}
        >
          <div className="rounded-lg bg-primary-600 p-3">
            <ShoppingCart className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">POS</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Take orders and process payments
            </p>
          </div>
        </Link>
        <Link
          to="/operator/analytics"
          className={`${FLOATING_MENU_CARD} p-6 text-slate-900 dark:text-white`}
        >
          <div className="rounded-lg bg-primary-600 p-3">
            <LayoutDashboard className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">Analytics</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Reports and overview
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
