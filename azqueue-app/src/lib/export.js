/**
 * CSV export helpers — no extra npm dependency. Quotes fields, escapes
 * embedded quotes, handles nulls, BOM-prefixes for Excel compatibility.
 */
export function toCSV(rows, columns) {
  if (!rows || rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const headerRow = cols.map((c) => quote(c.label ?? c)).join(",");
  const bodyRows = rows.map((row) =>
    cols.map((c) => {
      const key = c.key ?? c;
      const v = typeof c.format === "function" ? c.format(row[key], row) : row[key];
      return quote(v);
    }).join(",")
  );
  return "﻿" + [headerRow, ...bodyRows].join("\n");
}

function quote(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCSV(filename, rows, columns) {
  const csv = toCSV(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Suggest a filename of the form "azqueue-{branch}-{kind}-YYYY-MM-DD.csv" */
export function exportFilename(branchSlug, kind) {
  const d = new Date().toISOString().slice(0, 10);
  return `azqueue-${branchSlug || "all"}-${kind}-${d}.csv`;
}
