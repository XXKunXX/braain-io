"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, HardHat, CalendarDays, Hand, CheckCircle2, XCircle, MapPin, Loader2, Plus, X, Trash2 } from "lucide-react";
import type { ContactFormData } from "@/actions/contacts";
import { PAYMENT_TERM_PRESETS, generatePaymentTermText, type SkontoStep } from "@/lib/payment-terms";

const schema = z
  .object({
    companyName: z.string().optional().or(z.literal("")),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    type: z.enum(["COMPANY", "PRIVATE", "SUPPLIER"]),
    owner: z.string().optional().or(z.literal("")),
    notes: z.string().optional(),
    billingMode: z.enum(["PRO_LIEFERSCHEIN", "NACH_PROJEKTENDE", "PERIODISCH", "MANUELL"]),
    billingIntervalDays: z.coerce.number().int().positive().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "PRIVATE" && !data.companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name ist erforderlich",
        path: ["companyName"],
      });
    }
  });

const billingModeOptions = [
  {
    value: "PRO_LIEFERSCHEIN",
    label: "Pro Lieferschein",
    description: "Jeder LS → sofort Rechnungs-Entwurf",
    icon: FileText,
  },
  {
    value: "NACH_PROJEKTENDE",
    label: "Nach Projektende",
    description: "Alle LS nach Auftragsabschluss",
    icon: HardHat,
  },
  {
    value: "PERIODISCH",
    label: "Periodisch",
    description: "Alle LS nach einem Zeitraum",
    icon: CalendarDays,
  },
  {
    value: "MANUELL",
    label: "Manuell",
    description: "Keine automatische Bündelung",
    icon: Hand,
  },
] as const;

const typeLabels: Record<string, string> = {
  COMPANY: "Firma",
  PRIVATE: "Privatkunde",
  SUPPLIER: "Lieferant",
};

interface ContactFormProps {
  defaultValues?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  userNames?: string[];
}

function daysToDisplay(days: number | null | undefined): { value: number; unit: "days" | "weeks" | "months" } {
  if (!days) return { value: 1, unit: "weeks" };
  if (days % 30 === 0) return { value: days / 30, unit: "months" };
  if (days % 7 === 0) return { value: days / 7, unit: "weeks" };
  return { value: days, unit: "days" };
}

type NominatimResult = {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    country?: string;
  };
};

type AddressFill = { address: string; postalCode: string; city: string; country: string };

