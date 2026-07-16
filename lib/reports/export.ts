// Client-side report exports — no heavy deps. "Excel" is a UTF-8 BOM CSV
// (the same Excel-compatible pattern as the study-abroad leads export);
// "PDF" is the browser's print-to-PDF via window.print(), scoped by the
// .report-print-area rules in globals.css.

import type { ReportTable } from "./ownerReports";

/** Excel-compatible export: UTF-8 CSV with BOM, quoted cells. */
export function downloadReportCsv(table: ReportTable, filenameHint: string) {
  const rows = [table.columns, ...table.rows];
  const csv =
    "﻿" +
    rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameHint.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Print-to-PDF: everything except the .report-print-area is hidden by the
 * @media print rules in globals.css. */
export function printReport() {
  window.print();
}
