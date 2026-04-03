export type SkontoStep = { days: number; percent: number };

export type PaymentTermConfig = {
  paymentTermDays: number | null;
  paymentTermSkonto: SkontoStep[] | null;
  paymentTermCustom: string | null;
};

export const PAYMENT_TERM_PRESETS = [
  { label: "Sofort netto", days: null as number | null },
  { label: "14 Tage netto", days: 14 },
  { label: "30 Tage netto", days: 30 },
  { label: "60 Tage netto", days: 60 },
];

export function generatePaymentTermText(config: PaymentTermConfig): string {
  if (config.paymentTermCustom?.trim()) return config.paymentTermCustom.trim();

  const days = config.paymentTermDays;
  const skonto = config.paymentTermSkonto ?? [];

  const base =
    days === null
      ? "Zahlbar sofort netto."
      : `Zahlbar innerhalb von ${days} Tagen netto.`;

  if (skonto.length === 0) return base;

  const skontoText = skonto
    .map(
      (s) =>
        `bei Zahlung binnen ${s.days} Tagen gewähren wir ${s.percent
          .toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} % Skonto`
    )
    .join(", ");

  return `${base} Bei ${skontoText.charAt(0).toUpperCase()}${skontoText.slice(1)}.`;
}

export function parseSkontoFromJson(raw: unknown): SkontoStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is SkontoStep =>
        s !== null &&
        typeof s === "object" &&
        typeof (s as Record<string, unknown>).days === "number" &&
        typeof (s as Record<string, unknown>).percent === "number"
    )
    .slice(0, 3);
}

export function getPresetLabel(days: number | null): string {
  const preset = PAYMENT_TERM_PRESETS.find((p) => p.days === days);
  return preset?.label ?? "Individuell";
}

export function validateSkontoSteps(
  steps: SkontoStep[],
  netDays: number | null
): string | null {
  for (const step of steps) {
    if (step.percent < 0.1 || step.percent > 10)
      return "Skonto-Prozentsatz muss zwischen 0,1 % und 10 % liegen.";
    if (netDays !== null && step.days >= netDays)
      return `Skonto-Tage (${step.days}) müssen kleiner als Zahlungsziel (${netDays}) sein.`;
  }
  return null;
}
