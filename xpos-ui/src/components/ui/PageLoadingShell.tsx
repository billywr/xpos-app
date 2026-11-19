import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { tableCard } from "@/components/ui/styles";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";

export interface PageLoadingShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  fallbackTo?: string;
  /** Row below header (search, filters, pagination). Shown during loading too. */
  toolbar?: ReactNode;
  /** Actions aligned with header (e.g. Add button). */
  headerActions?: ReactNode;
  columns: number;
  /** Optional thead content — keeps column headers visible during skeleton load. */
  tableHead?: ReactNode;
  loading?: boolean;
  error?: unknown;
  children?: ReactNode;
}

/**
 * Keeps page chrome mounted during fetch — skeleton rows inside the table card, never a blank main area.
 */
export function PageLoadingShell({
  title,
  subtitle,
  icon,
  fallbackTo,
  toolbar,
  headerActions,
  columns,
  tableHead,
  loading = false,
  error,
  children,
}: PageLoadingShellProps) {
  const showSkeleton = loading && !children;
  const errorMessage = error ? getApiErrorMessage(error) : null;
  const requestId = error ? getApiErrorRequestId(error) : undefined;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader title={title} icon={icon} fallbackTo={fallbackTo} noMargin>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
          )}
        </PageHeader>
        {headerActions}
      </div>

      {toolbar}

      {errorMessage && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{errorMessage}</p>
          {requestId && (
            <p className="mt-2 text-sm opacity-90">
              Reference:{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">{requestId}</code>
            </p>
          )}
        </div>
      )}

      {showSkeleton && (
        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${tableCard}`}>
          <div className="min-h-0 flex-1 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              {tableHead && (
                <thead className="bg-slate-50 dark:bg-slate-700">{tableHead}</thead>
              )}
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <TableSkeleton columns={columns} withSpinner />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
