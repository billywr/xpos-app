import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatQty } from "@/utils/formatQuantity";

interface StdStockCountPdfRow {
  sku: string;
  name: string;
  openingStock: number;
  addedStock: number;
  totalStock: number;
  closingStock: number;
  unitsSold: number;
  sellingPrice: number;
  amount: number;
  comments: string;
}

function formatKsh(amount: number): string {
  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPlainAmount(amount: number): string {
  return amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface StdStockCountPdfDebt {
  customerName: string;
  customerPhone: string | null;
  issuedBy: string | null;
  outstanding: number;
  dueDate: string | null;
  createdAt: string;
}

export interface StdStockCountPdfSummary {
  dayDebts: StdStockCountPdfDebt[];
  dayDebtsTotal: number;
  allDebts: StdStockCountPdfDebt[];
  allDebtsTotal: number;
  expensesTotal: number;
}

export function downloadStdStockCountPdf(
  dateStr: string,
  rows: StdStockCountPdfRow[],
  totals: { unitsSold: number; amount: number },
  branchName?: string | null,
  orgName?: string | null,
  appName = "XPOS",
  summary?: StdStockCountPdfSummary,
  opts?: { searchQuery?: string | null }
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Stock Count Sheet", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(orgName ?? "Organization", margin, y);
  y += 5;
  doc.text(`Branch: ${branchName ?? "—"}`, margin, y);
  y += 5;
  doc.text(`Date: ${dateStr}`, margin, y);
  y += 5;
  if (opts?.searchQuery) {
    doc.text(`Search: "${opts.searchQuery}"`, margin, y);
    y += 5;
  }
  doc.text(`Total items: ${rows.length}`, margin, y);
  y += 8;

  if (rows.length > 0) {
    const headCols = [
      "Item",
      "Opening",
      "Added",
      "Total Stock",
      "Closing",
      "Units Sold",
      "Selling Price (KSH)",
      "Amount (KSH)",
      "comments",
    ];
    const tableData: string[][] = rows.map((r) => [
      r.sku ? `${r.sku} · ${r.name}` : r.name || "—",
      formatQty(r.openingStock),
      formatQty(r.addedStock),
      formatQty(r.totalStock),
      formatQty(r.closingStock),
      formatQty(r.unitsSold),
      formatPlainAmount(r.sellingPrice),
      formatPlainAmount(r.amount),
      r.comments.trim() ? r.comments : "—",
    ]);

    autoTable(doc, {
      head: [headCols],
      body: tableData,
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [17, 50, 100] },
      columnStyles: {
        6: { halign: "left" },
        7: { halign: "left" },
      },
    });
    const meta = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    y = meta?.finalY ?? y;

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      `Totals: Units Sold = ${formatQty(totals.unitsSold)} | Total Sales = ${formatKsh(totals.amount)}`,
      margin,
      y
    );
    y += 6;
  } else {
    doc.text("No items for this date.", margin, y);
    y += 6;
  }

  // Summary section: debts, expenses, sales
  if (summary) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      `Today Debts: ${formatKsh(summary.dayDebtsTotal)}   |   Total Debts: ${formatKsh(summary.allDebtsTotal)}   |   Expenses: ${formatKsh(summary.expensesTotal)}   |   Total Sales: ${formatKsh(totals.amount)}`,
      margin,
      y
    );
    y += 8;

    // Today's debtors table
    if (summary.dayDebts.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Debtors — ${dateStr}`, margin, y);
      y += 2;

      autoTable(doc, {
        head: [["Customer", "Phone", "Issued by", "Outstanding (KSH)", "Due Date", "Recorded"]],
        body: summary.dayDebts.map((d) => [
          d.customerName,
          d.customerPhone ?? "—",
          d.issuedBy ?? "—",
          formatPlainAmount(d.outstanding),
          d.dueDate ?? "—",
          d.createdAt?.slice(0, 10) ?? "—",
        ]),
        startY: y,
        margin: { left: margin, right: margin },
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [180, 120, 20] },
        columnStyles: {
          3: { halign: "left" },
        },
      });
      const dayMeta = (doc as unknown as { lastAutoTable?: { finalY: number } })
        .lastAutoTable;
      y = dayMeta?.finalY ?? y;
      y += 6;
    }

    // All outstanding debtors table
    if (summary.allDebts.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("All Outstanding Debtors", margin, y);
      y += 2;

      autoTable(doc, {
        head: [["Customer", "Phone", "Issued by", "Outstanding (KSH)", "Due Date", "Recorded"]],
        body: summary.allDebts.map((d) => [
          d.customerName,
          d.customerPhone ?? "—",
          d.issuedBy ?? "—",
          formatPlainAmount(d.outstanding),
          d.dueDate ?? "—",
          d.createdAt?.slice(0, 10) ?? "—",
        ]),
        startY: y,
        margin: { left: margin, right: margin },
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [180, 80, 20] },
        columnStyles: {
          3: { halign: "left" },
        },
      });
      const allMeta = (doc as unknown as { lastAutoTable?: { finalY: number } })
        .lastAutoTable;
      y = allMeta?.finalY ?? y;
      y += 6;
    }
  }

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Generated ${new Date().toLocaleString("en-GB")} — ${appName} Standard Stock Count`,
    margin,
    y
  );

  const filename = `stock-count-sheet-${dateStr}.pdf`;
  doc.save(filename);
}
