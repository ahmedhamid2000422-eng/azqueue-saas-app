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
  if (!csv) return; // nothing to download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // `target="_blank"` ensures that if the browser navigates instead of
  // downloading, it opens a new tab rather than wiping the SPA.
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.cssText = "position:fixed;visibility:hidden;";
  document.body.appendChild(a);
  // Use a non-bubbling MouseEvent so React Router's document-level click
  // listener never intercepts this and tries to handle the blob URL as an
  // SPA navigation — that was causing the white-screen on Bookings.
  a.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true, view: window }));
  // Defer cleanup: some browsers (Safari on kiosk iPads) cancel a download
  // if the <a> is removed from the DOM before the transfer has started.
  setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

/** Suggest a filename of the form "azqueue-{branch}-{kind}-YYYY-MM-DD.csv" */
export function exportFilename(branchSlug, kind) {
  const d = new Date().toISOString().slice(0, 10);
  return `azqueue-${branchSlug || "all"}-${kind}-${d}.csv`;
}
