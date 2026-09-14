/** CSV export and import helpers. Browser-only — these touch the DOM. */

export type Column<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

/** RFC 4180 quoting: wrap when the value contains a comma, quote or newline. */
function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const head = columns.map((column) => escape(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => escape(column.value(row))).join(","));
  return [head, ...body].join("\r\n");
}

/**
 * Triggers a download. The BOM is deliberate: without it Excel opens UTF-8 CSV
 * as Latin-1 and mangles every manufacturer name with an accent in it.
 */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportCsv<T>(filename: string, rows: T[], columns: Column<T>[]) {
  downloadCsv(filename, toCsv(rows, columns));
  return rows.length;
}

/** A small, forgiving CSV reader: handles quotes, escaped quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ""));
}

export const stamp = () => new Date().toISOString().slice(0, 10);
