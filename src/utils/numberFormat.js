/**
 * Format digit string/number as Indonesian thousands-separated string.
 * e.g. "2000000" → "2.000.000", 500000 → "500.000"
 * Returns "" for empty/null/undefined input.
 */
export function formatRupiahInput(value) {
  if (value === '' || value === null || value === undefined) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('id-ID').format(Number(digits));
}

/**
 * Strip thousands separators and return a plain Number.
 * e.g. "2.000.000" → 2000000, "500000" → 500000
 * Returns 0 for empty/invalid input.
 */
export function parseRupiahInput(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const digits = String(value).replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}
