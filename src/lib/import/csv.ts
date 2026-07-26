/**
 * CSV serialization for the import report. The report is built entirely from an
 * untrusted file's contents and is meant to be opened by a human, so every
 * field goes through two independent escapes.
 */

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than
 * text. A uTab entry titled `=HYPERLINK("http://evil","click")` would otherwise
 * execute when the report is opened in Excel or Sheets.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Characters that require RFC 4180 quoting to keep the file parseable. */
const NEEDS_QUOTING = /[",\r\n]/;

/**
 * Escapes one field. The two escapes compose in a fixed order: decide the
 * formula prefix from the *raw* value first, then quote the prefixed result.
 * Reversing them would put the prefix outside the quotes, which stops the file
 * parsing as CSV — and prefixing a value that was already quoted would no
 * longer defuse the formula, since the leading character a spreadsheet sees is
 * the one inside the quotes.
 */
export function escapeCsvField(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const prefixed = FORMULA_LEAD.test(value) ? `'${value}` : value;
  if (!NEEDS_QUOTING.test(prefixed)) {
    return prefixed;
  }
  return `"${prefixed.replaceAll('"', '""')}"`;
}

/**
 * Serializes a header and rows into CSV text. Rows are joined with CRLF per
 * RFC 4180. Built by joining arrays rather than by repeated string
 * concatenation, for the same reason blobToDataUrl chunks its encoding: a
 * thousand-row report should not cost a thousand intermediate strings.
 */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | undefined)[])[],
): string {
  const lines = [header.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\r\n");
}
