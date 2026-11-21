import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { MiscExpenseGroupSummaryResponse, MiscExpenseResponse } from "@/api/miscExpenses";
import { formatAmount } from "@/utils/formatCurrency";
import { formatDateTime } from "@/utils/formatDate";

export interface ExpensesPdfOptions {
  branchName?: string | null;
  orgName?: string | null;
  /** Label shown in the report header, e.g. "2026-04-01 to 2026-04-21". */
  dateRangeLabel?: string | null;
  searchQuery?: string | null;
  appName?: string;
  totalAmount?: number | null;
}

export function generateExpensesPdf(
  expenses: MiscExpenseResponse[],
  opts: ExpensesPdfOptions = {}
): jsPDF {
  const { branchName, orgName, dateRangeLabel, searchQuery, appName = "XPOS", totalAmount } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Miscellaneous expenses report", margin, y);
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
  if (searchQuery) {
    doc.text(`Search: "${searchQuery}"`, margin, y);
    y += 5;
  }
  doc.text(`Generated: ${formatDateTime(new Date())}`, margin, y);
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
      formatAmount(e.amount),
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
        5: { halign: "left" },
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
    doc.text(`Total: ${formatAmount(computedTotal)}`, margin, y);
    y += 6;

    if (byCategory.size > 0) {
      const catRows = [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => [cat, formatAmount(amt)]);

      // Category breakdown lives on its own page so it reads as a standalone
      // section instead of being chopped by whatever space is left after the
      // main expenses table.
      doc.addPage();
      y = margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Total by category", margin, y);
      y += 8;

      // Category/Total columns are both left-aligned (per-cell styles.halign
      // is the highest-precedence style — columnStyles.halign alone gets
      // ignored on the header row) so "Total" sits directly above the
      // amounts instead of drifting apart.
      //
      // How many side-by-side sub-tables we render is picked based on how many
      // categories we have — and ALSO the per-column row count. Each sub-table
      // must fit on one landscape A4 page, otherwise column 1 overflows to
      // page 2 and subsequent columns render on page 2 at the wrong X — the
      // whole layout ends up jumbled. At fontSize 9 / cellPadding 0.8 mm a
      // page holds ~32 rows, so 32 is the cap per column.
      const pageWidth = doc.internal.pageSize.getWidth();
      const MAX_ROWS_PER_COL = 32;
      let nCols = 1;
      if (catRows.length > 10) nCols = 2;
      if (catRows.length > 24) nCols = 3;
      if (Math.ceil(catRows.length / nCols) > MAX_ROWS_PER_COL && nCols < 4) {
        nCols = Math.min(4, Math.ceil(catRows.length / MAX_ROWS_PER_COL));
      }

      // Widths chosen so nCols sub-tables + (nCols-1) gaps fit the usable
      // landscape width (≈ 273 mm after 12 mm margins each side).
      let catColWidth: number;
      let totalColWidth: number;
      let gap: number;
      if (nCols === 1) {
        catColWidth = 45;
        totalColWidth = 45;
        gap = 0;
      } else if (nCols === 2) {
        catColWidth = 50;
        totalColWidth = 40;
        gap = 14;
      } else if (nCols === 3) {
        catColWidth = 50;
        totalColWidth = 30;
        gap = 12;
      } else {
        // 4 columns — only reached when there are > 128 categories; very rare.
        catColWidth = 38;
        totalColWidth = 22;
        gap = 9;
      }
      const tableWidth = catColWidth + totalColWidth;
      const catHead = [
        [
          { content: "Category", styles: { halign: "left" as const } },
          { content: "Total", styles: { halign: "left" as const } },
        ],
      ];
      const catTableStyles = {
        theme: "plain" as const,
        styles: { fontSize: 9, cellPadding: 0.8 },
        headStyles: { fontStyle: "bold" as const },
        columnStyles: {
          0: { halign: "left" as const, cellWidth: catColWidth },
          1: { halign: "left" as const, cellWidth: totalColWidth },
        },
      };

      const perCol = Math.ceil(catRows.length / nCols);
      const tableStartY = y;
      const finalYs: number[] = [];
      for (let i = 0; i < nCols; i++) {
        const slice = catRows.slice(i * perCol, (i + 1) * perCol);
        if (slice.length === 0) break;
        const start = margin + i * (tableWidth + gap);
        autoTable(doc, {
          head: catHead,
          body: slice,
          startY: tableStartY,
          margin: {
            left: start,
            right: Math.max(0, pageWidth - (start + tableWidth)),
          },
          tableWidth,
          pageBreak: "avoid",
          ...catTableStyles,
        });
        const meta2 = (doc as unknown as { lastAutoTable?: { finalY: number } })
          .lastAutoTable;
        finalYs.push(meta2?.finalY ?? tableStartY);
      }

      if (nCols > 1 && finalYs.length > 0) {
        // Thin grey separator in the middle of each gap between columns.
        const maxFinalY = Math.max(tableStartY, ...finalYs);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        for (let i = 1; i < nCols; i++) {
          const separatorX = margin + i * (tableWidth + gap) - gap / 2;
          doc.line(separatorX, tableStartY, separatorX, maxFinalY);
        }
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
      }
    }
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `${appName} — Expenses report · Generated ${formatDateTime(new Date())}`,
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

export interface GroupedExpensesPdfOptions {
  branchName?: string | null;
  orgName?: string | null;
  dateRangeLabel?: string | null;
  groupByLabel?: string | null;
  searchQuery?: string | null;
  appName?: string;
}

export function generateGroupedExpensesPdf(
  groups: MiscExpenseGroupSummaryResponse[],
  opts: GroupedExpensesPdfOptions = {}
): jsPDF {
  const {
    branchName,
    orgName,
    dateRangeLabel,
    groupByLabel = "Group",
    searchQuery,
    appName = "XPOS",
  } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`Miscellaneous expenses report (grouped by ${groupByLabel})`, margin, y);
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
  doc.text(`Grouped by: ${groupByLabel}`, margin, y);
  y += 5;
  if (searchQuery) {
    doc.text(`Search: "${searchQuery}"`, margin, y);
    y += 5;
  }
  doc.text(`Generated: ${formatDateTime(new Date())}`, margin, y);
  y += 5;
  doc.text(`Total groups: ${groups.length}`, margin, y);
  y += 7;

  if (groups.length === 0) {
    doc.text("No expenses to report.", margin, y);
  } else {
    const tableData = groups.map((g, idx) => [
      String(idx + 1),
      g.groupLabel,
      `${g.count} ${g.count === 1 ? "expense" : "expenses"}`,
      formatAmount(g.totalAmount),
    ]);

    autoTable(doc, {
      head: [["#", groupByLabel, "Expenses", "Amount"]],
      body: tableData,
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [17, 50, 100], halign: "left" },
      columnStyles: {
        0: { halign: "center", cellWidth: 14 },
        1: { fontStyle: "bold", textColor: [17, 24, 39] },
        2: { halign: "center", cellWidth: 30 },
        3: { halign: "left" },
      },
    });

    const meta = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    y = meta?.finalY ?? y;

    const totalAmt = groups.reduce((s, g) => s + Number(g.totalAmount ?? 0), 0);
    const totalCount = groups.reduce((s, g) => s + Number(g.count ?? 0), 0);

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Summary", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const col1 = margin;
    const col2 = margin + 65;
    doc.text("Total expenses count", col1, y);
    doc.setFont("helvetica", "bold");
    doc.text(`${totalCount}`, col1, y + 5);
    doc.setFont("helvetica", "normal");

    doc.text("Total", col2, y);
    doc.setFont("helvetica", "bold");
    doc.text(formatAmount(totalAmt), col2, y + 5);
    doc.setFont("helvetica", "normal");
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `${appName} — Grouped expenses report · Generated ${formatDateTime(new Date())}`,
    margin,
    pageHeight - 6
  );
  doc.setTextColor(0);

  return doc;
}

export function downloadGroupedExpensesPdf(
  groups: MiscExpenseGroupSummaryResponse[],
  opts: GroupedExpensesPdfOptions = {}
): void {
  const doc = generateGroupedExpensesPdf(groups, opts);
  const stamp =
    (opts.dateRangeLabel ?? "").replace(/\s+to\s+/i, "_").replace(/[^0-9_-]/g, "") ||
    new Date().toISOString().slice(0, 10);
  const branchSlug = (opts.branchName ?? "branch")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "branch";
  const groupSlug = (opts.groupByLabel ?? "grouped")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  doc.save(`expenses-${branchSlug}-${groupSlug}-${stamp}.pdf`);
}

