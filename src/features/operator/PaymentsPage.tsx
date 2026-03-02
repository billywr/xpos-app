import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectTerminalId,
} from "@/store/selectors/orgContextSelectors";
import { fetchOpenOrHeldSales } from "@/api/sales";
import { formatCurrency } from "@/utils/formatCurrency";
import { CreditCard, ShoppingBag } from "lucide-react";

/**
 * Operator Payments page: lists open/held sales that need payment completion.
 * Users can complete payments from the Menu Order screen via "Proceed to payment".
 */
export function PaymentsPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const terminalId = useAppSelector(selectTerminalId);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["openOrHeldSales", token, orgId, branchId, terminalId],
    queryFn: () =>
      fetchOpenOrHeldSales(token!, orgId!, branchId!, terminalId!),
    enabled: Boolean(token && orgId && branchId && terminalId),
  });

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
        etc.) and complete the sale.
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
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      Sale {sale.id.slice(0, 8)}…
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Total: {formatCurrency(sale.total)} • {sale.status}
                    </p>
                  </div>
                </div>
                <Link
                  to="/operator/menu-order"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
                >
                  Go to Menu Order
                </Link>
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
    </div>
  );
}
