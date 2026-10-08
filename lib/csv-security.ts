/**
 * Sanitizes a CSV cell value to neutralize spreadsheet formula injection attacks (SEC / Issue #24).
 * If a cell string starts with a formula trigger character (=, +, -, @, tab, or carriage return),
 * prepends a single quote (') so spreadsheet applications (Excel, LibreOffice) treat it as literal text.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  // Match formula trigger at start of string or after leading whitespace
  if (/^\s*[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
