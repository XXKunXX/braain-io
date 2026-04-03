"use client";

import { useState } from "react";
import { Pencil, Settings2 } from "lucide-react";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updatePaymentTerm } from "@/actions/contacts";
import {
  generatePaymentTermText,
  parseSkontoFromJson,
  type SkontoStep,
} from "@/lib/payment-terms";

type ContactPaymentTerm = {
  id: string;
  paymentTermDays: number | null;
  paymentTermSkonto: unknown;
  paymentTermCustom: string | null;
};

const DAY_PRESETS = [
  { label: "Sofort fällig", days: null as number | null },
  { label: "14 Tage", days: 14 },
  { label: "30 Tage", days: 30 },
  { label: "60 Tage", days: 60 },
];

export function PaymentTermsWidget({ contact, onEditContact }: { contact: ContactPaymentTerm; onEditContact?: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<number | null>(contact.paymentTermDays ?? 14);

  useEscapeKey(handleCancel, isEditing);

  function handleCancel() {
    setDays(contact.paymentTermDays ?? 14);
    setIsEditing(false);
  }

  async function handleSave() {
    const existingSkonto = parseSkontoFromJson(contact.paymentTermSkonto) as SkontoStep[];
    setSaving(true);
    const result = await updatePaymentTerm(contact.id, {
      paymentTermDays: days,
      paymentTermSkonto: existingSkonto,
      paymentTermCustom: contact.paymentTermCustom || null,
    });
    setSaving(false);
    if (result.error) { toast.error(typeof result.error === "string" ? result.error : "Fehler beim Speichern"); return; }
    toast.success("Zahlungsziel gespeichert");
    setIsEditing(false);
  }

  const savedSkonto = parseSkontoFromJson(contact.paymentTermSkonto) as SkontoStep[];
  const savedText = generatePaymentTermText({
    paymentTermDays: contact.paymentTermDays ?? null,
    paymentTermSkonto: savedSkonto,
    paymentTermCustom: contact.paymentTermCustom,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
          Zahlungsbedingungen
        </h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
            title="Zahlungsziel ändern"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!isEditing ? (
        /* ── View mode ── */
        <div className="px-5 py-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
              {contact.paymentTermDays === null ? "Sofort fällig" : `${contact.paymentTermDays} Tage`}
            </span>
            {savedSkonto.map((s, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-xs font-medium text-blue-700">
                {s.percent}% Skonto bei {s.days} Tagen
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{savedText}</p>
          {onEditContact && (
            <button
              onClick={onEditContact}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors mt-1"
            >
              <Settings2 className="h-3 w-3" />
              Skonto &amp; weitere Optionen
            </button>
          )}
        </div>
      ) : (
        /* ── Edit mode: only Zahlungsziel ── */
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {DAY_PRESETS.map((preset) => {
              const selected = days === preset.days;
              return (
                <button
                  key={String(preset.days)}
                  type="button"
                  onClick={() => setDays(preset.days)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${selected ? "bg-blue-50" : "bg-white hover:bg-gray-50"}`}
                >
                  <span className={`text-xs font-medium ${selected ? "text-blue-700" : "text-gray-700"}`}>{preset.label}</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-blue-500" : "border-gray-300"}`}>
                    {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </button>
              );
            })}
          </div>

          {onEditContact && (
            <button
              onClick={() => { handleCancel(); onEditContact(); }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Settings2 className="h-3 w-3" />
              Skonto &amp; weitere Optionen
            </button>
          )}

          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 rounded-lg text-xs h-8 bg-blue-600 hover:bg-blue-700">
              {saving ? "Speichert…" : "Speichern"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="rounded-lg text-xs h-8 px-3">
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
