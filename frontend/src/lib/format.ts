/**
 * Formatting helpers — mirror the Python `money()` / `percent()` helpers
 * from services/data_mapping.py so numbers read identically to the old app.
 */

export function money(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function percent(value: number | null | undefined): string {
  const fraction = Number(value ?? 0);
  return `${(fraction * 100).toFixed(2)}%`;
}
