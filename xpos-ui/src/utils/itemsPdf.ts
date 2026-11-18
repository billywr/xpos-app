import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Item } from "@/types/catalog";
import { formatAmount } from "@/utils/formatCurrency";
import { formatDateTime } from "@/utils/formatDate";

export interface ItemsPdfItem {
  name: string;
  buyingPrice?: number | null;
  defaultSellingPrice?: number | null;
}

export interface ItemsPdfOptions {
  orgName?: string | null;
  categoryLabel?: string | null;
  searchQuery?: string | null;
  preserveOrder?: boolean;
  appName?: string;
}

export function generateItemsPdf(
  items: (Item | ItemsPdfItem)[],
  opts: ItemsPdfOptions = {}
): jsPDF {
  const { orgName, categoryLabel, searchQuery, preserveOrder, appName = "XPOS" } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;
  let y = margin;

  // Header Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Items Price List", margin, y);
  y += 8;

  // Metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (orgName) {
    doc.text(`Organization: ${orgName}`, margin, y);
    y += 5;
  }
  if (categoryLabel) {
    doc.text(`Category: ${categoryLabel}`, margin, y);
    y += 5;
  }
  if (searchQuery) {
    doc.text(`Search: "${searchQuery}"`, margin, y);
    y += 5;
  }
  const generatedDate = formatDateTime(new Date());
  doc.text(`Generated: ${generatedDate}`, margin, y);
  y += 5;
  doc.text(`Total Items: ${items.length}`, margin, y);
  y += 8;

  if (items.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.text("No items found.", margin, y);
  } else {
    // Sort items alphabetically by name unless caller provided pre-sorted items
    const sorted = preserveOrder
      ? items
      : [...items].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );

    const tableData = sorted.map((item, index) => [
      String(index + 1),
      item.name,
      item.buyingPrice != null ? formatAmount(item.buyingPrice) : "—",
      item.defaultSellingPrice != null ? formatAmount(item.defaultSellingPrice) : "—",
    ]);

    autoTable(doc, {
      head: [["No.", "Name", "Buying Price (KSH)", "Selling Price (KSH)"]],
      body: tableData,
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [17, 50, 100],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "left",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 16 },
        1: { halign: "left" },
        2: { halign: "right", cellWidth: 42 },
        3: { halign: "right", cellWidth: 42 },
      },
    });
  }

  // Footer / Page numbers across all pages
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" }
    );
    doc.text(
      `${appName} — Items Price List · ${items.length} items`,
      margin,
      pageHeight - 8
    );
  }
  doc.setTextColor(0);

  return doc;
}

export function downloadItemsPdf(
  items: (Item | ItemsPdfItem)[],
  opts: ItemsPdfOptions = {}
): void {
  const doc = generateItemsPdf(items, opts);
  const orgSlug = (opts.orgName ?? "items")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "items";
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`items-${orgSlug}-${stamp}.pdf`);
}
