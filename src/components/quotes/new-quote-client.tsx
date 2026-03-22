"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, ChevronDown, X, Package, Wrench } from "lucide-react";
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
import { createContact } from "@/actions/contacts";
import { toast } from "sonner";
import type { Contact, Request } from "@prisma/client";
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

type Product = { id: string; name: string; description: string | null };

interface Props {
  contacts: Contact[];
  userNames: string[];
  products: Product[];
  machines: MachineRow[];
  prefillContactId?: string;
  prefillRequest?: (Request & { contact: Contact }) | null;
  defaultValidUntil?: string;
}

export function NewQuoteClient({ contacts, userNames, products, machines, prefillContactId, prefillRequest, defaultValidUntil }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // ── Contact combobox ──────────────────────────────────────────────────────
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [contactId, setContactId] = useState(prefillContactId ?? prefillRequest?.contactId ?? "");
  const [contactSearch, setContactSearch] = useState(() => {
    const pre = prefillContactId ?? prefillRequest?.contactId;
    return pre ? (contacts.find((c) => c.id === pre)?.companyName ?? "") : "";
  });
  const [contactOpen, setContactOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredContacts = localContacts.filter((c) =>
    c.companyName.toLowerCase().includes(contactSearch.toLowerCase())
  );

  function selectContact(c: Contact) {
    setContactId(c.id);
    setContactSearch(c.companyName);
    setContactOpen(false);
    if (!prefillRequest?.siteAddress && !siteAddress) {
      const addr = [
        c.address,
        [c.postalCode, c.city].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ");
      if (addr) setSiteAddress(addr);
    }
    if (!prefillRequest?.assignedTo && !assignedTo && c.owner) {
      setAssignedTo(c.owner);
    }
  }

  // ── New contact quick-create ──────────────────────────────────────────────
  const [showNewContact, setShowNewContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);

  async function handleCreateContact() {
    if (!newName.trim()) { toast.error("Name ist erforderlich"); return; }
    setCreatingContact(true);
    const result = await createContact({
      companyName: newName.trim(),
      phone: newPhone || undefined,
      email: newEmail || undefined,
      type: "COMPANY",
    });
    setCreatingContact(false);
    if (!result.contact) { toast.error("Fehler beim Erstellen"); return; }
    const c = result.contact as Contact;
    setLocalContacts((prev) => [...prev, c]);
    selectContact(c);
    setShowNewContact(false);
    setNewName(""); setNewPhone(""); setNewEmail("");
    toast.success("Kontakt erstellt");
  }

  // ── Other form fields ─────────────────────────────────────────────────────
  const [title, setTitle] = useState(prefillRequest?.title ?? "");
  const [siteAddress, setSiteAddress] = useState(prefillRequest?.siteAddress ?? "");
  const [assignedTo, setAssignedTo] = useState(prefillRequest?.assignedTo ?? "");
  const [validUntil, setValidUntil] = useState(defaultValidUntil ?? "");
  const [notes, setNotes] = useState("");
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
                  <div ref={contactRef} className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full h-10 rounded-lg border border-gray-200 px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Kontakt suchen..."
                        value={contactSearch}
                        onChange={(e) => {
                          setContactSearch(e.target.value);
                          setContactId("");
                          setContactOpen(true);
                        }}
                        onFocus={() => setContactOpen(true)}
                      />
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    {contactOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredContacts.length === 0 && contactSearch && (
                          <div className="px-3 py-2 text-sm text-gray-400">Kein Treffer</div>
                        )}
                        {filteredContacts.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col"
                            onMouseDown={() => selectContact(c)}
                          >
                            <span className="font-medium text-gray-900">{c.companyName}</span>
                            {c.city && <span className="text-xs text-gray-400">{c.city}</span>}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium flex items-center gap-1.5 border-t border-gray-100"
                          onMouseDown={() => {
                            setContactOpen(false);
                            setShowNewContact(true);
                            setNewName(contactSearch);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Neuen Kontakt erstellen
                        </button>
                      </div>
                    )}
                  </div>
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
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-[24px_1fr_80px_90px_90px_80px_28px] gap-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase px-1">
                <div>#</div>
                <div>Beschreibung</div>
                <div>Menge</div>
                <div>Einheit</div>
                <div>EP (€)</div>
                <div className="text-right">GP (€)</div>
                <div />
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
                  <div key={idx} className="space-y-1.5">
                  <div className="grid grid-cols-[24px_1fr_80px_90px_90px_80px_28px] gap-2 items-start">
                    {/* Position number */}
                    <div className="h-9 flex items-center text-xs font-mono text-gray-400">{idx + 1}.</div>
                    {/* Description with type toggle + combobox */}
                    <div className="space-y-1">
                      {/* Type toggle */}
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium transition-colors ${isProdukt ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                          onClick={() => switchItemType(idx, "produkt")}
                        >
                          <Package className="h-3 w-3" />Produkt
                        </button>
                        <button
                          type="button"
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium transition-colors ${isMaschine ? "bg-orange-100 text-orange-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                          onClick={() => switchItemType(idx, "maschine")}
                        >
                          <Wrench className="h-3 w-3" />Maschine
                        </button>
                      </div>
                      {/* Description input + combobox */}
                      {isProdukt ? (
                        <div
                          className="relative"
                          ref={(el) => { productRefs.current[idx] = el; }}
                        >
                          <div className="flex gap-1">
                            <input
                              type="text"
                              className="flex-1 h-9 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                              placeholder="Freitext oder Produkt wählen..."
                              value={item.description}
                              required
                              onChange={(e) => {
                                updateItem(idx, "description", e.target.value);
                                setOpenProductIdx(idx);
                              }}
                              onFocus={() => {
                                if (products.length > 0) setOpenProductIdx(idx);
                              }}
                            />
                            {products.length > 0 && (
                              <button
                                type="button"
                                title="Produkt aus Ressourcen wählen"
                                className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                                onClick={() => setOpenProductIdx(openProductIdx === idx ? null : idx)}
                              >
                                <Package className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
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
                                    updateItem(idx, "description", p.name);
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
                        </div>
                      ) : (
                        <div
                          className="relative"
                          ref={(el) => { machineRefs.current[idx] = el; }}
                        >
                          <div className="flex gap-1">
                            <input
                              type="text"
                              className="flex-1 h-9 rounded-md border border-orange-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-0"
                              placeholder="Maschine suchen..."
                              value={item.description}
                              required
                              onChange={(e) => {
                                updateItem(idx, "description", e.target.value);
                                setOpenMachineIdx(idx);
                              }}
                              onFocus={() => setOpenMachineIdx(idx)}
                            />
                            <button
                              type="button"
                              title="Maschine aus Maschinenpark wählen"
                              className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-md border border-orange-200 text-orange-400 hover:text-orange-600 hover:border-orange-400 transition-colors"
                              onClick={() => setOpenMachineIdx(openMachineIdx === idx ? null : idx)}
                            >
                              <Wrench className="h-3.5 w-3.5" />
                            </button>
                          </div>
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
                      )}
                    </div>

                    <Input
                      className="text-sm h-9"
                      type="number"
                      min="0"
                      step="0.001"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                    />
                    <Select value={item.unit} onValueChange={(v) => v && updateItem(idx, "unit", v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input
                      className="text-sm h-9"
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                    />
                    <div className="h-9 flex items-center justify-end text-sm font-mono text-gray-600">
                      {(item.quantity * item.unitPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="h-9 flex items-center justify-center">
                      <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="pl-8">
                    <textarea
                      rows={2}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Positionsbeschreibung (optional)..."
                      value={item.note}
                      onChange={(e) => updateItem(idx, "note", e.target.value)}
                    />
                  </div>
                  </div>
                );
              })}
              <div className="flex flex-col items-end gap-1 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-8 text-sm text-gray-500">
                  <span>Netto</span>
                  <span className="font-mono w-28 text-right">{total.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                </div>
                <div className="flex items-center gap-8 text-sm text-gray-500">
                  <span>+ 20 % MwSt.</span>
                  <span className="font-mono w-28 text-right">{(total * 0.2).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                </div>
                <div className="flex items-center gap-8 text-sm font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-0.5">
                  <span>Gesamt (brutto)</span>
                  <span className="font-mono w-28 text-right">{(total * 1.2).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notizen */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
            <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-lg border-gray-200 resize-none"
              placeholder="Hinweise zum Angebot..."
            />
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

      {/* New Contact Modal */}
      {showNewContact && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Neuen Kontakt erstellen</h2>
              <button type="button" onClick={() => setShowNewContact(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Firma / Name *</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mustermann GmbH"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowNewContact(false)}>Abbrechen</Button>
              <Button type="button" onClick={handleCreateContact} disabled={creatingContact || !newName.trim()}>
                {creatingContact ? "Erstelle..." : "Kontakt erstellen"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
