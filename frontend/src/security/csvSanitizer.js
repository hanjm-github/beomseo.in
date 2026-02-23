/**
 * @file src/security/csvSanitizer.js
 * @description Spreadsheet-safe CSV cell encoding utilities.
 */

const FORMULA_PREFIX_RE = /^[=+\-@]/;
const CONTROL_PREFIX_RE = /^[\t\r]/;

function normalizeCsvValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * neutralizeSpreadsheetFormula module entry point.
 */
export function neutralizeSpreadsheetFormula(value) {
  const text = normalizeCsvValue(value);
  if (!text) return text;
  if (FORMULA_PREFIX_RE.test(text) || CONTROL_PREFIX_RE.test(text)) {
    return `'${text}`;
  }
  return text;
}

/**
 * escapeCsvCell module entry point.
 */
export function escapeCsvCell(value) {
  const safeText = neutralizeSpreadsheetFormula(value);
  if (/[",\n]/.test(safeText)) {
    return `"${safeText.replace(/"/g, '""')}"`;
  }
  return safeText;
}

