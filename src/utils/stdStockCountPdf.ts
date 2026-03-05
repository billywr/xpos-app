import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface StdStockCountPdfRow {
  sku: string;
  name: string;
  openingStock: number;
  addedStock: number;
  totalStock: number;
  closingStock: number;
  systemCountBeforeToday: number;
  variance: number;
  unitsSold: number;
  sellingPrice: number;
  amount: number;
}

function formatKsh(amount: number): string {
  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function downloadStdStockCountPdf(
  dateStr: string,
  rows: StdStockCountPdfRow[],
  totals: { unitsSold: number; amount: number },
  branchName?: string | null,
  orgName?: string | null,
  includeSystemAndVariance = false,
  appName = "XPOS"
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
  y += 8;

  if (rows.length > 0) {
    const headCols = [
      "Item",
      "Opening",
      "Added",
      "Total Stock",
      "Closing",
      ...(includeSystemAndVariance ? ["System", "Variance"] : []),
      "Units Sold",
      "Selling Price",
      "Amount",
    ];
    const tableData: string[][] = rows.map((r) => {
      const base = [
        r.sku ? `${r.sku} · ${r.name}` : r.name || "—",
        String(r.openingStock),
        String(r.addedStock),
        String(r.totalStock),
        String(r.closingStock),
      ];
      const middle = includeSystemAndVariance
        ? [String(r.systemCountBeforeToday), r.variance > 0 ? `+${r.variance}` : String(r.variance)]
        : [];
      const tail = [String(r.unitsSold), formatKsh(r.sellingPrice), formatKsh(r.amount)];
      return [...base, ...middle, ...tail];
    });

    autoTable(doc, {
      head: [headCols],
      body: tableData,
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [17, 50, 100] },
    });
    const meta = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    y = meta?.finalY ?? y;

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      `Totals: Units Sold = ${totals.unitsSold} | Total Sales = ${formatKsh(totals.amount)}`,
      margin,
      y
    );
    y += 6;
  } else {
    doc.text("No items for this date.", margin, y);
    y += 6;
  }

  y += 6;
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
