/**
 * Native .xlsx export — real Excel workbooks, not CSV with a different name.
 *
 * Uses the same (rows, columns) shape as downloadCSV in ./export.js, so any
 * existing CSV export can be switched to Excel by swapping the function call.
 *
 *   downloadXLSX("bookings.xlsx", rows, [
 *     { key: "time", label: "Time" },
 *     { key: "name", label: "Name" },
 *   ], { sheetName: "Bookings", title: "Bookings — Az Tax Services" });
 *
 * What you get over CSV:
 *   · Bold header row with a tinted background
 *   · Auto-sized columns (measured against content, capped at 60 chars)
 *   · Frozen header row, so headers stay visible when scrolling
 *   · Autofilter dropdowns on every column
 *   · Real numbers/dates stay typed instead of becoming text
 *
 * SheetJS is loaded lazily so it never lands in the main bundle — the import
 * only happens the first time someone actually exports.
 */

const HEADER_FILL = "F0EBDF"; // warm parchment, matches the AzQueue palette
const HEADER_FONT = "3A3527";

/** Coerce a value into something Excel should store natively. */
function typed(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v;
  const s = String(v);
  // Keep leading-zero and +-prefixed strings (phone numbers, IDs) as text
  if (/^[+0]/.test(s)) return s;
  // Plain integers/decimals become real numbers so SUM/AVERAGE work
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && String(n) === s) return n;
  }
  return s;
}

/**
 * Build and download an .xlsx file.
 *
 * @param {string} filename  e.g. "azqueue-bookings-2026-08-17.xlsx"
 * @param {object[]} rows    array of row objects
 * @param {Array} columns    [{ key, label, format? }] or plain string keys
 * @param {object} [opts]
 * @param {string} [opts.sheetName] worksheet tab name (max 31 chars)
 * @param {string} [opts.title]     optional title row above the headers
 */
export async function downloadXLSX(filename, rows, columns, opts = {}) {
  if (!rows || rows.length === 0) return false;

  const XLSX = await import("xlsx");

  const cols = (columns ?? Object.keys(rows[0])).map((c) =>
    typeof c === "string" ? { key: c, label: c } : c
  );

  const header = cols.map((c) => c.label ?? c.key);
  const body = rows.map((row) =>
    cols.map((c) => {
      const raw = typeof c.format === "function" ? c.format(row[c.key], row) : row[c.key];
      return typed(raw);
    })
  );

  const title = opts.title;
  const aoa = title ? [[title], [], header, ...body] : [header, ...body];
  const headerRowIdx = title ? 2 : 0; // zero-based row of the header

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Column widths — measure header + up to 200 rows of content ──────
  ws["!cols"] = cols.map((c, i) => {
    let width = String(header[i] ?? "").length;
    for (const r of body.slice(0, 200)) {
      const len = String(r[i] ?? "").length;
      if (len > width) width = len;
    }
    return { wch: Math.min(Math.max(width + 2, 10), 60) };
  });

  // ── Freeze the header row ───────────────────────────────────────────
  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 };
  ws["!panes"] = [{ state: "frozen", ySplit: headerRowIdx + 1, topLeftCell: `A${headerRowIdx + 2}` }];

  // ── Autofilter across the header row ────────────────────────────────
  const lastCol = XLSX.utils.encode_col(cols.length - 1);
  ws["!autofilter"] = { ref: `A${headerRowIdx + 1}:${lastCol}${headerRowIdx + 1 + body.length}` };

  // ── Style the title + header cells ──────────────────────────────────
  if (title) {
    const c = ws["A1"];
    if (c) c.s = { font: { bold: true, sz: 14, color: { rgb: HEADER_FONT } } };
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }];
  }
  for (let i = 0; i < cols.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c: i });
    const cell = ws[addr];
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: HEADER_FONT } },
      fill: { fgColor: { rgb: HEADER_FILL } },
      alignment: { vertical: "center" },
    };
  }

  const wb = XLSX.utils.book_new();
  const sheetName = (opts.sheetName ?? "Data").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, filename, { compression: true });
  return true;
}

/**
 * Multi-sheet workbook — pass an array of { name, rows, columns, title }.
 * Sheets with no rows are skipped.
 */
export async function downloadWorkbook(filename, sheets) {
  const usable = (sheets ?? []).filter((s) => s.rows && s.rows.length > 0);
  if (usable.length === 0) return false;

  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const sheet of usable) {
    const cols = (sheet.columns ?? Object.keys(sheet.rows[0])).map((c) =>
      typeof c === "string" ? { key: c, label: c } : c
    );
    const header = cols.map((c) => c.label ?? c.key);
    const body = sheet.rows.map((row) =>
      cols.map((c) => {
        const raw = typeof c.format === "function" ? c.format(row[c.key], row) : row[c.key];
        return typed(raw);
      })
    );
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws["!cols"] = cols.map((c, i) => {
      let width = String(header[i] ?? "").length;
      for (const r of body.slice(0, 200)) {
        const len = String(r[i] ?? "").length;
        if (len > width) width = len;
      }
      return { wch: Math.min(Math.max(width + 2, 10), 60) };
    });
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    for (let i = 0; i < cols.length; i++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: HEADER_FONT } },
          fill: { fgColor: { rgb: HEADER_FILL } },
        };
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, (sheet.name ?? "Sheet").slice(0, 31));
  }

  XLSX.writeFile(wb, filename, { compression: true });
  return true;
}
