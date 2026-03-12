"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { createQuote } from "@/actions/quotes";
import { toast } from "sonner";
import type { Contact, Request } from "@prisma/client";

const UNITS = ["t", "m³", "m²", "m", "Stk", "Std", "Psch"];

interface EditItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface Props {
  contacts: Contact[];
  userNames: string[];
  prefillContactId?: string;
  prefillRequest?: (Request & { contact: Contact }) | null;
}

export function NewQuoteClient({ contacts, userNames, prefillContactId, prefillRequest }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [contactId, setContactId] = useState(prefillContactId ?? prefillRequest?.contactId ?? "");
  const [title, setTitle] = useState(prefillRequest?.title ?? "");
  const [siteAddress, setSiteAddress] = useState(prefillRequest?.siteAddress ?? "");
  const [assignedTo, setAssignedTo] = useState(prefillRequest?.assignedTo ?? "");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EditItem[]>([
    { description: "", quantity: 1, unit: "t", unitPrice: 0 },
  ]);

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function addItem() {
    setItems([...items, { description: "", quantity: 1, unit: "t", unitPrice: 0 }]);
  }
  function removeItem(idx: number) {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, field: keyof EditItem, value: string | number) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Bitte Kontakt auswählen"); return; }
    setLoading(true);
    const result = await createQuote({
      title,
      contactId,
      requestId: prefillRequest?.id,
      siteAddress: siteAddress || undefined,
      assignedTo: assignedTo || undefined,
      validUntil: validUntil || undefined,
      notes: notes || undefined,
      items,
    });
    setLoading(false);
    if (result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Angebot erstellt");
    router.push(`/angebote/${result.quote?.id}`);
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <Link href="/angebote" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Alle Angebote
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Neues Angebot</h1>
          {prefillRequest && (
            <p className="text-sm text-gray-500 mt-0.5">
              Aus Anfrage: {prefillRequest.title}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-6">
        <div className="max-w-3xl space-y-5">
          {/* Angebotsinformationen */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Angebotsinformationen</h2>
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Projektname *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="h-10 rounded-lg border-gray-200" placeholder="Angebotsbeschreibung" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakt *</Label>
                  <Select value={contactId} onValueChange={(v) => v && setContactId(v)}>
                    <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                      <SelectValue placeholder="Kontakt wählen...">
                        {contacts.find((c) => c.id === contactId)?.companyName ?? <span className="text-gray-400">Kontakt wählen...</span>}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Baustellenadresse</Label>
                  <Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Gültig bis</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Owner</Label>
                <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v == null || v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                    <SelectValue>{assignedTo || <span className="text-gray-400">Kein Owner</span>}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Kein Owner</SelectItem>
                    {userNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Positionen */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Positionen</h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />Position
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase px-1">
                <div className="col-span-4">Beschreibung</div>
                <div className="col-span-2">Menge</div>
                <div className="col-span-2">Einheit</div>
                <div className="col-span-2">EP (€)</div>
                <div className="col-span-1 text-right">GP (€)</div>
                <div className="col-span-1" />
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-4 text-sm h-9" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Sand, Kies, Transport..." required />
                  <Input className="col-span-2 text-sm h-9" type="number" min="0" step="0.001" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                  <Select value={item.unit} onValueChange={(v) => v && updateItem(idx, "unit", v)}>
                    <SelectTrigger className="col-span-2 text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="col-span-2 text-sm h-9" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} />
                  <div className="col-span-1 flex items-center justify-end text-sm font-mono text-gray-600">
                    {(item.quantity * item.unitPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-2 border-t border-gray-100 text-sm font-semibold text-gray-900">
                Gesamt: {total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </div>
            </div>
          </div>

          {/* Notizen */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-lg border-gray-200 resize-none" placeholder="Hinweise zum Angebot..." />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pb-6">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => router.back()}>Abbrechen</Button>
            <Button type="submit" disabled={loading || !contactId || !title} className="rounded-lg bg-blue-600 hover:bg-blue-700">
              {loading ? "Erstelle..." : "Angebot erstellen"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
