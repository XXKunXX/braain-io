"use client";

import { useState } from "react";
import { useTabLabels } from "@/hooks/use-tab-labels";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, Pencil, FileUp, Receipt, User, MapPin, Euro, ClipboardList, HardHat, Plus, Trash2, Activity, FileText, ChevronLeft, ChevronRight, Square, CheckSquare, Truck } from "lucide-react";
import { OrderActivityTab } from "./order-activity-tab";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { createInvoiceFromDeliveryNotes, deleteInvoice } from "@/actions/invoices";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Contact, Order, Quote, QuoteItem } from "@prisma/client";

type BaustelleSummary = {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  address: string | null;
  city: string | null;
};

type OrderDeliveryNote = {
  id: string;
  deliveryNumber: string;
  date: Date;
  material: string;
  quantity: number | null;
  unit: string;
  driver: string | null;
  invoice: { id: string; invoiceNumber: string } | null;
};

type OrderInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  status: string;
};

type OrderWithRelations = Order & {
  contact: Contact;
  quote: (Quote & { items: QuoteItem[] }) | null;
  baustellen: BaustelleSummary[];
  deliveryNotes: OrderDeliveryNote[];
  invoices: OrderInvoice[];
};

const statusLabels: Record<string, string> = {
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  PENDING: "Ausstehend",
  INVOICED: "In Abrechnung",
  COMPLETED: "Abgeschlossen",
};

const statusColors: Record<string, string> = {
  PLANNED: "border border-blue-200 text-blue-700 bg-blue-50",
  ACTIVE: "border border-green-300 text-green-700 bg-green-50",
  PENDING: "border border-red-300 text-red-700 bg-red-50",
  INVOICED: "border border-orange-300 text-orange-700 bg-orange-50",
  COMPLETED: "border border-gray-200 text-gray-500 bg-gray-50",
};

const TABS = [
  { key: "Details" as const, label: "Details", icon: ClipboardList },
  { key: "Baustellen" as const, label: "Baustellen", icon: HardHat },
  { key: "Lieferscheine" as const, label: "Lieferscheine", icon: Truck },
  { key: "Rechnungen" as const, label: "Rechnungen", icon: Receipt },
  { key: "Aktivität" as const, label: "Aktivität", icon: Activity },
];

type Tab = typeof TABS[number]["key"];

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

type UserSummary = { id: string; firstName: string; lastName: string };

