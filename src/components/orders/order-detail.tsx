"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, Pencil, FileUp, Receipt, Truck, User, MapPin, Euro, CalendarDays, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrderStatus, updateOrder } from "@/actions/orders";
import { CreateDeliveryButton } from "@/components/delivery/create-delivery-button";
import type { Contact, DeliveryNote, Order, Quote, QuoteItem } from "@prisma/client";

type OrderWithRelations = Order & {
  contact: Contact;
  quote: (Quote & { items: QuoteItem[] }) | null;
  deliveryNotes: DeliveryNote[];
};

const statusLabels: Record<string, string> = {
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
};

const statusColors: Record<string, string> = {
  PLANNED: "border border-blue-200 text-blue-700 bg-blue-50",
  ACTIVE: "border border-green-300 text-green-700 bg-green-50",
  COMPLETED: "border border-gray-200 text-gray-500 bg-gray-50",
};

const tabs = ["Details", "Leistungen", "Lieferscheine", "Aktivität"] as const;
type Tab = typeof tabs[number];

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{children}</p>
      </div>
    </div>
  );
}

export function OrderDetail({
  order,
  contacts,
}: {
  order: OrderWithRelations;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Details");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(order.title);
  const [editStart, setEditStart] = useState(format(new Date(order.startDate), "yyyy-MM-dd'T'HH:mm"));
  const [editEnd, setEditEnd] = useState(format(new Date(order.endDate), "yyyy-MM-dd"));
  const [editNotes, setEditNotes] = useState(order.notes ?? "");
  const [editStatus, setEditStatus] = useState(order.status);

  async function handleSave() {
    setSaving(true);
    await updateOrder(order.id, {
      title: editTitle,
      contactId: order.contactId,
      startDate: editStart,
      endDate: editEnd,
      notes: editNotes,
    });
    if (editStatus !== order.status) {
      await updateOrderStatus(order.id, editStatus as "PLANNED" | "ACTIVE" | "COMPLETED");
    }
    toast.success("Gespeichert");
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const totalPrice = order.quote ? Number(order.quote.totalPrice) : null;

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <Link href="/auftraege" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />Zurück zu Aufträge
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{order.title}</h1>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[order.status]}`}>
                {statusLabels[order.status]}
              </span>
            </div>
            <Link href={`/kontakte/${order.contact.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors mt-1">
              <User className="h-3.5 w-3.5" />
              {order.contact.companyName}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" className="rounded-lg" onClick={() => setEditing(false)}>Abbrechen</Button>
                <Button className="rounded-lg bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                  {saving ? "Speichert..." : "Speichern"}
                </Button>
              </>
            ) : (
              <Button variant="outline" className="rounded-lg gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />Bearbeiten
              </Button>
            )}
            {order.quote && (
              <Button
                variant="outline"
                className="rounded-lg gap-1.5"
                onClick={() => window.open(`/api/pdf/quote/${order.quote!.id}`, "_blank")}
              >
                <FileUp className="h-3.5 w-3.5" />Dokument
              </Button>
            )}
            <Button className="rounded-lg gap-1.5 bg-amber-500 hover:bg-amber-600">
              <Receipt className="h-3.5 w-3.5" />Rechnung erstellen
            </Button>
            <CreateDeliveryButton
              contacts={contacts}
              defaultContactId={order.contactId}
              defaultOrderId={order.id}
              quoteItems={order.quote?.items.map((i) => ({
                id: i.id,
                position: i.position,
                description: i.description,
                quantity: Number(i.quantity),
                unit: i.unit,
              }))}
              orderTitle={order.title}
            />
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4 border-b border-gray-100 bg-gray-50/60">
        <StatCard label="Status">
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[order.status]}`}>
            {statusLabels[order.status]}
          </span>
        </StatCard>
        <StatCard label="Auftragssumme">
          <span className="text-xl font-bold text-gray-900">
            {totalPrice !== null
              ? totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
              : "–"}
          </span>
        </StatCard>
        <StatCard label="Startdatum & Uhrzeit">
          <span className="text-base font-semibold text-gray-900">
            {format(new Date(order.startDate), "dd. MMMM yyyy", { locale: de })}
          </span>
          <span className="text-sm text-gray-500 ml-1">
            {format(new Date(order.startDate), "HH:mm")} Uhr
          </span>
        </StatCard>
        <StatCard label="Enddatum">
          <span className="text-base font-semibold text-gray-900">
            {format(new Date(order.endDate), "dd. MMMM yyyy", { locale: de })}
          </span>
        </StatCard>
      </div>

      {/* ── Tabs ── */}
      <div className="px-6 border-b border-gray-200 bg-white flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 p-6">
        {activeTab === "Details" && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl">
            {/* Auftragsinformationen */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Auftragsinformationen</h3>
              {editing ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Projektname</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</Label>
                    <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                      <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                        <SelectValue>{statusLabels[editStatus]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Startdatum & Uhrzeit</Label>
                    <Input type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Enddatum</Label>
                    <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
                    <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                  </div>
                </div>
              ) : (
                <div>
                  <InfoItem icon={ClipboardList} label="Projektname">{order.title}</InfoItem>
                  <InfoItem icon={User} label="Kontakt">
                    <Link href={`/kontakte/${order.contact.id}`} className="text-blue-600 hover:underline">
                      {order.contact.companyName}
                    </Link>
                  </InfoItem>
                  <InfoItem icon={MapPin} label="Baustellenadresse">
                    {order.quote?.siteAddress ?? "–"}
                  </InfoItem>
                  <InfoItem icon={Euro} label="Auftragssumme">
                    {totalPrice !== null
                      ? totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                      : "–"}
                  </InfoItem>
                  {order.notes && (
                    <InfoItem icon={ClipboardList} label="Notizen">{order.notes}</InfoItem>
                  )}
                </div>
              )}
            </div>

            {/* Projektzeitraum */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Projektzeitraum</h3>
              <InfoItem icon={CalendarDays} label="Startdatum">
                {format(new Date(order.startDate), "dd. MMMM yyyy", { locale: de })}
              </InfoItem>
              <InfoItem icon={CalendarDays} label="Enddatum">
                {format(new Date(order.endDate), "dd. MMMM yyyy", { locale: de })}
              </InfoItem>
              {order.quote && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Verknüpftes Angebot</p>
                  <Link href={`/angebote/${order.quote.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                    {order.quote.quoteNumber}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "Leistungen" && (
          <div className="max-w-4xl">
            {order.quote && order.quote.items.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-5 py-2.5">Pos.</th>
                      <th className="text-left px-5 py-2.5">Beschreibung</th>
                      <th className="text-right px-5 py-2.5">Menge</th>
                      <th className="text-left px-5 py-2.5">Einh.</th>
                      <th className="text-right px-5 py-2.5">EP €</th>
                      <th className="text-right px-5 py-2.5">GP €</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.quote.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-400 font-mono text-xs">{item.position}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">{item.description}</td>
                        <td className="px-5 py-3 text-right font-mono">{Number(item.quantity).toLocaleString("de-DE")}</td>
                        <td className="px-5 py-3 text-gray-500">{item.unit}</td>
                        <td className="px-5 py-3 text-right font-mono">{Number(item.unitPrice).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">{Number(item.total).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={4} />
                      <td className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gesamt (netto)</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-gray-900">
                        {Number(order.quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-400">
                <p className="text-sm">Keine Leistungen verknüpft</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "Lieferscheine" && (
          <div className="max-w-4xl">
            <div className="flex justify-end mb-4">
              <CreateDeliveryButton
                contacts={contacts}
                defaultContactId={order.contactId}
                defaultOrderId={order.id}
                quoteItems={order.quote?.items.map((i) => ({
                  id: i.id,
                  position: i.position,
                  description: i.description,
                  quantity: Number(i.quantity),
                  unit: i.unit,
                }))}
                orderTitle={order.title}
              />
            </div>
            {order.deliveryNotes.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Truck className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">Noch keine Lieferscheine</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Nr.", "Datum", "Material", "Menge", "Fahrer", ""].map((h) => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {order.deliveryNotes.map((dn, i) => (
                  <div key={dn.id} className={`grid grid-cols-[1fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 items-center ${i !== order.deliveryNotes.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                    <span className="text-sm text-gray-700">{format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}</span>
                    <span className="text-sm font-medium text-gray-900">{dn.material}</span>
                    <span className="text-sm font-mono text-gray-700">{Number(dn.quantity).toLocaleString("de-DE")} {dn.unit}</span>
                    <span className="text-sm text-gray-500">{dn.driver ?? "–"}</span>
                    <Link href={`/lieferscheine/${dn.id}`} className="text-xs text-blue-600 hover:underline text-right">Öffnen</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "Aktivität" && (
          <div className="max-w-md">
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              {[
                { label: "Auftrag erstellt", date: order.createdAt, color: "bg-blue-500" },
                ...(order.status === "ACTIVE" ? [{ label: "Auftrag gestartet", date: order.updatedAt, color: "bg-green-500" }] : []),
                ...(order.status === "COMPLETED" ? [{ label: "Auftrag abgeschlossen", date: order.updatedAt, color: "bg-gray-500" }] : []),
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.color}`} />
                  <div>
                    <p className="text-sm text-gray-700">{a.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{format(new Date(a.date), "dd. MMMM yyyy", { locale: de })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
