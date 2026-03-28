"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createBaustelle } from "@/actions/baustellen";
import { createContact } from "@/actions/contacts";
import type { BaustelleStatusType } from "@/actions/baustellen";

type OrderOption = {
  id: string;
  orderNumber: string;
  title: string;
  startDate: Date;
  endDate: Date;
  contact: {
    address: string | null;
    postalCode: string | null;
    city: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
};

type ContactOption = {
  id: string;
  companyName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
};

interface Props {
  orders: OrderOption[];
  userNames: string[];
  contacts: ContactOption[];
  prefillOrder: OrderOption | null;
}

function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

const INP = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export function NeueBaustelleClient({ orders, userNames, contacts: initialContacts, prefillOrder }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // ── Contact combobox ─────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState<ContactOption[]>(initialContacts);
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const filteredContacts = contacts.filter(
    (c) =>
      c.companyName.toLowerCase().includes(contactSearch.toLowerCase()) ||
      ([c.firstName, c.lastName].filter(Boolean).join(" ")).toLowerCase().includes(contactSearch.toLowerCase()) ||
      (c.city ?? "").toLowerCase().includes(contactSearch.toLowerCase())
  );

  function selectContact(c: ContactOption) {
    setContactId(c.id);
    setContactSearch(c.companyName);
    setContactOpen(false);
    const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ");
    if (fullName) setContactPerson(fullName);
    if (c.phone) setPhone(c.phone);
    if (c.address) setAddress(c.address);
    if (c.postalCode) setPostalCode(c.postalCode);
    if (c.city) setCity(c.city);
  }

  // ── Quick-create contact modal ────────────────────────────────────────────────
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactForm, setNewContactForm] = useState({
    companyName: "", contactPerson: "", phone: "", city: "",
  });
  const [newContactLoading, setNewContactLoading] = useState(false);

  async function handleCreateContact() {
    if (!newContactForm.companyName.trim()) { toast.error("Firmenname ist erforderlich"); return; }
    setNewContactLoading(true);
    const result = await createContact({
      companyName: newContactForm.companyName.trim(),
      type: "COMPANY",
      phone: newContactForm.phone || undefined,
      city: newContactForm.city || undefined,
    });
    setNewContactLoading(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Erstellen"); return; }
    const c = result.contact!;
    const newOpt: ContactOption = {
      id: c.id, companyName: c.companyName,
      firstName: null,
      lastName: null,
      phone: c.phone ?? null,
      address: c.address ?? null,
      postalCode: c.postalCode ?? null,
      city: c.city ?? null,
    };
    setContacts(prev => [...prev, newOpt].sort((a, b) => a.companyName.localeCompare(b.companyName)));
    selectContact(newOpt);
    if (newContactForm.contactPerson) setContactPerson(newContactForm.contactPerson);
    setShowNewContact(false);
    setNewContactForm({ companyName: "", contactPerson: "", phone: "", city: "" });
    toast.success("Kontakt erstellt");
  }

  // ── Order combobox ───────────────────────────────────────────────────────────
  const [orderId, setOrderId] = useState(prefillOrder?.id ?? "");
  const [orderSearch, setOrderSearch] = useState(
    prefillOrder ? `${prefillOrder.orderNumber} – ${prefillOrder.title}` : ""
  );
  const [orderOpen, setOrderOpen] = useState(false);
  const orderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (orderRef.current && !orderRef.current.contains(e.target as Node)) {
        setOrderOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const filteredOrders = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.title.toLowerCase().includes(orderSearch.toLowerCase())
  );

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(prefillOrder?.title ?? "");
  const [address, setAddress] = useState(prefillOrder?.contact.address ?? "");
  const [postalCode, setPostalCode] = useState(prefillOrder?.contact.postalCode ?? "");
  const [city, setCity] = useState(prefillOrder?.contact.city ?? "");
  const [startDate, setStartDate] = useState(toDateInput(prefillOrder?.startDate));
  const [endDate, setEndDate] = useState(toDateInput(prefillOrder?.endDate));
  const [status, setStatus] = useState<BaustelleStatusType>("PLANNED");
  const [bauleiter, setBauleiter] = useState("");
  const [contactPerson, setContactPerson] = useState([prefillOrder?.contact.firstName, prefillOrder?.contact.lastName].filter(Boolean).join(" "));
  const [phone, setPhone] = useState(prefillOrder?.contact.phone ?? "");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  // ── Select order and auto-fill ───────────────────────────────────────────────
  function selectOrder(o: OrderOption) {
    setOrderId(o.id);
    setOrderSearch(`${o.orderNumber} – ${o.title}`);
    setOrderOpen(false);
    setName(o.title);
    setStartDate(toDateInput(o.startDate));
    if (o.endDate) setEndDate(toDateInput(o.endDate));
    if (o.contact.address) setAddress(o.contact.address);
    if (o.contact.postalCode) setPostalCode(o.contact.postalCode);
    if (o.contact.city) setCity(o.contact.city);
    const orderContactName = [o.contact.firstName, o.contact.lastName].filter(Boolean).join(" ");
    if (orderContactName) setContactPerson(orderContactName);
    if (o.contact.phone) setPhone(o.contact.phone);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name ist erforderlich"); return; }
    if (!startDate) { toast.error("Startdatum ist erforderlich"); return; }

    setLoading(true);
    const result = await createBaustelle({
      orderId,
      contactId: contactId || undefined,
      name: name.trim(),
      address: address || undefined,
      postalCode: postalCode || undefined,
      city: city || undefined,
      startDate,
      endDate: endDate || undefined,
      status,
      bauleiter: bauleiter || undefined,
      contactPerson: contactPerson || undefined,
      phone: phone || undefined,
      description: description || undefined,
      notes: notes || undefined,
    });
    setLoading(false);

    if ("error" in result && result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Baustelle erstellt");
    router.push(`/baustellen/${result.baustelle?.id}`);
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/baustellen" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-3.5 w-3.5" />
              Alle Baustellen
            </Link>
            {prefillOrder && (
              <>
                <span className="text-gray-300">|</span>
                <Link href={`/auftraege/${prefillOrder.id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {prefillOrder.orderNumber} – {prefillOrder.title}
                </Link>
              </>
            )}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Neue Baustelle</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-6">
        <div className="max-w-3xl space-y-5">

          {/* Basisinformationen */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Basisinformationen</h2>
            <div className="border-t border-gray-100 pt-4 space-y-4">

              <div className="grid grid-cols-2 gap-4">
                {/* Auftrag combobox */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Auftrag</Label>
                  <div ref={orderRef} className="relative">
                    <input
                      type="text"
                      className="w-full h-10 rounded-lg border border-gray-200 px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Auftrag suchen..."
                      value={orderSearch}
                      onChange={(e) => { setOrderSearch(e.target.value); setOrderId(""); setOrderOpen(true); }}
                      onFocus={() => setOrderOpen(true)}
                    />
                    {orderId ? (
                      <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                        onClick={() => { setOrderId(""); setOrderSearch(""); setOrderOpen(false); }}>
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    )}
                    {orderOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredOrders.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-400">Kein Treffer</div>
                        )}
                        {filteredOrders.map((o) => (
                          <button key={o.id} type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col"
                            onMouseDown={() => selectOrder(o)}>
                            <span className="font-medium text-gray-900">{o.orderNumber} – {o.title}</span>
                            {o.contact.city && <span className="text-xs text-gray-400">{o.contact.city}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Baustellenname *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-lg border-gray-200"
                    placeholder="z.B. Hauptstraße Aufschüttung"
                    required
                  />
                </div>
              </div>

              {/* Kontakt combobox */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kunde / Kontakt</Label>
                <div ref={contactRef} className="relative">
                  <input
                    type="text"
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Firma oder Kontaktperson suchen..."
                    value={contactSearch}
                    onChange={(e) => { setContactSearch(e.target.value); setContactId(""); setContactOpen(true); }}
                    onFocus={() => setContactOpen(true)}
                  />
                  {contactId ? (
                    <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => { setContactId(""); setContactSearch(""); setContactOpen(false); }}>
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  )}
                  {contactOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredContacts.map((c) => (
                        <button key={c.id} type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col border-b border-gray-50 last:border-0"
                          onMouseDown={() => selectContact(c)}>
                          <span className="font-medium text-gray-900">{c.companyName}</span>
                          {([c.firstName, c.lastName].filter(Boolean).join(" ") || c.city) && (
                            <span className="text-xs text-gray-400">
                              {[[c.firstName, c.lastName].filter(Boolean).join(" "), c.city].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-t border-gray-100 font-medium"
                        onMouseDown={() => {
                          setContactOpen(false);
                          setNewContactForm(f => ({ ...f, companyName: contactSearch }));
                          setShowNewContact(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {contactSearch.trim() ? `"${contactSearch}" erstellen` : "Neuen Kontakt erstellen"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Adresse</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-10 rounded-lg border-gray-200" placeholder="Straße und Hausnummer" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">PLZ</Label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="h-10 rounded-lg border-gray-200" placeholder="1010" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Ort</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-10 rounded-lg border-gray-200" placeholder="Wien" />
                </div>
              </div>
            </div>
          </div>

          {/* Zeitraum & Verantwortliche */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Zeitraum &amp; Verantwortliche</h2>
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Startdatum *</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-lg border-gray-200" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Enddatum</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Bauleiter</Label>
                  <select className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={bauleiter} onChange={(e) => setBauleiter(e.target.value)}>
                    <option value="">– Kein Bauleiter –</option>
                    {userNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</Label>
                  <select className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={status} onChange={(e) => setStatus(e.target.value as BaustelleStatusType)}>
                    <option value="PLANNED">Geplant</option>
                    <option value="ACTIVE">Aktiv</option>
                    <option value="PENDING">Ausstehend</option>
                    <option value="INVOICED">In Abrechnung</option>
                    <option value="COMPLETED">Abgeschlossen</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontaktperson</Label>
                  <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="h-10 rounded-lg border-gray-200" placeholder="Optional" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Telefon</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-lg border-gray-200" placeholder="Optional" />
                </div>
              </div>
            </div>
          </div>

          {/* Beschreibung & Notizen */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Weitere Angaben</h2>
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Beschreibung</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={3} className="rounded-lg border-gray-200 resize-none" placeholder="Beschreibung der Baustelle..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={2} className="rounded-lg border-gray-200 resize-none" placeholder="Interne Notizen..." />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pb-6">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => router.back()}>Abbrechen</Button>
            <Button type="submit" disabled={loading || !name.trim() || !startDate} className="rounded-lg bg-blue-600 hover:bg-blue-700">
              {loading ? "Erstelle..." : "Baustelle erstellen"}
            </Button>
          </div>
        </div>
      </form>

      {/* ── Modal: Neuen Kontakt erstellen ──────────────────────────────────── */}
      {showNewContact && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Neuer Kontakt</h2>
              <button onClick={() => setShowNewContact(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Firma / Name *</label>
                <input className={INP} placeholder="Mustermann GmbH" value={newContactForm.companyName}
                  onChange={(e) => setNewContactForm(f => ({ ...f, companyName: e.target.value }))}
                  autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreateContact()} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kontaktperson</label>
                <input className={INP} placeholder="Max Mustermann" value={newContactForm.contactPerson}
                  onChange={(e) => setNewContactForm(f => ({ ...f, contactPerson: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                  <input className={INP} placeholder="+43 1 234 567" value={newContactForm.phone}
                    onChange={(e) => setNewContactForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ort</label>
                  <input className={INP} placeholder="Wien" value={newContactForm.city}
                    onChange={(e) => setNewContactForm(f => ({ ...f, city: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewContact(false)}>Abbrechen</Button>
              <Button onClick={handleCreateContact} disabled={newContactLoading}>
                {newContactLoading ? "Erstellt..." : "Kontakt erstellen"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
