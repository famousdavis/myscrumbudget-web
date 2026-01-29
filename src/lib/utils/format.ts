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

export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a raw percentage value (e.g. 10.5 → "10.5%", -3.2 → "-3.2%").
 * Unlike formatPercent, this does NOT multiply by 100.
 */
export function formatPercentValue(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
