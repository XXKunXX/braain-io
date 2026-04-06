"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEscapeKey } from "@/hooks/use-escape-key";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { createInvoice } from "@/actions/invoices";
import { toast } from "sonner";
import type { Contact } from "@prisma/client";
import { generatePaymentTermText, parseSkontoFromJson } from "@/lib/payment-terms";
import { getContactName } from "@/lib/utils";

const UNITS = ["Stk", "t", "m³", "m²", "m", "Std", "Psch", "Pos"];

type Item = {
  id: number;
  description: string;
  note: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type OrderOption = {
  id: string;
  orderNumber: string;
  title: string;
  contactId: string;
};

let nextId = 1;
function newItem(): Item {
  return { id: nextId++, description: "", note: "", quantity: "", unit: "Stk", unitPrice: "" };
}

function calcTotal(quantity: string, unitPrice: string) {
  const q = parseFloat(quantity.replace(",", "."));
  const p = parseFloat(unitPrice.replace(",", "."));
  if (isNaN(q) || isNaN(p)) return null;
  return q * p;
}

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type PrefillItem = { description: string; note: string; quantity: string; unit: string; unitPrice: string };

export function CreateInvoiceForm({
  contacts,
  orders,
  defaultVatRate,
  prefillOrderId,
  prefillContactId,
  prefillItems,
}: {
  contacts: Contact[];
  orders: OrderOption[];
  defaultVatRate: number;
  prefillOrderId?: string;
  prefillContactId?: string;
  prefillItems?: PrefillItem[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  useEscapeKey(() => router.back(), true);

  const [contactId, setContactId] = useState(prefillContactId ?? "");
  const [orderId, setOrderId] = useState(prefillOrderId ?? "");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(today(), 14));
  const [headerText, setHeaderText] = useState("");

  function getContactFooterText(cId: string): string {
    const c = contacts.find((x) => x.id === cId) as (Contact & { paymentTermDays?: number | null; paymentTermSkonto?: unknown; paymentTermCustom?: string | null }) | undefined;
    if (!c) return "Zahlbar netto innerhalb von 30 Tagen nach Rechnungserhalt.";
    return generatePaymentTermText({
      paymentTermDays: c.paymentTermDays ?? 30,
      paymentTermSkonto: parseSkontoFromJson(c.paymentTermSkonto),
      paymentTermCustom: c.paymentTermCustom ?? null,
    });
  }

  const [footerText, setFooterText] = useState(() => getContactFooterText(prefillContactId ?? ""));

  useEffect(() => {
    if (contactId) setFooterText(getContactFooterText(contactId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(String(Math.round(defaultVatRate * 100)));

  const [items, setItems] = useState<Item[]>(() =>
    prefillItems && prefillItems.length > 0
      ? prefillItems.map((i) => ({ id: nextId++, ...i }))
      : [newItem()]
  );

  function handleOrderChange(val: string) {
    setOrderId(val);
    const order = orders.find((o) => o.id === val);
    if (order) setContactId(order.contactId);
  }

  function addItem() {
    setItems((prev) => [...prev, newItem()]);
  }

  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }

  function updateItem(id: number, field: keyof Omit<Item, "id">, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  const totalPrice = items.reduce((sum, i) => {
    const t = calcTotal(i.quantity, i.unitPrice);
    return sum + (t ?? 0);
  }, 0);

  const vatRateNum = parseFloat(vatRate) / 100;
  const vatAmount = totalPrice * vatRateNum;
  const grossAmount = totalPrice + vatAmount;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contactId) { toast.error("Bitte Kontakt auswählen"); return; }

    const validItems = items.filter((i) => i.description && i.quantity && i.unitPrice);
    if (validItems.length === 0) { toast.error("Bitte mindestens eine Position ausfüllen"); return; }

    setLoading(true);

    const result = await createInvoice({
      contactId,
      orderId: orderId || undefined,
      invoiceDate,
      dueDate: dueDate || undefined,
      headerText: headerText || undefined,
      footerText: footerText || undefined,
      notes: notes || undefined,
      vatRate: vatRateNum,
      items: validItems.map((i) => ({
        description: i.description,
        note: i.note || undefined,
        quantity: parseFloat(i.quantity.replace(",", ".")),
        unit: i.unit,
        unitPrice: parseFloat(i.unitPrice.replace(",", ".")),
      })),
    });

    setLoading(false);
    if ("error" in result) { toast.error("Fehler beim Erstellen der Rechnung"); return; }
    toast.success("Rechnung erstellt");
    router.push(`/rechnungen/${result.invoice.id}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-5">
        <Link
          href="/rechnungen"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zu Rechnungen
        </Link>
        {prefillOrderId && (() => {
          const order = orders.find((o) => o.id === prefillOrderId);
          return (
            <>
              <span className="text-gray-300">|</span>
              <Link
                href={`/auftraege/${prefillOrderId}`}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Zurück zu Auftrag {order?.orderNumber}{order?.title ? ` – ${order.title}` : ""}
              </Link>
            </>
          );
        })()}
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Neue Rechnung erstellen</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Verknüpfung */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Verknüpfung</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Auftrag (optional)</Label>
              <Select value={orderId} onValueChange={(v) => handleOrderChange(v ?? "")}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Auftrag wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">– Kein Auftrag –</SelectItem>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.orderNumber} – {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Kontakt *</Label>
              <Select value={contactId} onValueChange={(v) => v && setContactId(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Kontakt wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{getContactName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

        </div>

        {/* Rechnungsdetails */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Rechnungsdetails</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Rechnungsdatum *</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Fälligkeitsdatum</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">MwSt.-Satz (%)</Label>
            <Select value={vatRate} onValueChange={(v) => v && setVatRate(v)}>
              <SelectTrigger className="h-10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 % (Standard)</SelectItem>
                <SelectItem value="10">10 % (ermäßigt)</SelectItem>
                <SelectItem value="0">0 % (steuerfrei)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Freitextfelder */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Texte</h3>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Kopftext (optional)</Label>
            <Textarea
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="z.B. Sehr geehrte Damen und Herren, ..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Fußtext / Zahlungsbedingungen</Label>
            <Textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="z.B. Zahlbar netto innerhalb von 14 Tagen..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Interne Notizen (erscheinen nicht auf der Rechnung)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionale interne Anmerkungen..."
              rows={2}
            />
          </div>
        </div>

        {/* Positionen */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Positionen</h3>
          </div>

          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_110px_100px_32px] gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100">
            {["Beschreibung", "Menge", "Einheit", "Einzelpreis", "Gesamt", ""].map((h) => (
              <span key={h} className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {items.map((item) => {
              const total = calcTotal(item.quantity, item.unitPrice);
              return (
                <div key={item.id} className="px-5 py-2 space-y-1.5">
                  <div className="grid grid-cols-[1fr_80px_80px_110px_100px_32px] gap-2 items-center">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Beschreibung der Leistung"
                      className="h-9 text-sm"
                    />
                    <Input
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      placeholder="0"
                      className="h-9 text-sm text-right"
                    />
                    <Select value={item.unit} onValueChange={(v) => updateItem(item.id, "unit", v ?? "Stk")}>
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
                  <Input
                    value={item.note}
                    onChange={(e) => updateItem(item.id, "note", e.target.value)}
                    placeholder="Optionale Zusatzinfo zu dieser Position..."
                    className="h-8 text-xs text-gray-500 bg-gray-50"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Position hinzufügen
            </button>
            <div className="space-y-0.5 text-right">
              <p className="text-xs text-gray-500">
                Netto: {totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </p>
              <p className="text-xs text-gray-500">
                MwSt. ({vatRate} %): {vatAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </p>
              <p className="text-sm font-bold text-gray-900">
                Gesamt: {grossAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={loading || !contactId}
            className="min-w-44"
          >
            {loading ? "Erstellt..." : "Rechnung erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
