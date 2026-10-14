/**
 * Utility for exporting report data to CSV with RFC 4180 compliance and UTF-8 BOM for Excel support.
 */

export interface CsvExportOptions {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  summaryRows?: (string | number | null | undefined)[][];
  metadata?: Array<{ label: string; value: string | number }>;
}

function escapeCsvCell(cell: string | number | null | undefined): string {
  if (cell === null || cell === undefined) return '';
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(options: CsvExportOptions): void {
  const { filename, headers, rows, summaryRows, metadata } = options;
  const lines: string[] = [];

  // Metadata Header lines (if provided, e.g. Scope, Export Date, Reporting Period)
  if (metadata && metadata.length > 0) {
    metadata.forEach((m) => {
      lines.push(`${escapeCsvCell(m.label)},${escapeCsvCell(m.value)}`);
    });
    lines.push(''); // Empty line before table
  }

  // Header row
  lines.push(headers.map(escapeCsvCell).join(','));

  // Data rows
  rows.forEach((row) => {
    lines.push(row.map(escapeCsvCell).join(','));
  });

  // Summary / Footer rows (e.g., Reconciled Total Amount)
  if (summaryRows && summaryRows.length > 0) {
    lines.push(''); // Spacer
    summaryRows.forEach((row) => {
      lines.push(row.map(escapeCsvCell).join(','));
    });
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
