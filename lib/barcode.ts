/**
 * Barcode & ISBN Parsing and Validation Engine (Issue #43)
 * Pure helper functions for cleaning, validating, and converting ISBN barcodes.
 */

export function cleanScannedBarcode(raw: string): string {
  if (!raw) return "";
  return raw.replace(/[-\s]/g, "").trim();
}

export function validateIsbn10(isbn: string): boolean {
  const clean = cleanScannedBarcode(isbn).toUpperCase();
  if (!/^\d{9}[\dX]$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i], 10) * (10 - i);
  }
  const checksum = clean[9] === "X" ? 10 : parseInt(clean[9], 10);
  sum += checksum;

  return sum % 11 === 0;
}

export function validateIsbn13(isbn: string): boolean {
  const clean = cleanScannedBarcode(isbn);
  if (!/^\d{13}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return parseInt(clean[12], 10) === checkDigit;
}

export function isValidIsbn(code: string): boolean {
  const clean = cleanScannedBarcode(code);
  if (clean.length === 10) {
    return validateIsbn10(clean);
  }
  if (clean.length === 13) {
    return validateIsbn13(clean);
  }
  return false;
}

export function convertIsbn10To13(isbn10: string): string | null {
  const clean = cleanScannedBarcode(isbn10).toUpperCase();
  if (!validateIsbn10(clean)) return null;

  const core = "978" + clean.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(core[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return core + checkDigit.toString();
}

export function extractIsbnFromBarcodeText(text: string): string | null {
  if (!text) return null;
  const clean = cleanScannedBarcode(text);

  // Direct match
  if (isValidIsbn(clean)) return clean;

  // Search inside string for 13-digit EAN-13 starting with 978 or 979
  const match13 = text.match(/\b(97[89][-\s]?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?\d)\b/);
  if (match13) {
    const candidate = cleanScannedBarcode(match13[1]);
    if (validateIsbn13(candidate)) return candidate;
  }

  // Search for 10-digit ISBN
  const match10 = text.match(/\b(\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?[\dX])\b/i);
  if (match10) {
    const candidate = cleanScannedBarcode(match10[1]).toUpperCase();
    if (validateIsbn10(candidate)) return candidate;
  }

  return null;
}
