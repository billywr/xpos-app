import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectTerminalId,
} from "@/store/selectors/orgContextSelectors";
import { fetchOpenOrHeldSales, voidSale } from "@/api/sales";
import { formatCurrency } from "@/utils/formatCurrency";
import { ConfirmDialog } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import type { Sale } from "@/types/sales";
import { CreditCard, ShoppingBag, X } from "lucide-react";

/**
 * Operator Payments page: lists open/held sales that need payment completion.
 * Users can complete payments from the Menu Order screen via "Proceed to payment".
 */
export function PaymentsPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const terminalId = useAppSelector(selectTerminalId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["openOrHeldSales", token, orgId, branchId, terminalId],
    queryFn: () =>
      fetchOpenOrHeldSales(token!, orgId!, branchId!, terminalId!),
    enabled: Boolean(token && orgId && branchId && terminalId),
  });

  const voidMutation = useMutation({
    mutationFn: (saleId: string) =>
      voidSale(token, orgId!, branchId!, terminalId!, saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["openOrHeldSales", token, orgId, branchId, terminalId],
      });
      setSaleToVoid(null);
      toast.success("Sale cancelled. Removed from open sales.", { title: "Cancelled" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const handleConfirmVoid = () => {
    if (saleToVoid) {
      voidMutation.mutate(saleToVoid.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <h1 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">
          Payments
        </h1>
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
        <CreditCard className="h-6 w-6" />
        Payments
      </h1>
      <p className="mb-6 text-slate-600 dark:text-slate-400">
        Complete payments from the Menu Order screen. Add items to cart, then
        click <strong>Proceed to payment</strong> to add tenders (Cash, M-Pesa,
        etc.) and complete the sale. Click <strong>Cancel</strong> when the
        customer changes their mind or items are out of stock.
      </p>

      {sales.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Open sales ({sales.length})
          </h2>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ShoppingBag className="h-5 w-5 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">
                      Sale {sale.id.slice(0, 8)}…
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Total: {formatCurrency(sale.total)} • {sale.status}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    to={`/operator/menu-order?saleId=${sale.id}`}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
                  >
                    Go to Menu Order
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSaleToVoid(sale)}
                    disabled={voidMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
                    aria-label="Cancel sale"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        to="/operator/menu-order"
        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-medium text-white hover:bg-primary-500"
      >
        <ShoppingBag className="h-5 w-5" />
        Open Menu Order
      </Link>

      <ConfirmDialog
        open={saleToVoid !== null}
        onClose={() => setSaleToVoid(null)}
        onConfirm={handleConfirmVoid}
        title="Cancel this sale?"
        message={
          saleToVoid ? (
            <>
              Cancel sale {saleToVoid.id.slice(0, 8)}… ({formatCurrency(saleToVoid.total)})?
              Use this when the customer changes their mind or items are out of stock. This
              cannot be undone.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Cancel sale"
        variant="danger"
        loading={voidMutation.isPending}
      />
    </div>
  );
}