export function OrderDetail({
  order,
  contacts,
  users = [],
  activity = [],
}: {
  order: OrderWithRelations;
  contacts: Contact[];
  users?: UserSummary[];
  activity?: import("@/actions/activity").ActivityEvent[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { containerRef: tabContainerRef, showLabels } = useTabLabels();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    const tabs: Tab[] = ["Details", "Baustellen", "Lieferscheine", "Rechnungen", "Aktivität"];
    return (tabs.includes(tab as Tab) ? tab : "Details") as Tab;
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(order.title);
  const [editStart, setEditStart] = useState(format(new Date(order.startDate), "yyyy-MM-dd'T'HH:mm"));
  const [editEnd, setEditEnd] = useState(format(new Date(order.endDate), "yyyy-MM-dd"));
  const [editNotes, setEditNotes] = useState(order.notes ?? "");
  const [editStatus, setEditStatus] = useState(order.status);

  // Lieferschein selection state
  const openDeliveryNotes = order.deliveryNotes.filter((dn) => !dn.invoice);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDnIds, setSelectedDnIds] = useState<Set<string>>(new Set());
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [dnFilter, setDnFilter] = useState<"all" | "open" | "billed">("all");
  const [confirmDeleteInvoiceId, setConfirmDeleteInvoiceId] = useState<string | null>(null);

  function toggleDn(id: string) {
    setSelectedDnIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleAllDn() {
    setSelectedDnIds((prev) => openDeliveryNotes.every((dn) => prev.has(dn.id)) ? new Set() : new Set(openDeliveryNotes.map((dn) => dn.id)));
  }
  function enterSelectionMode() { setSelectionMode(true); setSelectedDnIds(new Set(openDeliveryNotes.map((dn) => dn.id))); }
  function exitSelectionMode() { setSelectionMode(false); setSelectedDnIds(new Set()); }

  async function handleCreateInvoiceFromDns() {
    const ids = Array.from(selectedDnIds);
    if (ids.length === 0) { toast.error("Keine Lieferscheine ausgewählt"); return; }
    setCreatingInvoice(true);
    const result = await createInvoiceFromDeliveryNotes(order.contactId, ids, order.id);
    setCreatingInvoice(false);
    if ("invoice" in result && result.invoice) {
      toast.success("Sammelrechnung erstellt");
      router.push(`/rechnungen/${result.invoice.id}?orderId=${order.id}`);
    } else {
      toast.error("Fehler beim Erstellen der Rechnung");
    }
  }

  async function handleDeleteInvoice() {
    if (!confirmDeleteInvoiceId) return;
    await deleteInvoice(confirmDeleteInvoiceId);
    toast.success("Rechnung gelöscht");
    setConfirmDeleteInvoiceId(null);
    router.refresh();
  }

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
    toast.success("Auftrag gespeichert");
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

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{order.title}</h1>
              <StatusBadge status={order.status} />
            </div>
            <Link href={`/kontakte/${order.contact.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors mt-1">
              <User className="h-3.5 w-3.5" />
              {order.contact.companyName}
            </Link>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {editing && (
              <>
                <Button variant="outline" className="rounded-lg" onClick={() => setEditing(false)}>Abbrechen</Button>
                <LoadingButton className="rounded-lg" onClick={handleSave} loading={saving}>
                  Speichern
                </LoadingButton>
              </>
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
            <Button
              className="rounded-lg gap-1.5"
              onClick={() => router.push(`/rechnungen/neu?orderId=${order.id}`)}
            >
              <FileText className="h-3.5 w-3.5" />Rechnung erstellen
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="px-4 sm:px-6 py-4 grid grid-cols-2 gap-3 sm:gap-4 border-b border-gray-100 bg-gray-50/60">
        <StatCard label="Status">
          <StatusBadge status={order.status} />
        </StatCard>
        <StatCard label="Auftragssumme">
          <span className="text-xl font-bold text-gray-900">
            {totalPrice !== null
              ? totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
              : "–"}
          </span>
        </StatCard>
      </div>

      {/* ── Tabs ── */}
      <div className="overflow-x-auto border-b border-gray-200 bg-white">
      <div ref={tabContainerRef} className="px-4 md:px-6 flex gap-1 min-w-max md:min-w-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            title={label}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span data-tab-label className={showLabels ? "inline" : "hidden"}>{label}</span>
          </button>
        ))}
      </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 p-6">
        {activeTab === "Details" && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl">
            {/* Auftragsinformationen */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Auftragsinformationen</h3>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-gray-600 transition-colors" title="Bearbeiten">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
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

            {order.quote && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Verknüpftes Angebot</h3>
                <Link href={`/angebote/${order.quote.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                  {order.quote.quoteNumber}
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "Lieferscheine" && (
          <div className="max-w-4xl space-y-3">
            {selectionMode ? (
              <>
                <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-xl px-4 py-3 shadow-sm">
                  <button onClick={exitSelectionMode} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0">
                    <ChevronLeft className="h-4 w-4" />Abbrechen
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {selectedDnIds.size === 0 ? "Keine Lieferscheine ausgewählt" : `${selectedDnIds.size} von ${openDeliveryNotes.length} ausgewählt`}
                    </span>
                  </div>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 flex-shrink-0"
                    onClick={handleCreateInvoiceFromDns} disabled={creatingInvoice || selectedDnIds.size === 0}>
                    <Receipt className="h-3.5 w-3.5" />
                    {creatingInvoice ? "Wird erstellt…" : `Rechnung erstellen (${selectedDnIds.size})`}
                  </Button>
                </div>
                {openDeliveryNotes.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-2 text-center">
                    <Truck className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-400">Keine offenen Lieferscheine</p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="divide-y divide-gray-100">
                      {openDeliveryNotes.map((dn) => {
                        const isSelected = selectedDnIds.has(dn.id);
                        return (
                          <div key={dn.id}
                            className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-gray-50"}`}
                            onClick={() => toggleDn(dn.id)}>
                            <div className="flex-shrink-0">
                              {isSelected ? <CheckSquare className="h-4 w-4 text-blue-500" /> : <Square className="h-4 w-4 text-gray-300" />}
                            </div>
                            <div className="flex-1 min-w-0 grid grid-cols-[80px_1fr_100px_90px] gap-3 items-center">
                              <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                              <span className="text-sm text-gray-700 truncate">{dn.material}</span>
                              <span className="text-xs text-gray-400">{format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}</span>
                              <span className="text-sm font-semibold text-gray-900 text-right tabular-nums">{dn.quantity != null ? dn.quantity.toLocaleString("de-DE") : "–"} {dn.unit}</span>
                            </div>
                            <Link href={`/lieferscheine/${dn.id}?orderId=${order.id}`} onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                              <ChevronRight className="h-4 w-4 text-gray-200" />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/30">
                      <button onClick={toggleAllDn} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        {openDeliveryNotes.every((dn) => selectedDnIds.has(dn.id)) ? "Alle abwählen" : "Alle auswählen"}
                      </button>
                      <span className="text-xs text-gray-400">{selectedDnIds.size} von {openDeliveryNotes.length} ausgewählt</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1" />
                  {(["all", "open", "billed"] as const).map((f) => {
                    const openCount = order.deliveryNotes.filter((dn) => !dn.invoice).length;
                    const billedCount = order.deliveryNotes.filter((dn) => dn.invoice).length;
                    const labels = { all: `Alle (${order.deliveryNotes.length})`, open: `Offen (${openCount})`, billed: `Verrechnet (${billedCount})` };
                    return (
                      <button key={f} onClick={() => setDnFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${dnFilter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                        {labels[f]}
                      </button>
                    );
                  })}
                  {openDeliveryNotes.length > 0 && (
                    <button onClick={enterSelectionMode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
                      <Receipt className="h-3.5 w-3.5" />Rechnung erstellen
                    </button>
                  )}
                </div>
                {order.deliveryNotes.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-2 text-center">
                    <Truck className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-400">Noch keine Lieferscheine</p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                    <div className="grid grid-cols-[80px_1fr_110px_100px_90px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                      {["Nr.", "Material", "Datum", "Menge", "Status", ""].map((h) => (
                        <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                      ))}
                    </div>
                    {(() => {
                      const filtered = dnFilter === "open"
                        ? order.deliveryNotes.filter((dn) => !dn.invoice)
                        : dnFilter === "billed"
                        ? order.deliveryNotes.filter((dn) => dn.invoice)
                        : order.deliveryNotes;
                      return filtered.map((dn, i) => (
                        <Link key={dn.id} href={`/lieferscheine/${dn.id}?orderId=${order.id}`}
                          className={`grid grid-cols-[80px_1fr_110px_100px_90px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i < filtered.length - 1 ? "border-b border-gray-100" : ""}`}>
                          <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                          <span className="text-sm font-medium text-gray-900 truncate pr-3">{dn.material}</span>
                          <span className="text-sm text-gray-400">{format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}</span>
                          <span className="text-sm text-gray-500 font-mono">{dn.quantity != null ? dn.quantity.toLocaleString("de-DE") : "–"} {dn.unit}</span>
                          {dn.invoice
                            ? <span className="text-xs font-medium text-green-600 truncate">{dn.invoice.invoiceNumber}</span>
                            : <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full w-fit">Offen</span>
                          }
                          <div className="flex items-center justify-end">
                            <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
                          </div>
                        </Link>
                      ));
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "Rechnungen" && (
          <div className="max-w-4xl">
            {order.invoices.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-2 text-center">
                <Receipt className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">Noch keine Rechnungen vorhanden</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <div className="grid grid-cols-[100px_120px_1fr_100px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Nr.", "Datum", "Betrag", "Status", ""].map((h) => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {order.invoices.map((inv, i) => {
                  const invStatusColors: Record<string, string> = {
                    ENTWURF: "bg-gray-100 text-gray-600",
                    VERSENDET: "bg-blue-50 text-blue-700",
                    BEZAHLT: "bg-green-50 text-green-700",
                    STORNIERT: "bg-red-50 text-red-600",
                  };
                  const invStatusLabels: Record<string, string> = {
                    ENTWURF: "Entwurf", VERSENDET: "Versendet", BEZAHLT: "Bezahlt", STORNIERT: "Storniert",
                  };
                  return (
                    <Link key={inv.id} href={`/rechnungen/${inv.id}?orderId=${order.id}`}
                      className={`grid grid-cols-[100px_120px_1fr_100px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i < order.invoices.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="font-mono text-xs text-gray-400">{inv.invoiceNumber}</span>
                      <span className="text-sm text-gray-400">{format(new Date(inv.invoiceDate), "dd.MM.yyyy", { locale: de })}</span>
                      <span className="text-sm font-medium text-gray-900">{inv.totalAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${invStatusColors[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {invStatusLabels[inv.status] ?? inv.status}
                      </span>
                      <div className="flex items-center justify-end gap-1">
                        {inv.status === "ENTWURF" ? (
                          <button onClick={(e) => { e.preventDefault(); setConfirmDeleteInvoiceId(inv.id); }}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1" title="Rechnung löschen">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="p-1"><Trash2 className="h-3.5 w-3.5 text-gray-200" /></span>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "Baustellen" && (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                Baustellen ({order.baustellen.length})
              </h3>
              <Link href={`/baustellen/neu?orderId=${order.id}`}>
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Neue Baustelle
                </Button>
              </Link>
            </div>
            {order.baustellen.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <HardHat className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-medium text-gray-500">Noch keine Baustellen</p>
                <p className="text-xs text-gray-400 mt-1">Erstelle die erste Baustelle für diesen Auftrag.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_80px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Baustellenname", "Status", "Start", "Ende", ""].map((h) => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {order.baustellen.map((b, i) => {
                  const statusColors: Record<string, string> = {
                    PLANNED: "bg-gray-100 text-gray-600",
                    ACTIVE: "bg-blue-50 text-blue-700",
                    PENDING: "bg-red-50 text-red-700",
                    INVOICED: "bg-orange-50 text-orange-700",
                    COMPLETED: "bg-green-50 text-green-700",
                  };
                  const statusLabelsB: Record<string, string> = {
                    PLANNED: "Geplant", ACTIVE: "Aktiv", PENDING: "Ausstehend", INVOICED: "In Abrechnung", COMPLETED: "Abgeschlossen",
                  };
                  return (
                    <div key={b.id} className={`grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_80px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i !== order.baustellen.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                        {(b.address || b.city) && (
                          <p className="text-xs text-gray-400 truncate">{[b.address, b.city].filter(Boolean).join(", ")}</p>
                        )}
                      </div>
                      <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[b.status]}`}>
                        {statusLabelsB[b.status]}
                      </span>
                      <span className="text-sm text-gray-500">{format(new Date(b.startDate), "dd.MM.yyyy", { locale: de })}</span>
                      <span className="text-sm text-gray-500">{b.endDate ? format(new Date(b.endDate), "dd.MM.yyyy", { locale: de }) : "–"}</span>
                      <div className="flex justify-end">
                        <Link href={`/baustellen/${b.id}`} className="text-gray-300 hover:text-blue-600 transition-colors" title="Bearbeiten">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {activeTab === "Aktivität" && (
          <OrderActivityTab events={activity} />
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteInvoiceId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteInvoiceId(null); }}
        title="Rechnung löschen"
        description="Die Rechnung wird unwiderruflich gelöscht. Alle verknüpften Lieferscheine werden wieder auf offen gesetzt."
        onConfirm={handleDeleteInvoice}
      />
    </div>
  );
}
