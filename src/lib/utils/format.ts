const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFormatterCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number, showCents = false): string {
  return showCents
    ? currencyFormatterCents.format(value)
    : currencyFormatter.format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a raw percentage value (e.g. 10.5 → "10.5%", -3.2 → "-3.2%").
 * Does NOT multiply by 100 — pass the already-computed percentage.
 */
export function formatPercentValue(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/* ── Date formatting ─────────────────────────────────────────────── */

/** Parse a YYYY-MM-DD string into a local Date (avoids timezone shifts). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "01/15/2026" — compact tabular format */
export function formatDateSlash(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

/** "January 15, 2026" — full prose format (changelog) */
export function formatDateLong(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** "Jan 15, 2026" — medium format (project summary) */
export function formatDateMedium(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
