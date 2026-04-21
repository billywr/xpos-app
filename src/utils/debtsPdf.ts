import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CustomerDebtResponse } from "@/api/debts";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB");
}

function statusLabel(status: string): string {
  if (status === "CLOSED" || status === "SETTLED") return "Closed";
  if (status === "OPEN") return "Open";
  if (status === "PARTIAL") return "Partial";
  if (status === "CANCELLED") return "Cancelled";
  return status;
}

export interface DebtsPdfOptions {
  branchName?: string | null;
  orgName?: string | null;
  statusFilterLabel?: string | null;
  /** Label shown in the report header, e.g. "2026-04-01 to 2026-04-21". */
  dateRangeLabel?: string | null;
  appName?: string;
}

export function generateDebtsPdf(
  debts: CustomerDebtResponse[],
  opts: DebtsPdfOptions = {}
): jsPDF {
  const {
    branchName,
    orgName,
    statusFilterLabel,
    dateRangeLabel,
    appName = "XPOS",
  } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  let y = margin;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Debts Report", margin, y);
  y += 9;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(orgName ?? "Organization", margin, y);
  y += 6;
  doc.text(`Branch: ${branchName ?? "—"}`, margin, y);
  y += 6;
  if (dateRangeLabel) {
    doc.text(`Date range: ${dateRangeLabel}`, margin, y);
    y += 6;
  }
  if (statusFilterLabel) {
    doc.text(`Filter: ${statusFilterLabel}`, margin, y);
    y += 6;
  }
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  y += 6;
  doc.text(`Total rows: ${debts.length}`, margin, y);
  y += 8;

  if (debts.length === 0) {
    doc.text("No debts to report.", margin, y);
  } else {
    const tableData = debts.map((d) => [
      d.customerName,
      d.customerPhone ?? "—",
      formatAmount(d.amount),
      formatAmount(d.amountSettled ?? 0),
      formatAmount(d.outstanding),
      statusLabel(d.status),
      formatDate(d.dueDate),
      formatDateTime(d.createdAt),
      d.notes?.trim() ? d.notes.trim() : "—",
    ]);

    autoTable(doc, {
      head: [
        [
          "Customer",
          "Phone",
          "Original (KSH)",
          "Repaid (KSH)",
          "Balance (KSH)",
          "Status",
          "Due",
          "Recorded",
          "Notes",
        ],
      ],
      body: tableData,
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [17, 50, 100], halign: "left", fontSize: 11 },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [17, 24, 39] },
        2: { halign: "left" },
        3: {
          halign: "left",
          fontStyle: "bold",
          textColor: [5, 150, 105],
        },
        4: {
          halign: "left",
          fontStyle: "bold",
          textColor: [220, 38, 38],
        },
      },
    });
    const meta = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    y = meta?.finalY ?? y;

    const totalOriginal = debts.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const totalRepaid = debts.reduce((s, d) => s + Number(d.amountSettled ?? 0), 0);
    const totalOutstanding = debts.reduce((s, d) => s + Number(d.outstanding ?? 0), 0);

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Summary", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const col1 = margin;
    const col2 = margin + 70;
    const col3 = margin + 140;
    doc.text("Total original (KSH)", col1, y);
    doc.setFont("helvetica", "bold");
    doc.text(formatAmount(totalOriginal), col1, y + 6);
    doc.setFont("helvetica", "normal");

    doc.text("Total repaid (KSH)", col2, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(5, 150, 105);
    doc.text(formatAmount(totalRepaid), col2, y + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    doc.text("Total outstanding (KSH)", col3, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(formatAmount(totalOutstanding), col3, y + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 10;

    // Per-customer outstanding subtotals on their own page. Cancelled debts
    // are excluded — they're audit-only, not owed. Same multi-column layout as
    // the expenses "Total by category" page so long customer lists fit on a
    // single page.
    const byCustomer = new Map<string, number>();
    for (const d of debts) {
      if (d.status === "CANCELLED") continue;
      const out = Number(d.outstanding ?? 0);
      if (out <= 0) continue;
      byCustomer.set(d.customerName, (byCustomer.get(d.customerName) ?? 0) + out);
    }
    if (byCustomer.size > 0) {
      const customerRows = [...byCustomer.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, amt]) => [name, formatAmount(amt)]);

      doc.addPage();
      y = margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Outstanding by customer", margin, y);
      y += 8;

      const pageWidth = doc.internal.pageSize.getWidth();
      const MAX_ROWS_PER_COL = 32;
      let nCols = 1;
      if (customerRows.length > 10) nCols = 2;
      if (customerRows.length > 24) nCols = 3;
      if (Math.ceil(customerRows.length / nCols) > MAX_ROWS_PER_COL && nCols < 4) {
        nCols = Math.min(4, Math.ceil(customerRows.length / MAX_ROWS_PER_COL));
      }

      let nameColWidth: number;
      let amtColWidth: number;
      let gap: number;
      if (nCols === 1) {
        nameColWidth = 50;
        amtColWidth = 40;
        gap = 0;
      } else if (nCols === 2) {
        nameColWidth = 55;
        amtColWidth = 35;
        gap = 14;
      } else if (nCols === 3) {
        nameColWidth = 52;
        amtColWidth = 28;
        gap = 12;
      } else {
        nameColWidth = 40;
        amtColWidth = 20;
        gap = 9;
      }
      const custTableWidth = nameColWidth + amtColWidth;
      const custHead = [
        [
          { content: "Customer", styles: { halign: "left" as const } },
          { content: "Outstanding (KSH)", styles: { halign: "left" as const } },
        ],
      ];
      const custTableStyles = {
        theme: "plain" as const,
        styles: { fontSize: 9, cellPadding: 0.8 },
        headStyles: { fontStyle: "bold" as const },
        columnStyles: {
          0: { halign: "left" as const, cellWidth: nameColWidth },
          1: {
            halign: "left" as const,
            cellWidth: amtColWidth,
            fontStyle: "bold" as const,
            textColor: [220, 38, 38] as [number, number, number],
          },
        },
      };

      const perCol = Math.ceil(customerRows.length / nCols);
      const tableStartY = y;
      const custFinalYs: number[] = [];
      for (let i = 0; i < nCols; i++) {
        const slice = customerRows.slice(i * perCol, (i + 1) * perCol);
        if (slice.length === 0) break;
        const start = margin + i * (custTableWidth + gap);
        autoTable(doc, {
          head: custHead,
          body: slice,
          startY: tableStartY,
          margin: {
            left: start,
            right: Math.max(0, pageWidth - (start + custTableWidth)),
          },
          tableWidth: custTableWidth,
          pageBreak: "avoid",
          ...custTableStyles,
        });
        const meta2 = (doc as unknown as { lastAutoTable?: { finalY: number } })
          .lastAutoTable;
        custFinalYs.push(meta2?.finalY ?? tableStartY);
      }

      if (nCols > 1 && custFinalYs.length > 0) {
        const maxY = Math.max(tableStartY, ...custFinalYs);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        for (let i = 1; i < nCols; i++) {
          const separatorX = margin + i * (custTableWidth + gap) - gap / 2;
          doc.line(separatorX, tableStartY, separatorX, maxY);
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
    `${appName} — Debts Report · Generated ${new Date().toLocaleString("en-GB")}`,
    margin,
    pageHeight - 6
  );
  doc.setTextColor(0);

  return doc;
}

export function downloadDebtsPdf(
  debts: CustomerDebtResponse[],
  opts: DebtsPdfOptions = {}
): void {
  const doc = generateDebtsPdf(debts, opts);
  const stamp =
    (opts.dateRangeLabel ?? "").replace(/\s+to\s+/i, "_").replace(/[^0-9_-]/g, "") ||
    new Date().toISOString().slice(0, 10);
  const branchSlug = (opts.branchName ?? "branch")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "branch";
  doc.save(`debts-${branchSlug}-${stamp}.pdf`);
}
