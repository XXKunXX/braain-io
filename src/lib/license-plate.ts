/**
 * Formats an Austrian/German license plate.
 * Groups consecutive letters and digits with spaces.
 * e.g. "W12345A" → "W 12345 A", "WN12345AB" → "WN 12345 AB"
 */
export function formatLicensePlate(value: string): string {
  const clean = value.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10);
  const groups = clean.match(/[A-Z]+|[0-9]+/g) ?? [];
  return groups.join(" ");
}
