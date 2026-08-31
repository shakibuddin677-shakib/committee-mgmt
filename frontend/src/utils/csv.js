// Builds a CSV string from an array of column defs and rows, then
// triggers a browser download. Kept dependency-free — this is a
// small, well-understood format and doesn't need a library.
export function downloadCsv(filename, columns, rows) {
  const escapeCell = (val) => {
    const s = val === undefined || val === null ? "" : String(val);
    // Quote any cell containing a comma, quote, or newline; double up internal quotes.
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.get(row))).join(","))
    .join("\r\n");

  // Prefix with a UTF-8 BOM so Excel renders Hindi text correctly.
  const csv = "\uFEFF" + header + "\r\n" + body;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
