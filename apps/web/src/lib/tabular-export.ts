export type ExportRow = Record<string, string | number | Date | null | undefined>;

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvExport(rows: ExportRow[]) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return `\uFEFF${[columns.map(escapeCsv).join(";"), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(";"))].join("\r\n")}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] ?? character);
}

export function excelHtmlExport(rows: ExportRow[], title: string) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>${escapeHtml(title)}</h1><table border="1"><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

function pdfEscape(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "?").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function simplePdfExport(rows: ExportRow[], title: string) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const lines = [title, columns.join(" | "), ...rows.slice(0, 120).map((row) => columns.map((column) => String(row[column] ?? "")).join(" | "))];
  const commands = lines.map((line, index) => `BT /F1 9 Tf 36 ${800 - index * 12} Td (${pdfEscape(line.slice(0, 150))}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
