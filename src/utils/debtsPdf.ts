import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CustomerDebtResponse } from "@/api/debts";

function formatKsh(amount: number): string {
  return `Ksh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
      formatKsh(d.amount),
      formatKsh(d.amountSettled ?? 0),
      formatKsh(d.outstanding),
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
          "Original",
          "Repaid",
          "Balance",
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
        2: { halign: "right" },
        3: {
          halign: "right",
          fontStyle: "bold",
          textColor: [5, 150, 105],
        },
        4: {
          halign: "right",
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
    doc.text("Total original", col1, y);
    doc.setFont("helvetica", "bold");
    doc.text(formatKsh(totalOriginal), col1, y + 6);
    doc.setFont("helvetica", "normal");

    doc.text("Total repaid", col2, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(5, 150, 105);
    doc.text(formatKsh(totalRepaid), col2, y + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    doc.text("Total outstanding", col3, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(formatKsh(totalOutstanding), col3, y + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 10;
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