function AddressAutocomplete({ onSelect }: { onSelect: (a: AddressFill) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=at&q=${encodeURIComponent(val)}`;
        const res = await fetch(url, { headers: { "Accept-Language": "de", "User-Agent": "braain-io-crm/1.0" } });
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch { /* ignore */ }
      setLoading(false);
    }, 400);
  }

  function handleSelect(r: NominatimResult) {
    const a = r.address;
    const street = [a.road, a.house_number].filter(Boolean).join(" ");
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
    onSelect({
      address: street,
      postalCode: a.postcode ?? "",
      city,
      country: a.country ?? "Österreich",
    });
    setQuery(street);
    setOpen(false);
    setResults([]);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Adresse suchen…"
          className="h-10 rounded-lg border-gray-200 pl-9 pr-9"
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin pointer-events-none" />}
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {results.map((r, i) => {
            const a = r.address;
            const main = [a.road, a.house_number].filter(Boolean).join(" ") || r.display_name.split(",")[0];
            const sub = [a.postcode, a.city ?? a.town ?? a.village ?? a.municipality].filter(Boolean).join(" ");
            return (
              <li
                key={i}
                onMouseDown={() => handleSelect(r)}
                className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{main}</p>
                  {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Formats a +43 number into standard Austrian display format.
 *
 *  Mobile  (+43 6xx): +43 664 123 45 67
 *  Vienna  (+43 1xx): +43 1 234 56 78
 *  Other   (+43 2-9): +43 316 123 456   (3-digit area code)
 */
function formatAustrianPhone(raw: string): string {
  // Normalise: strip all non-digit/plus, convert 00 or leading 0 to +43
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (digits.startsWith("0")) digits = "+43" + digits.slice(1);
  if (!digits.startsWith("+")) digits = "+43" + digits;

  if (!digits.startsWith("+43")) return raw; // foreign number — leave as-is

  const sub = digits.slice(3); // subscriber number without country code
  if (!sub) return "";

  // Mobile: starts with 6 (650 660 664 676 677 678 680 681 688 699 …)
  // Format: +43 6XX XXX XX XX
  if (sub.startsWith("6") && sub.length >= 10) {
    const area = sub.slice(0, 3);
    const r = sub.slice(3);
    return `+43 ${area} ${r.slice(0, 3)} ${r.slice(3, 5)} ${r.slice(5)}`.trim();
  }

  // Vienna: starts with 1
  // Format: +43 1 XXX XX XX
  if (sub.startsWith("1") && sub.length >= 8) {
    const r = sub.slice(1);
    return `+43 1 ${r.slice(0, 3)} ${r.slice(3, 5)} ${r.slice(5)}`.trim();
  }

  // Other landlines — 3-digit area code
  // Format: +43 XXX XXX XXX
  if (sub.length >= 9) {
    const area = sub.slice(0, 3);
    const r = sub.slice(3);
    const p1 = r.slice(0, 3);
    const p2 = r.slice(3);
    return `+43 ${area} ${p1}${p2 ? " " + p2 : ""}`.trim();
  }

  // Short / incomplete — just tidy with a space after +43
  return `+43 ${sub}`;
}

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const PREFIX = "+43 ";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!raw) { onChange(""); return; }

    if (!raw.startsWith("+")) {
      const digits = raw.replace(/^0+/, "");
      onChange(digits ? PREFIX + digits : "");
      return;
    }

    // Strip leading 0 after prefix: "+43 0664" → "+43 664"
    const cleaned = raw.replace(/^(\+\d+\s?)0+/, "$1");
    onChange(cleaned);
  }

  function handleFocus() {
    if (!value) onChange(PREFIX);
  }

  function handleBlur() {
    if (!value || value === PREFIX || value === "+43") { onChange(""); return; }
    const formatted = formatAustrianPhone(value);
    onChange(formatted);
  }

  return (
    <Input
      type="tel"
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className="h-10 rounded-lg border-gray-200"
      placeholder="+43 664 …"
    />
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function EmailInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [touched, setTouched] = useState(false);
  const isValid = EMAIL_RE.test(value);
  const showError = touched && value.length > 0 && !isValid;
  const showOk = touched && value.length > 0 && isValid;

  return (
    <div className="relative">
      <Input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        className="h-10 rounded-lg border-gray-200 pr-9"
      />
      {showOk && <CheckCircle2 className="absolute right-2.5 top-[11px] h-4 w-4 text-green-500 pointer-events-none" />}
      {showError && <XCircle className="absolute right-2.5 top-[11px] h-4 w-4 text-red-400 pointer-events-none" />}
      {showError && <p className="text-xs text-red-500 mt-1">Ungültige E-Mail-Adresse</p>}
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </Label>
  );
}

export function ContactForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
  userNames = [],
}: ContactFormProps) {
  const initialDisplay = daysToDisplay(defaultValues?.billingIntervalDays);
  const [intervalValue, setIntervalValue] = useState(initialDisplay.value);
  const [intervalUnit, setIntervalUnit] = useState<"days" | "weeks" | "months">(initialDisplay.unit);

  const [ptDays, setPtDays] = useState<number | null>(defaultValues?.paymentTermDays ?? 14);
  const [ptSkonto, setPtSkonto] = useState<SkontoStep[]>(
    Array.isArray(defaultValues?.paymentTermSkonto) ? (defaultValues.paymentTermSkonto as SkontoStep[]) : []
  );
  const [ptCustom, setPtCustom] = useState(defaultValues?.paymentTermCustom ?? "");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "Österreich", type: "COMPANY", billingMode: "MANUELL", ...defaultValues },
  });

  const type = watch("type");
  const billingMode = watch("billingMode");

  function updateIntervalDays(val: number, unit: "days" | "weeks" | "months") {
    const days = unit === "days" ? val : unit === "weeks" ? val * 7 : val * 30;
    setValue("billingIntervalDays", days);
  }

  return (
    <form onSubmit={handleSubmit((data) => onSubmit({ ...data, paymentTermDays: ptDays, paymentTermSkonto: ptSkonto, paymentTermCustom: ptCustom || null }))} className="space-y-0">

      {/* ── Section: Stammdaten ── */}
      <div className="space-y-4 pb-6">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Stammdaten</p>

        {/* Row 1: Typ + (empty) */}
        <div className="grid grid-cols-12 gap-x-4 gap-y-4">
          <div className="col-span-4 space-y-1.5">
            <FieldLabel required>Kontakttyp</FieldLabel>
            <Select
              value={type}
              onValueChange={(v) => v && setValue("type", v as ContactFormData["type"])}
            >
              <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                <SelectValue>{typeLabels[type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Firmenname (only COMPANY / SUPPLIER) */}
        {type !== "PRIVATE" && (
          <div className="grid grid-cols-12 gap-x-4">
            <div className="col-span-12 space-y-1.5">
              <FieldLabel required>Firmenname</FieldLabel>
              <Input {...register("companyName")} className="h-10 rounded-lg border-gray-200" placeholder="z. B. Muster GmbH" />
              {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName.message}</p>}
            </div>
          </div>
        )}

        {/* Row 3+4: Vorname/Telefon | Nachname/E-Mail — gleiche Spaltenbreiten */}
        <div className="grid grid-cols-12 gap-x-4 gap-y-4">
          <div className="col-span-5 space-y-1.5">
            <FieldLabel required={type === "PRIVATE"}>Vorname</FieldLabel>
            <Input {...register("firstName")} className="h-10 rounded-lg border-gray-200" placeholder="Vorname" />
          </div>
          <div className="col-span-7 space-y-1.5">
            <FieldLabel required={type === "PRIVATE"}>Nachname</FieldLabel>
            <Input {...register("lastName")} className="h-10 rounded-lg border-gray-200" placeholder="Nachname" />
          </div>
          <div className="col-span-5 space-y-1.5">
            <FieldLabel>Telefon</FieldLabel>
            <PhoneInput
              value={watch("phone") ?? ""}
              onChange={(v) => setValue("phone", v)}
            />
          </div>
          <div className="col-span-7 space-y-1.5">
            <FieldLabel>E-Mail</FieldLabel>
            <EmailInput
              value={watch("email") ?? ""}
              onChange={(v) => setValue("email", v)}
              placeholder="name@firma.at"
            />
          </div>
        </div>

        {/* Row 5: Owner */}
        {userNames.length > 0 && (
          <div className="grid grid-cols-12 gap-x-4">
            <div className="col-span-5 space-y-1.5">
              <FieldLabel>Zuständig</FieldLabel>
              <Select
                value={watch("owner") ?? ""}
                onValueChange={(v) => setValue("owner", v == null || v === "__none__" ? undefined : v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                  <SelectValue>{watch("owner") || <span className="text-gray-400">Kein Owner</span>}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Kein Owner</SelectItem>
                  {userNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* ── Section: Adresse ── */}
      <div className="space-y-4 py-6 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Adresse</p>

        {/* Suche */}
        <AddressAutocomplete
          onSelect={(a) => {
            setValue("address", a.address);
            setValue("postalCode", a.postalCode);
            setValue("city", a.city);
            setValue("country", a.country);
          }}
        />

        {/* Felder manuell korrigierbar */}
        <div className="grid grid-cols-12 gap-x-4">
          <div className="col-span-12 space-y-1.5">
            <FieldLabel>Straße &amp; Hausnummer</FieldLabel>
            <Input {...register("address")} className="h-10 rounded-lg border-gray-200" placeholder="Musterstraße 12" />
          </div>
        </div>
        <div className="grid grid-cols-12 gap-x-4">
          <div className="col-span-3 space-y-1.5">
            <FieldLabel>PLZ</FieldLabel>
            <Input {...register("postalCode")} className="h-10 rounded-lg border-gray-200" placeholder="1010" />
          </div>
          <div className="col-span-6 space-y-1.5">
            <FieldLabel>Stadt</FieldLabel>
            <Input {...register("city")} className="h-10 rounded-lg border-gray-200" placeholder="Wien" />
          </div>
          <div className="col-span-3 space-y-1.5">
            <FieldLabel>Land</FieldLabel>
            <Input {...register("country")} className="h-10 rounded-lg border-gray-200" />
          </div>
        </div>
      </div>

      {/* ── Section: Notizen ── */}
      <div className="space-y-4 py-6 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Notizen</p>
        <Textarea
          {...register("notes")}
          rows={3}
          className="rounded-lg border-gray-200 resize-none text-sm"
          placeholder="Interne Anmerkungen zum Kontakt…"
        />
      </div>

      {/* ── Section: Abrechnung ── */}
      <div className="space-y-3 py-6 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Lieferschein-Abrechnung</p>
        <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {billingModeOptions.map(({ value, label, icon: Icon }) => {
            const selected = billingMode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setValue("billingMode", value as ContactFormData["billingMode"])}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selected ? "bg-blue-50" : "bg-white hover:bg-gray-50"}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${selected ? "text-blue-500" : "text-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${selected ? "text-blue-700" : "text-gray-700"}`}>{label}</span>
                  <p className={`text-xs mt-0.5 ${selected ? "text-blue-500" : "text-gray-400"}`}>
                    {billingModeOptions.find((o) => o.value === value)?.description}
                  </p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-blue-500" : "border-gray-300"}`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
              </button>
            );
          })}
        </div>

        {billingMode === "PERIODISCH" && (
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-sm text-gray-500 shrink-0">Alle</span>
            <Input
              type="number" min={1} value={intervalValue}
              onChange={(e) => { const v = Math.max(1, parseInt(e.target.value, 10) || 1); setIntervalValue(v); updateIntervalDays(v, intervalUnit); }}
              className="h-9 w-20 rounded-lg text-center"
            />
            <select
              value={intervalUnit}
              onChange={(e) => { const u = e.target.value as "days" | "weeks" | "months"; setIntervalUnit(u); updateIntervalDays(intervalValue, u); }}
              className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-600 focus:outline-none focus:border-blue-400"
            >
              <option value="days">Tage</option>
              <option value="weeks">Wochen</option>
              <option value="months">Monate</option>
            </select>
          </div>
        )}
      </div>

      {/* ── Section: Zahlungsbedingungen ── */}
      <div className="space-y-4 py-6 border-t border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Zahlungsbedingungen</p>

        {/* Zahlungsziel */}
        <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {PAYMENT_TERM_PRESETS.map((preset) => {
            const selected = ptDays === preset.days;
            return (
              <button
                key={String(preset.days)}
                type="button"
                onClick={() => { setPtDays(preset.days); if (preset.days === null) setPtSkonto([]); }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${selected ? "bg-blue-50" : "bg-white hover:bg-gray-50"}`}
              >
                <span className={`text-sm font-medium ${selected ? "text-blue-700" : "text-gray-700"}`}>{preset.label}</span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-blue-500" : "border-gray-300"}`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Skonto */}
        {ptDays !== null && (
          <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {ptSkonto.map((step, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-3 bg-white">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-xs text-gray-400 shrink-0">bei</span>
                  <input
                    type="number" min={1} max={ptDays - 1} value={step.days}
                    onChange={(e) => setPtSkonto(ptSkonto.map((s, idx) => idx === i ? { ...s, days: Number(e.target.value) } : s))}
                    className="w-14 h-8 text-xs text-center border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 bg-gray-50"
                  />
                  <span className="text-xs text-gray-400 shrink-0">Tagen →</span>
                  <input
                    type="number" min={0.1} max={10} step={0.5} value={step.percent}
                    onChange={(e) => setPtSkonto(ptSkonto.map((s, idx) => idx === i ? { ...s, percent: Number(e.target.value) } : s))}
                    className="w-14 h-8 text-xs text-center border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 bg-gray-50"
                  />
                  <span className="text-xs text-gray-400 shrink-0">% Skonto</span>
                </div>
                <button type="button" onClick={() => setPtSkonto(ptSkonto.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition-colors shrink-0 p-0.5">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {ptSkonto.length < 3 && (
              <button
                type="button"
                onClick={() => setPtSkonto([...ptSkonto, { days: Math.max(1, Math.floor((ptDays ?? 30) / 2)), percent: 2 }])}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white"
              >
                <Plus className="h-3 w-3" />Skonto-Stufe hinzufügen
              </button>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Vorschau Rechnungstext</p>
          <p className="text-xs text-gray-700 leading-relaxed">
            {generatePaymentTermText({ paymentTermDays: ptDays, paymentTermSkonto: ptSkonto, paymentTermCustom: ptCustom || null })}
          </p>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-lg">
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-6">
          {isLoading ? "Speichert…" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
