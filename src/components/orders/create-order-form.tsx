"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrderWithDetails } from "@/actions/orders";
import { toast } from "sonner";
import type { Contact } from "@prisma/client";

const UNITS = ["t", "m³", "m²", "m", "Stk", "Std", "Psch"];

type Item = {
  id: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

function todayAt7() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T07:00`;
}

function calcTotal(quantity: string, unitPrice: string) {
  const q = parseFloat(quantity.replace(",", "."));
  const p = parseFloat(unitPrice.replace(",", "."));
  if (isNaN(q) || isNaN(p)) return null;
  return q * p;
}

let nextId = 1;
function newItem(): Item {
  return { id: nextId++, description: "", quantity: "", unit: "t", unitPrice: "" };
}

export function CreateOrderForm({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState("");

  // Baustelle
  const [showBaustelle, setShowBaustelle] = useState(false);
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  // Leistungen
  const [showLeistungen, setShowLeistungen] = useState(false);
  const [items, setItems] = useState<Item[]>([newItem()]);

  const totalPrice = items.reduce((sum, i) => {
    const t = calcTotal(i.quantity, i.unitPrice);
    return sum + (t ?? 0);
  }, 0);

  function addItem() {
    setItems((prev) => [...prev, newItem()]);
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: number, field: keyof Omit<Item, "id">, value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contactId) { toast.error("Bitte Kontakt auswählen"); return; }
    const form = new FormData(e.currentTarget);
    setLoading(true);

    const validItems = showLeistungen
      ? items.filter((i) => i.description && i.quantity && i.unitPrice)
      : [];

    const result = await createOrderWithDetails({
      title: form.get("title") as string,
      contactId,
      startDate: form.get("startDate") as string,
      endDate: form.get("endDate") as string,
      notes: form.get("notes") as string || undefined,
      baustelle: showBaustelle ? { address, postalCode, city } : undefined,
      items: validItems.length > 0 ? validItems.map((i) => ({
        description: i.description,
        quantity: parseFloat(i.quantity.replace(",", ".")),
        unit: i.unit,
        unitPrice: parseFloat(i.unitPrice.replace(",", ".")),
      })) : undefined,
    });

    setLoading(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Auftrag erstellt");
    router.push(`/auftraege/${result.order?.id}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Link
        href="/auftraege"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zu Aufträge
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Neuer Auftrag</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Allgemeine Angaben */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Allgemeine Angaben</h3>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Titel *</Label>
            <Input name="title" placeholder="z.B. Poolaushub Familie Muster" required className="h-10" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Kontakt *</Label>
            <Select value={contactId} onValueChange={(v) => v && setContactId(v)}>
              <SelectTrigger className="h-10">
                <SelectValue>
                  {contactId ? contacts.find(c => c.id === contactId)?.companyName : <span className="text-gray-400">Kontakt wählen...</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Startdatum *</Label>
              <Input name="startDate" type="datetime-local" required className="h-10" defaultValue={todayAt7()} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Enddatum *</Label>
              <Input name="endDate" type="datetime-local" required className="h-10" defaultValue={todayAt7()} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Notizen</Label>
            <Textarea name="notes" placeholder="Optionale Anmerkungen..." rows={2} />
          </div>
        </div>

        {/* Baustelladresse */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBaustelle(!showBaustelle)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span>Baustelladresse anlegen</span>
            <div className="flex items-center gap-2">
              {!showBaustelle && <span className="text-xs font-normal text-gray-400">Optional</span>}
              {showBaustelle ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </div>
          </button>

          {showBaustelle && (
            <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 pt-3">Die Baustelle wird automatisch mit diesem Auftrag und Kontakt verknüpft.</p>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Straße & Hausnummer</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="z.B. Musterstraße 12" className="h-10" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">PLZ</Label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="z.B. 1010" className="h-10" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Ort</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="z.B. Wien" className="h-10" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Leistungen & Auftragssumme */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowLeistungen(!showLeistungen)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span>Leistungen & Auftragssumme</span>
            <div className="flex items-center gap-2">
              {!showLeistungen && <span className="text-xs font-normal text-gray-400">Optional</span>}
              {showLeistungen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </div>
          </button>

          {showLeistungen && (
            <div className="border-t border-gray-100">
              <p className="text-xs text-gray-400 px-5 pt-3 pb-2">Die Leistungen werden als verknüpftes Angebot gespeichert.</p>

              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px_100px_90px_32px] gap-2 px-5 pb-1.5">
                {["Beschreibung", "Menge", "Einheit", "Einzelpreis", "Gesamt", ""].map((h) => (
                  <span key={h} className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                ))}
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-50">
                {items.map((item) => {
                  const total = calcTotal(item.quantity, item.unitPrice);
                  return (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_80px_100px_90px_32px] gap-2 items-center px-5 py-2">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        placeholder="z.B. Erdaushub"
                        className="h-9 text-sm"
                      />
                      <Input
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        placeholder="0"
                        className="h-9 text-sm text-right"
                      />
                      <Select value={item.unit} onValueChange={(v) => updateItem(item.id, "unit", v ?? "t")}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Input
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-sm text-right pr-7"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                      <p className="text-sm text-right text-gray-700 font-medium tabular-nums">
                        {total != null ? total.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Position hinzufügen
                </button>
                <div className="text-sm font-semibold text-gray-900">
                  Gesamt: {totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
          <LoadingButton
            type="submit"
            loading={loading}
            disabled={!contactId}
            className="min-w-36"
          >
            Auftrag erstellen
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
