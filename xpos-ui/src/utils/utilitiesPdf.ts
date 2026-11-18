import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RecurringUtility } from "@/api/recurringUtilities";
import { formatAmount } from "@/utils/formatCurrency";
import { formatDateTime } from "@/utils/formatDate";

export interface UtilitiesPdfOptions {
  branchName?: string | null;
  orgName?: string | null;
  searchQuery?: string | null;
  statusFilterLabel?: string | null;
  appName?: string;
  totalMonthlyAmount?: number | null;
}

export function generateUtilitiesPdf(
  utilities: RecurringUtility[],
  opts: UtilitiesPdfOptions = {}
): jsPDF {
  const { branchName, orgName, searchQuery, statusFilterLabel, appName = "XPOS", totalMonthlyAmount } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Recurring Utility Bills Report", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(orgName ?? "Organization", margin, y);
  y += 5;
  doc.text(`Branch: ${branchName ?? "—"}`, margin, y);
  y += 5;
  if (statusFilterLabel) {
    doc.text(`Status filter: ${statusFilterLabel}`, margin, y);
    y += 5;
  }
  if (searchQuery) {
    doc.text(`Search: "${searchQuery}"`, margin, y);
    y += 5;
  }
  doc.text(`Generated: ${formatDateTime(new Date())}`, margin, y);
  y += 5;
  doc.text(`Total utilities: ${utilities.length}`, margin, y);
  y += 7;

  if (utilities.length === 0) {
    doc.text("No recurring utilities found.", margin, y);
    return doc;
  }

  const computedTotal = utilities
    .filter((u) => u.active)
    .reduce((sum, u) => sum + Number(u.amount), 0);
  const finalTotal = totalMonthlyAmount ?? computedTotal;

  const head = [
    [
      "#",
      "Utility Name",
      "Amount (KES)",
      "Deduction Timing",
      "Status",
      "Notes",
    ],
  ];

  const body = utilities.map((u, i) => [
    String(i + 1),
    u.name,
    formatAmount(Number(u.amount)),
    u.applyTiming === "END_OF_MONTH" ? "End of month (Last day)" : "Beginning of month (1st)",
    u.active ? "Active" : "Inactive",
    u.notes ?? "—",
  ]);

  const foot = [
    [
      "Total Active Monthly",
      "",
      formatAmount(finalTotal),
      "",
      "",
      "",
    ],
  ];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 65, fontStyle: "bold" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 50 },
      4: { cellWidth: 25 },
      5: { cellWidth: "auto" },
    },
    didDrawPage: (data) => {
      const pageNumber = data.pageNumber;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${appName} - Page ${pageNumber}`,
        doc.internal.pageSize.getWidth() - margin - 20,
        doc.internal.pageSize.getHeight() - 8
      );
    },
  });

  return doc;
}
