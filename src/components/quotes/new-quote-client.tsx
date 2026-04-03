"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { ArrowLeft, Plus, Trash2, X, Package, Wrench } from "lucide-react";
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
import { ContactCombobox } from "@/components/requests/contact-combobox";
import { createQuote } from "@/actions/quotes";
import { toast } from "sonner";
import type { Contact, Request, ContactNote } from "@prisma/client";
import type { MachineRow } from "@/actions/machines";

const UNITS = ["t", "m³", "m²", "m", "Stk", "Std", "Psch"];

interface EditItem {
  itemType: "produkt" | "maschine";
  description: string;
  note: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

type Product = { id: string; name: string; description: string | null; unit: string | null; price: number | null; quoteDescription: string | null };

interface Props {
  contacts: Contact[];
  userNames: string[];
  products: Product[];
  machines: MachineRow[];
  prefillContactId?: string;
  prefillRequest?: (Request & { contact: Contact; contactNotes?: (Omit<ContactNote, "createdAt"> & { createdAt: string })[] }) | null;
  defaultValidUntil?: string;
}

export function NewQuoteClient({ contacts, userNames, products, machines, prefillContactId, prefillRequest, defaultValidUntil }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  useEscapeKey(() => router.back(), true);

  // ── Contact ───────────────────────────────────────────────────────────────
  const [contactId, setContactId] = useState(prefillContactId ?? prefillRequest?.contactId ?? "");

  function handleContactChange(id: string) {
    setContactId(id);
    const c = contacts.find((c) => c.id === id);
    if (!c) return;
    if (!prefillRequest?.siteAddress && !siteAddress) {
      const addr = [c.address, [c.postalCode, c.city].filter(Boolean).join(" ")]
        .filter(Boolean).join(", ");
      if (addr) setSiteAddress(addr);
    }
    if (!prefillRequest?.assignedTo && !assignedTo && (c as Contact & { owner?: string }).owner) {
      setAssignedTo((c as Contact & { owner?: string }).owner!);
    }
  }

  // ── Other form fields ─────────────────────────────────────────────────────
  const [title, setTitle] = useState(prefillRequest?.title ?? "");
  const [siteAddress, setSiteAddress] = useState(prefillRequest?.siteAddress ?? "");
  const [assignedTo, setAssignedTo] = useState(prefillRequest?.assignedTo ?? "");
  const [validUntil, setValidUntil] = useState(defaultValidUntil ?? "");
  const [notes, setNotes] = useState(() => {
    if (!prefillRequest) return "";
    const parts: string[] = [];
    if (prefillRequest.description) parts.push(prefillRequest.description);
    if (prefillRequest.contactNotes && prefillRequest.contactNotes.length > 0) {
      parts.push(prefillRequest.contactNotes.map((n) => n.content).join("\n\n"));
    }
    return parts.join("\n\n");
  });
  const [items, setItems] = useState<EditItem[]>([
    { itemType: "produkt", description: "", note: "", quantity: 1, unit: "t", unitPrice: 0 },
  ]);

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function addItem() {
    setItems([...items, { itemType: "produkt", description: "", note: "", quantity: 1, unit: "t", unitPrice: 0 }]);
  }
  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, field: keyof EditItem, value: string | number) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function switchItemType(idx: number, type: "produkt" | "maschine") {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      if (type === "maschine") {
        return { ...item, itemType: type, description: "", unit: "Std", unitPrice: 0 };
      }
      return { ...item, itemType: type, description: "", unit: "t", unitPrice: 0 };
    }));
    setOpenProductIdx(null);
    setOpenMachineIdx(null);
  }

  // ── Product combobox per position ─────────────────────────────────────────
  const [openProductIdx, setOpenProductIdx] = useState<number | null>(null);
  const productRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (openProductIdx === null) return;
      const ref = productRefs.current[openProductIdx];
      if (ref && !ref.contains(e.target as Node)) setOpenProductIdx(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openProductIdx]);

  function getFilteredProducts(search: string) {
    if (!search) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }

  // ── Machine combobox per position ─────────────────────────────────────────
  const [openMachineIdx, setOpenMachineIdx] = useState<number | null>(null);
  const machineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (openMachineIdx === null) return;
      const ref = machineRefs.current[openMachineIdx];
      if (ref && !ref.contains(e.target as Node)) setOpenMachineIdx(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMachineIdx]);

  function getFilteredMachines(search: string) {
    if (!search) return machines;
    const q = search.toLowerCase();
    return machines.filter((m) =>
      m.name.toLowerCase().includes(q) || m.machineType.toLowerCase().includes(q)
    );
  }

  function selectMachine(idx: number, machine: MachineRow) {
    const description = `${machine.name} (${machine.machineType})`;
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        description,
        unit: "Std",
        unitPrice: machine.hourlyRate ?? 0,
      };
    }));
    setOpenMachineIdx(null);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Bitte Kontakt auswählen"); return; }
    setLoading(true);
    // Strip itemType before sending to action
    const submitItems = items.map(({ itemType: _itemType, ...rest }) => rest);
    const result = await createQuote({
      title,
      contactId,
      requestId: prefillRequest?.id,
      siteAddress: siteAddress || undefined,
      assignedTo: assignedTo || undefined,
      validUntil: validUntil || undefined,
      notes: notes || undefined,
      items: submitItems,
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
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="h-10 rounded-lg border-gray-200"
                    placeholder="Angebotsbeschreibung"
                  />
                </div>

                {/* Contact combobox */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakt *</Label>
                  <ContactCombobox contacts={contacts} value={contactId} onChange={handleContactChange} />
                  <Link
                    href="/kontakte/neu?returnTo=/angebote/neu"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                  >
                    <Plus className="h-3 w-3" />
                    Neuer Kontakt anlegen
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Baustellenadresse</Label>
                  <Input
                    value={siteAddress}
                    onChange={(e) => setSiteAddress(e.target.value)}
                    className="h-10 rounded-lg border-gray-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Gültig bis</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="h-10 rounded-lg border-gray-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Owner</Label>
                <Select value={assignedTo} onValueChange={(v) => setAssignedTo(!v || v === "__none__" ? "" : v)}>
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
            <div className="px-4 pb-4 pt-2">
              <div className="grid grid-cols-[32px_1fr_100px_100px_100px_112px] gap-x-3 pb-2 border-b-2 border-gray-100 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                <div>#</div>
                <div>Beschreibung</div>
                <div className="text-right">Menge</div>
                <div className="text-right">Einheit</div>
                <div className="text-right">EP (€)</div>
                <div className="text-right">GP (€)</div>
              </div>
              {items.length === 0 && (
                <div className="text-center py-6 text-sm text-gray-400">
                  Keine Positionen — klicke auf &quot;+ Position&quot;
                </div>
              )}
              {items.map((item, idx) => {
                const isProdukt = item.itemType === "produkt";
                const isMaschine = item.itemType === "maschine";
                const fp = getFilteredProducts(item.description);
                const fm = getFilteredMachines(item.description);
                const showProductDrop = isProdukt && openProductIdx === idx && fp.length > 0;
                const showMachineDrop = isMaschine && openMachineIdx === idx;
                return (
                  <div key={idx} className="group border-b border-gray-100 py-3 space-y-1.5">
                    {/* Eingabe-Zeile */}
                    <div className="grid grid-cols-[32px_1fr_100px_100px_100px_112px] gap-x-3 items-center">
                      <div className="h-9 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div
                        className="relative"
                        ref={(el) => { productRefs.current[idx] = el; machineRefs.current[idx] = el; }}
                      >
                        <button
                          type="button"
                          title={isProdukt ? "Zu Maschine wechseln" : "Zu Produkt wechseln"}
                          className={`absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors z-10 ${isProdukt ? "text-blue-400 hover:text-blue-600" : "text-orange-400 hover:text-orange-600"}`}
                          onClick={() => switchItemType(idx, isProdukt ? "maschine" : "produkt")}
                        >
                          {isProdukt ? <Package className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                        </button>
                        <input
                          type="text"
                          className={`w-full h-9 rounded-md border border-gray-200 pl-8 pr-8 text-sm focus:outline-none focus:ring-1 focus:border-blue-400 ${isProdukt ? "focus:ring-blue-400" : "focus:ring-orange-400 focus:border-orange-400"} min-w-0`}
                          placeholder={isProdukt ? "Freitext oder Produkt wählen..." : "Maschine suchen..."}
                          value={item.description}
                          required
                          onChange={(e) => {
                            updateItem(idx, "description", e.target.value);
                            if (isProdukt) setOpenProductIdx(idx);
                            else setOpenMachineIdx(idx);
                          }}
                          onFocus={() => {
                            if (isProdukt && products.length > 0) setOpenProductIdx(idx);
                            else if (isMaschine) setOpenMachineIdx(idx);
                          }}
                        />
                        {item.description && (
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                            onClick={() => {
                              updateItem(idx, "description", "");
                              if (isProdukt) setOpenProductIdx(idx);
                              else setOpenMachineIdx(idx);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(showProductDrop || (openProductIdx === idx && products.length > 0 && !item.description)) && (
                          <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                            {fp.length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-400">Kein Produkt gefunden</div>
                            )}
                            {fp.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                                onMouseDown={() => {
                                  setItems((prev) => prev.map((item, i) => {
                                    if (i !== idx) return item;
                                    return {
                                      ...item,
                                      description: p.name,
                                      unit: p.unit || item.unit,
                                      unitPrice: p.price ?? item.unitPrice,
                                      note: p.quoteDescription || item.note,
                                    };
                                  }));
                                  setOpenProductIdx(null);
                                }}
                              >
                                <Package className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                <span className="font-medium text-gray-900">{p.name}</span>
                                {p.description && <span className="text-xs text-gray-400 truncate">· {p.description}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                        {showMachineDrop && (
                          <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                            {fm.length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-400">Keine Maschine gefunden</div>
                            )}
                            {fm.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex items-center gap-2"
                                onMouseDown={() => selectMachine(idx, m)}
                              >
                                <Wrench className="h-3.5 w-3.5 text-orange-300 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-gray-900">{m.name}</span>
                                  <span className="text-xs text-gray-400 ml-1.5">· {m.machineType}</span>
                                </div>
                                {m.hourlyRate != null && (
                                  <span className="text-xs text-orange-600 font-mono flex-shrink-0">
                                    {m.hourlyRate.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}/Std
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Input
                        className="text-sm h-9 text-right"
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                      />
                      <Select value={item.unit} onValueChange={(v) => v && updateItem(idx, "unit", v)}>
                        <SelectTrigger className="text-sm h-9 w-full"><SelectValue className="justify-end" /></SelectTrigger>
                        <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input
                        className="text-sm h-9 text-right"
                        type="number"
                        min="0"
                        step="1"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                      />
                      <div className="h-9 flex items-center justify-end px-3 text-sm font-mono text-gray-900 bg-gray-50 rounded-md border border-gray-100">
                        {(item.quantity * item.unitPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    {/* Notiz-Zeile — bündig mit Beschreibungs-Spalte bis Ende GP */}
                    <div className="pl-[44px]">
                      <textarea
                        rows={item.note ? 2 : 1}
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 resize-none"
                        placeholder="Positionsbeschreibung hinzufügen..."
                        value={item.note}
                        onChange={(e) => updateItem(idx, "note", e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-col items-end gap-1.5 pt-3 mt-1">
                <div className="flex items-center gap-8 text-sm text-gray-500">
                  <span className="w-32 text-right">Netto</span>
                  <span className="font-mono w-28 text-right">{total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                </div>
                <div className="flex items-center gap-8 text-sm text-gray-400">
                  <span className="w-32 text-right">+ 20 % MwSt.</span>
                  <span className="font-mono w-28 text-right">{(total * 0.2).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                </div>
                <div className="flex items-center gap-8 text-sm font-semibold text-gray-900 border-t border-gray-200 pt-2 mt-0.5">
                  <span className="w-32 text-right">Gesamt (brutto)</span>
                  <span className="font-mono w-28 text-right text-base">{(total * 1.2).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notizen */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
              {prefillRequest && ((prefillRequest.description ?? "") || (prefillRequest.contactNotes?.length ?? 0) > 0) && (
                <span className="text-[11px] text-blue-500 font-medium">Aus Anfrage übernommen</span>
              )}
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="rounded-lg border-gray-200 resize-none"
              placeholder="Hinweise zum Angebot..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pb-6">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => router.back()}>Abbrechen</Button>
            <LoadingButton type="submit" loading={loading} disabled={!contactId || !title} className="rounded-lg">
              Angebot erstellen
            </LoadingButton>
          </div>
        </div>
      </form>

    </div>
  );
}
