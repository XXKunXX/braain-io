"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createBaustelle } from "@/actions/baustellen";
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
    contactPerson: string | null;
    phone: string | null;
  };
};

interface Props {
  orders: OrderOption[];
  userNames: string[];
  prefillOrder: OrderOption | null;
}

function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function NeueBaustelleClient({ orders, userNames, prefillOrder }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // ── Order combobox ──────────────────────────────────────────────────────────
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

  // ── Form fields ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(prefillOrder?.title ?? "");
  const [address, setAddress] = useState(prefillOrder?.contact.address ?? "");
  const [postalCode, setPostalCode] = useState(prefillOrder?.contact.postalCode ?? "");
  const [city, setCity] = useState(prefillOrder?.contact.city ?? "");
  const [startDate, setStartDate] = useState(toDateInput(prefillOrder?.startDate));
  const [endDate, setEndDate] = useState(toDateInput(prefillOrder?.endDate));
  const [status, setStatus] = useState<BaustelleStatusType>("PLANNED");
  const [bauleiter, setBauleiter] = useState("");
  const [contactPerson, setContactPerson] = useState(
    prefillOrder?.contact.contactPerson ?? ""
  );
  const [phone, setPhone] = useState(prefillOrder?.contact.phone ?? "");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  // ── Select order and auto-fill all fields ───────────────────────────────────
  function selectOrder(o: OrderOption) {
    setOrderId(o.id);
    setOrderSearch(`${o.orderNumber} – ${o.title}`);
    setOrderOpen(false);

    // Always auto-fill from order
    setName(o.title);
    setStartDate(toDateInput(o.startDate));
    if (o.endDate) setEndDate(toDateInput(o.endDate));
    if (o.contact.address) setAddress(o.contact.address);
    if (o.contact.postalCode) setPostalCode(o.contact.postalCode);
    if (o.contact.city) setCity(o.contact.city);
    if (o.contact.contactPerson) setContactPerson(o.contact.contactPerson);
    if (o.contact.phone) setPhone(o.contact.phone);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name ist erforderlich"); return; }
    if (!startDate) { toast.error("Startdatum ist erforderlich"); return; }

    setLoading(true);
    const result = await createBaustelle({
      orderId,
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
          <Link href="/baustellen" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Alle Baustellen
          </Link>
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
                      onChange={(e) => {
                        setOrderSearch(e.target.value);
                        setOrderId("");
                        setOrderOpen(true);
                      }}
                      onFocus={() => setOrderOpen(true)}
                    />
                    {orderId ? (
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                        onClick={() => {
                          setOrderId("");
                          setOrderSearch("");
                          setOrderOpen(false);
                        }}
                      >
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
                          <button
                            key={o.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col"
                            onMouseDown={() => selectOrder(o)}
                          >
                            <span className="font-medium text-gray-900">{o.orderNumber} – {o.title}</span>
                            {o.contact.city && (
                              <span className="text-xs text-gray-400">{o.contact.city}</span>
                            )}
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

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Adresse</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-10 rounded-lg border-gray-200"
                  placeholder="Straße und Hausnummer"
                />
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
                  <select
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={bauleiter}
                    onChange={(e) => setBauleiter(e.target.value)}
                  >
                    <option value="">– Kein Bauleiter –</option>
                    {userNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</Label>
                  <select
                    className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as BaustelleStatusType)}
                  >
                    <option value="PLANNED">Geplant</option>
                    <option value="ACTIVE">Aktiv</option>
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
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="rounded-lg border-gray-200 resize-none"
                  placeholder="Beschreibung der Baustelle..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="rounded-lg border-gray-200 resize-none"
                  placeholder="Interne Notizen..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pb-6">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => router.back()}>Abbrechen</Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !startDate}
              className="rounded-lg bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Erstelle..." : "Baustelle erstellen"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
