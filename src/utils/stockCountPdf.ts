import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StockCountSessionResponse, StockCountLineResponse } from "@/api/stockTaking";
import { formatQty, formatQtyVariance } from "@/utils/formatQuantity";

function formatKsh(amount: number): string {
  return `Ksh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function generateStockCountPdf(
  session: StockCountSessionResponse,
  branchName?: string | null,
  orgName?: string | null,
  appName = "XPOS"
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Stock Count Report", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(orgName ?? "Organization", margin, y);
  y += 6;
  doc.text(`Branch: ${branchName ?? "—"}`, margin, y);
  y += 6;
  doc.text(
    `Started: ${new Date(session.startedAt).toLocaleString("en-GB")}`,
    margin,
    y
  );
  y += 6;
  doc.text(`Source: ${session.sourceType}`, margin, y);
  y += 6;
  doc.text(`Status: ${session.status}`, margin, y);
  y += 10;

  const lines = session.lines ?? [];
  if (lines.length > 0) {
    const tableData: string[][] = lines.map((l: StockCountLineResponse) => [
      l.itemName,
      formatQty(l.systemQty),
      formatQty(l.countedQty),
      formatQtyVariance(l.varianceQty),
      l.unitCost != null ? l.unitCost.toFixed(2) : "—",
      formatQty(l.qtySold ?? 0),
      l.sellingPrice != null ? l.sellingPrice.toFixed(2) : "—",
    ]);

    autoTable(doc, {
      head: [
        [
          "Item",
          "System Qty",
          "Counted Qty",
          "Variance",
          "Unit Cost (KSH)",
          "Qty Sold",
          "Selling Price (KSH)",
        ],
      ],
      body: tableData,
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 50, 100] },
      columnStyles: {
        4: { halign: "left" },
        6: { halign: "left" },
      },
    });
    const meta = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    y = meta?.finalY ?? y;

    y += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, y);
    y += 8;

    const totalCountedValue = lines.reduce(
      (sum, l) => sum + l.countedQty * (l.sellingPrice ?? l.unitCost ?? 0),
      0
    );
    const totalSoldValue = lines.reduce(
      (sum, l) => sum + (l.qtySold ?? 0) * (l.sellingPrice ?? 0),
      0
    );
    const expectedSystemValue = lines.reduce(
      (sum, l) => sum + l.systemQty * (l.sellingPrice ?? 0),
      0
    );
    const totalVarianceValue = lines.reduce(
      (sum, l) =>
        sum + l.varianceQty * (l.sellingPrice ?? l.unitCost ?? 0),
      0
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const col1 = margin;
    const col2 = margin + 50;
    const col3 = margin + 100;
    const col4 = margin + 150;
    doc.text("Total value (counted)", col1, y);
    doc.text(formatKsh(totalCountedValue), col1, y + 6);
    doc.text("Total sold", col2, y);
    doc.text(formatKsh(totalSoldValue), col2, y + 6);
    doc.text("Expected (system)", col3, y);
    doc.text(formatKsh(expectedSystemValue), col3, y + 6);
    doc.text("Total variance", col4, y);
    const varianceStr =
      totalVarianceValue >= 0
        ? `+${formatKsh(totalVarianceValue)}`
        : formatKsh(totalVarianceValue);
    doc.setTextColor(
      totalVarianceValue > 0 ? 5 : totalVarianceValue < 0 ? 220 : 100,
      totalVarianceValue > 0 ? 150 : totalVarianceValue < 0 ? 53 : 100,
      totalVarianceValue > 0 ? 5 : totalVarianceValue < 0 ? 53 : 100
    );
    doc.text(varianceStr, col4, y + 6);
    doc.setTextColor(0, 0, 0);
    y += 16;
  } else {
    doc.text("No items counted.", margin, y);
    y += 8;
  }

  y += 8;
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleString("en-GB")} — ${appName} Stock Count`,
    margin,
    y
  );

  return doc;
}

export function downloadStockCountPdf(
  session: StockCountSessionResponse,
  branchName?: string | null,
  orgName?: string | null,
  appName = "XPOS"
): void {
  const doc = generateStockCountPdf(session, branchName, orgName, appName);
  const date = new Date(session.startedAt).toISOString().slice(0, 10);
  const filename = `stock-count-${date}-${session.id.slice(0, 8)}.pdf`;
  doc.save(filename);
}

export function shareStockCountPdf(
  session: StockCountSessionResponse,
  branchName?: string | null,
  orgName?: string | null,
  appName = "XPOS"
): void {
  const doc = generateStockCountPdf(session, branchName, orgName, appName);
  const blob = doc.output("blob");
  const file = new File(
    [blob],
    `stock-count-${session.id.slice(0, 8)}.pdf`,
    { type: "application/pdf" }
  );

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    navigator
      .share({
        title: "Stock Count Report",
        text: `Stock count ${session.status} — ${branchName ?? "Branch"}`,
        files: [file],
      })
      .catch(() => {
        downloadStockCountPdf(session, branchName, orgName, appName);
      });
  } else {
    downloadStockCountPdf(session, branchName, orgName, appName);
  }
}
