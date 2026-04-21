import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { MiscExpenseResponse } from "@/api/miscExpenses";

function formatKsh(amount: number): string {
  return `Ksh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB");
}

export interface ExpensesPdfOptions {
  branchName?: string | null;
  orgName?: string | null;
  /** Label shown in the report header, e.g. "2026-04-01 to 2026-04-21". */
  dateRangeLabel?: string | null;
  appName?: string;
  totalAmount?: number | null;
}

export function generateExpensesPdf(
  expenses: MiscExpenseResponse[],
  opts: ExpensesPdfOptions = {}
): jsPDF {
  const { branchName, orgName, dateRangeLabel, appName = "XPOS", totalAmount } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Miscellaneous Expenses Report", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(orgName ?? "Organization", margin, y);
  y += 5;
  doc.text(`Branch: ${branchName ?? "—"}`, margin, y);
  y += 5;
  if (dateRangeLabel) {
    doc.text(`Date range: ${dateRangeLabel}`, margin, y);
    y += 5;
  }
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  y += 5;
  doc.text(`Total rows: ${expenses.length}`, margin, y);
  y += 7;

  if (expenses.length === 0) {
    doc.text("No expenses to report.", margin, y);
  } else {
    const tableData = expenses.map((e) => [
      formatDateTime(e.createdAt),
      e.category,
      e.description,
      e.incurredBy ?? "—",
      e.receiptRef ?? "—",
      formatKsh(e.amount),
    ]);

    autoTable(doc, {
      head: [["Recorded", "Category", "Description", "Incurred by", "Receipt ref", "Amount"]],
      body: tableData,
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [17, 50, 100], halign: "left" },
      columnStyles: {
        5: { halign: "right" },
      },
    });
    const meta = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    y = meta?.finalY ?? y;

    const computedTotal =
      totalAmount != null
        ? Number(totalAmount)
        : expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);

    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount ?? 0));
    }

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Summary", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total: ${formatKsh(computedTotal)}`, margin, y);
    y += 6;

    if (byCategory.size > 0) {
      const catRows = [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => [cat, formatKsh(amt)]);
      autoTable(doc, {
        head: [["Category", "Total"]],
        body: catRows,
        startY: y,
        margin: { left: margin, right: margin },
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 1.5 },
        headStyles: { fontStyle: "bold", halign: "left" },
        columnStyles: { 1: { halign: "right" } },
        tableWidth: 90,
      });
    }
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `${appName} — Expenses Report · Generated ${new Date().toLocaleString("en-GB")}`,
    margin,
    pageHeight - 6
  );
  doc.setTextColor(0);

  return doc;
}

export function downloadExpensesPdf(
  expenses: MiscExpenseResponse[],
  opts: ExpensesPdfOptions = {}
): void {
  const doc = generateExpensesPdf(expenses, opts);
  const stamp =
    (opts.dateRangeLabel ?? "").replace(/\s+to\s+/i, "_").replace(/[^0-9_-]/g, "") ||
    new Date().toISOString().slice(0, 10);
  const branchSlug = (opts.branchName ?? "branch")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "branch";
  doc.save(`expenses-${branchSlug}-${stamp}.pdf`);
}
