import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

/** Rough plain-text extraction from a rendered cell (handles plain strings,
 *  numbers, and simple JSX like <StatusBadge>/<span className="mono">) —
 *  good enough for export/search, not a full DOM-to-text engine. */
export function cellText(node: ReactNode): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  try {
    const html = renderToStaticMarkup(node as React.ReactElement);
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Exports rows as a CSV file (opens cleanly in Excel). */
export function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers, ...rows].map((row) => row.map(escape).join(','));
  downloadBlob(`${filename}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

/** Opens a print-friendly window with the table and triggers the browser's
 *  print dialog — the user picks "Save as PDF" there (no PDF library needed). */
export function printTable(title: string, headers: string[], rows: string[][]) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${esc(title)}</title>
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; color: #22262f; }
          h1 { font-size: 18px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
          th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e6e1d6; }
          th { color: #6b7180; font-weight: 600; text-transform: uppercase; font-size: 10.5px; }
        </style>
      </head>
      <body>
        <h1>${esc(title)}</h1>
        <table>
          <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
