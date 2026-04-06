"use client";

import React, { useState } from "react";
import { useTabLabels } from "@/hooks/use-tab-labels";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, Pencil, FileUp, Receipt, User, MapPin, Euro, ClipboardList, HardHat, Plus, Trash2, Activity, FileText, ChevronLeft, ChevronRight, Square, CheckSquare, Truck, Layers, Circle, CalendarCheck, CheckCircle2 } from "lucide-react";
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
import { deleteDeliveryNote } from "@/actions/delivery-notes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProcessStepper } from "@/components/shared/process-stepper";
import type { Contact, Order, Quote, QuoteItem, Request } from "@prisma/client";

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
  signatureUrl: string | null;
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
  quote: (Quote & { items: QuoteItem[]; request: Request | null }) | null;
  baustellen: BaustelleSummary[];
  deliveryNotes: OrderDeliveryNote[];
  invoices: OrderInvoice[];
};

const statusLabels: Record<string, string> = {
  OPEN: "Offen",
  DISPONIERT: "Disponiert",
  IN_LIEFERUNG: "In Lieferung",
  VERRECHNET: "Verrechnet",
  ABGESCHLOSSEN: "Abgeschlossen",
};

const statusIcons: Record<string, React.ElementType> = {
  OPEN: Circle,
  DISPONIERT: CalendarCheck,
  IN_LIEFERUNG: Truck,
  VERRECHNET: Receipt,
  ABGESCHLOSSEN: CheckCircle2,
};

const statusColors: Record<string, string> = {
  OPEN: "border border-zinc-200 text-zinc-600 bg-zinc-100",
  DISPONIERT: "border border-blue-200 text-blue-700 bg-blue-50",
  IN_LIEFERUNG: "border border-emerald-200 text-emerald-700 bg-emerald-50",
  VERRECHNET: "border border-emerald-300 text-emerald-800 bg-emerald-100",
  ABGESCHLOSSEN: "border border-green-300 text-green-800 bg-green-100",
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
  // Nur unterschriebene & noch nicht verrechnete Lieferscheine sind verrechenbar
  const openDeliveryNotes = order.deliveryNotes.filter((dn) => !dn.invoice && dn.signatureUrl);
  const unsignedDeliveryNotes = order.deliveryNotes.filter((dn) => !dn.invoice && !dn.signatureUrl);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDnIds, setSelectedDnIds] = useState<Set<string>>(new Set());
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [dnFilters, setDnFilters] = useState<("open" | "billed")[]>(["open", "billed"]);
  const [confirmDeleteInvoiceId, setConfirmDeleteInvoiceId] = useState<string | null>(null);
  const [confirmDeleteDnId, setConfirmDeleteDnId] = useState<string | null>(null);
  const [showNoBaustelleDialog, setShowNoBaustelleDialog] = useState(false);
  const [showNoLieferscheinDialog, setShowNoLieferscheinDialog] = useState(false);
  const [showOffeneLieferscheineDialog, setShowOffeneLieferscheineDialog] = useState(false);

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

  async function handleDeleteDn() {
    if (!confirmDeleteDnId) return;
    const result = await deleteDeliveryNote(confirmDeleteDnId);
    if (!result.success) {
      toast.error(result.error ?? "Lieferschein konnte nicht gelöscht werden.");
      return;
    }
    toast.success("Lieferschein gelöscht");
    setConfirmDeleteDnId(null);
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
      await updateOrderStatus(order.id, editStatus as "OPEN" | "DISPONIERT" | "IN_LIEFERUNG" | "VERRECHNET" | "ABGESCHLOSSEN");
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
              <StatusBadge status={order.status} showIcon />
            </div>
            <Link href={`/kontakte/${order.contact.id}?from=/auftraege/${order.id}&fromLabel=${encodeURIComponent(order.orderNumber)}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors mt-1">
              <User className="h-3.5 w-3.5" />
              {order.contact.companyName || [order.contact.firstName, order.contact.lastName].filter(Boolean).join(" ")}
            </Link>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {order.quote && (
              <Button
                variant="outline"
                className="rounded-lg gap-1.5"
                onClick={() => window.open(`/api/pdf/quote/${order.quote!.id}`, "_blank")}
              >
                <FileUp className="h-3.5 w-3.5" />Dokument
              </Button>
            )}

            {/* Status-Aktions-Buttons */}
            {(
              [
                {
                  key: "OPEN",
                  label: "Offen",
                  icon: Circle,
                  activeWhen: [] as string[], // nie ein "Weiter"-Button
                },
                {
                  key: "DISPONIERT",
                  label: "Disponieren",
                  icon: CalendarCheck,
                  activeWhen: ["OPEN"],
                },
                {
                  key: "IN_LIEFERUNG",
                  label: "Lieferung starten",
                  icon: Truck,
                  activeWhen: ["DISPONIERT"],
                },
                {
                  key: "VERRECHNET",
                  label: "Rechnung erstellen",
                  icon: Receipt,
                  activeWhen: ["IN_LIEFERUNG"],
                },
                {
                  key: "ABGESCHLOSSEN",
                  label: "Abschließen",
                  icon: CheckCircle2,
                  activeWhen: ["VERRECHNET"],
                },
              ] as const
            )
              .filter((s) => s.key !== "OPEN")
              .map((step) => {
                const isActive = (step.activeWhen as readonly string[]).includes(order.status);
                const isDone = (() => {
                  const order_steps = ["OPEN", "DISPONIERT", "IN_LIEFERUNG", "VERRECHNET", "ABGESCHLOSSEN"];
                  return order_steps.indexOf(order.status) > order_steps.indexOf(step.key);
                })();
                const StepIcon = step.icon;
                return (
                  <Button
                    key={step.key}
                    variant={isActive ? "default" : "outline"}
                    disabled={!isActive}
                    className={`rounded-lg gap-1.5 transition-opacity ${!isActive && !isDone ? "opacity-40" : ""} ${isDone ? "opacity-50" : ""}`}
                    onClick={async () => {
                      if (!isActive) return;
                      if (step.key === "DISPONIERT") {
                        if (order.baustellen.length === 0) {
                          setShowNoBaustelleDialog(true);
                          return;
                        }
                        await updateOrderStatus(order.id, "DISPONIERT");
                        toast.success(`Status auf „Disponiert" gesetzt`);
                        router.push(`/disposition?orderId=${order.id}&orderTitle=${encodeURIComponent(order.title)}`);
                      } else if (step.key === "IN_LIEFERUNG") {
                        if (order.deliveryNotes.length === 0) {
                          setShowNoLieferscheinDialog(true);
                          return;
                        }
                        await updateOrderStatus(order.id, "IN_LIEFERUNG");
                        toast.success(`Status auf „In Lieferung" gesetzt`);
                        router.refresh();
                      } else if (step.key === "VERRECHNET") {
                        if (openDeliveryNotes.length > 0) {
                          setShowOffeneLieferscheineDialog(true);
                          return;
                        }
                        router.push(`/rechnungen/neu?orderId=${order.id}`);
                      } else {
                        await updateOrderStatus(order.id, step.key);
                        toast.success(`Status auf „${statusLabels[step.key]}" gesetzt`);
                        router.refresh();
                      }
                    }}
                  >
                    <StepIcon className="h-3.5 w-3.5" />
                    {step.label}
                  </Button>
                );
              })}
          </div>
        </div>
      </div>

      {/* ── Process Stepper ── */}
      <div className="px-6 pb-4 pt-3 border-b border-gray-100 bg-white">
        <div className="max-w-lg">
          <ProcessStepper
            requestId={order.quote?.request?.id ?? null}
            requestCreatedAt={order.quote?.request?.createdAt?.toString() ?? null}
            inspectionDone={order.quote?.request?.inspectionStatus === "DONE"}
            inspectionPlanned={!!(order.quote?.request?.inspectionDate && order.quote?.request?.inspectionStatus !== "DONE" && !order.quote?.request?.noInspectionRequired)}
            inspectionDate={order.quote?.request?.inspectionDate?.toString() ?? null}
            noInspectionRequired={order.quote?.request?.noInspectionRequired ?? false}
            quoteId={order.quote?.id ?? null}
            quoteCreatedAt={order.quote?.createdAt?.toString() ?? null}
            quoteStatus={order.quote?.status ?? null}
            contactId={order.contact.id}
            orderId={order.id}
            orderCreatedAt={order.createdAt?.toString() ?? null}
            orderStatus={order.status}
            onOrderStatusChange={async (status) => {
              if (status === "DISPONIERT" && order.baustellen.length === 0) {
                setShowNoBaustelleDialog(true);
                return;
              }
              if (status === "IN_LIEFERUNG" && order.deliveryNotes.length === 0) {
                setShowNoLieferscheinDialog(true);
                return;
              }
              if (status === "VERRECHNET" && (openDeliveryNotes.length > 0 || unsignedDeliveryNotes.length > 0)) {
                setShowOffeneLieferscheineDialog(true);
                return;
              }
              await updateOrderStatus(order.id, status);
              toast.success(`Status auf „${statusLabels[status]}" gesetzt`);
              if (status === "DISPONIERT") {
                router.push(`/disposition?orderId=${order.id}&orderTitle=${encodeURIComponent(order.title)}`);
              } else {
                router.refresh();
              }
            }}
          />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="px-4 sm:px-6 py-4 grid grid-cols-1 gap-3 sm:gap-4 border-b border-gray-100 bg-gray-50/60">
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
        {TABS.map(({ key, label, icon: Icon }) => {
          const count =
            key === "Baustellen" ? order.baustellen.length :
            key === "Lieferscheine" ? order.deliveryNotes.length :
            key === "Rechnungen" ? order.invoices.length :
            null;
          return (
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
              {count !== null && count > 0 && (
                <span data-tab-label className={showLabels ? "inline text-xs text-gray-400" : "hidden"}>({count})</span>
              )}
            </button>
          );
        })}
      </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 p-6">
        {activeTab === "Details" && (
          <div className="max-w-xl">
            {/* Auftragsinformationen */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Auftragsinformationen</h3>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg h-8" onClick={() => setEditing(false)}>Abbrechen</Button>
                    <LoadingButton size="sm" className="rounded-lg h-8" onClick={handleSave} loading={saving}>Speichern</LoadingButton>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
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
                        <SelectValue>
                          {(() => {
                            const Icon = statusIcons[editStatus];
                            const colorClass = {
                              OPEN: "text-zinc-500",
                              DISPONIERT: "text-blue-600",
                              IN_LIEFERUNG: "text-emerald-600",
                              VERRECHNET: "text-emerald-700",
                              ABGESCHLOSSEN: "text-green-700",
                            }[editStatus] ?? "text-gray-500";
                            return (
                              <div className="flex items-center gap-2">
                                {Icon && <Icon className={`h-3.5 w-3.5 ${colorClass}`} />}
                                {statusLabels[editStatus]}
                              </div>
                            );
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([v, l]) => {
                          const Icon = statusIcons[v];
                          const colorClass = {
                            OPEN: "text-blue-600",
                            DISPONIERT: "text-violet-600",
                            IN_LIEFERUNG: "text-amber-600",
                            VERRECHNET: "text-teal-600",
                            ABGESCHLOSSEN: "text-gray-400",
                          }[v] ?? "text-gray-500";
                          return (
                            <SelectItem key={v} value={v}>
                              <div className="flex items-center gap-2">
                                {Icon && <Icon className={`h-3.5 w-3.5 ${colorClass}`} />}
                                {l}
                              </div>
                            </SelectItem>
                          );
                        })}
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
                    <Link href={`/kontakte/${order.contact.id}?from=/auftraege/${order.id}&fromLabel=${encodeURIComponent(order.orderNumber)}`} className="text-blue-600 hover:underline">
                      {order.contact.companyName || [order.contact.firstName, order.contact.lastName].filter(Boolean).join(" ") || "–"}
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
                  {order.quote && (
                    <InfoItem icon={Layers} label="Verknüpftes Angebot">
                      <Link href={`/angebote/${order.quote.id}`} className="text-blue-600 hover:underline">
                        Angebot {order.quote.quoteNumber}
                      </Link>
                    </InfoItem>
                  )}
                </div>
              )}
            </div>
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
                  <div className="flex-1 flex items-center gap-2">
                    {(["open", "billed"] as const).map((f) => {
                      const openCount = order.deliveryNotes.filter((dn) => !dn.invoice).length;
                      const billedCount = order.deliveryNotes.filter((dn) => dn.invoice).length;
                      const labels = { open: `Offen (${openCount})`, billed: `Verrechnet (${billedCount})` };
                      const active = dnFilters.includes(f);
                      return (
                        <button key={f}
                          onClick={() => setDnFilters(prev => prev.includes(f) ? prev.length === 1 ? prev : prev.filter(k => k !== f) : [...prev, f])}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border whitespace-nowrap ${active ? "bg-white border-gray-300 text-gray-900 shadow-sm" : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"}`}>
                          {labels[f]}
                        </button>
                      );
                    })}
                  </div>
                  {openDeliveryNotes.length > 0 && (
                    <button onClick={enterSelectionMode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors">
                      <Receipt className="h-3.5 w-3.5" />Rechnung erstellen
                    </button>
                  )}
                  <Link href={`/lieferscheine/neu?orderId=${order.id}`}>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                      <Plus className="h-4 w-4" />
                      Neuer Lieferschein
                    </Button>
                  </Link>
                </div>
                {order.deliveryNotes.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-2 text-center">
                    <Truck className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-400">Noch keine Lieferscheine</p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                    <div className="grid grid-cols-[80px_1fr_110px_100px_90px_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                      {["Nr.", "Material", "Datum", "Menge", "Status", ""].map((h) => (
                        <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                      ))}
                    </div>
                    {(() => {
                      const filtered = order.deliveryNotes.filter((dn) =>
                        (dnFilters.includes("open") && !dn.invoice) ||
                        (dnFilters.includes("billed") && dn.invoice)
                      );
                      return filtered.map((dn, i) => (
                        <Link key={dn.id} href={`/lieferscheine/${dn.id}?orderId=${order.id}`}
                          className={`grid grid-cols-[80px_1fr_110px_100px_90px_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i < filtered.length - 1 ? "border-b border-gray-100" : ""}`}>
                          <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                          <span className="text-sm font-medium text-gray-900 truncate pr-3">{dn.material}</span>
                          <span className="text-sm text-gray-400">{format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}</span>
                          <span className="text-sm text-gray-500 font-mono">{dn.quantity != null ? dn.quantity.toLocaleString("de-DE") : "–"} {dn.unit}</span>
                          {dn.invoice
                            ? <span className="text-xs font-medium text-green-600 truncate">{dn.invoice.invoiceNumber}</span>
                            : dn.signatureUrl
                              ? <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit">Unterschrieben</span>
                              : <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full w-fit">Offen</span>
                          }
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
                            {(() => {
                              const blocked = !!dn.invoice;
                              return (
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!blocked) setConfirmDeleteDnId(dn.id); }}
                                  className={`p-1.5 transition-colors ${blocked ? "text-gray-200 cursor-not-allowed" : "text-gray-300 hover:text-red-400"}`}
                                  title={blocked ? "Verrecheneter Lieferschein kann nicht gelöscht werden" : "Löschen"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              );
                            })()}
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
            <div className="flex items-center justify-end mb-4">
              <Link href={`/baustellen/neu?orderId=${order.id}`}>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
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
                <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Baustellenname", "Status", "Start", "Ende", ""].map((h) => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {order.baustellen.map((b, i) => {
                  const statusColors: Record<string, string> = {
                    OPEN: "bg-gray-100 text-gray-600",
                    DISPONIERT: "bg-blue-50 text-blue-700",
                    IN_LIEFERUNG: "bg-emerald-50 text-emerald-700",
                    VERRECHNET: "bg-emerald-100 text-emerald-800",
                    ABGESCHLOSSEN: "bg-green-50 text-green-700",
                  };
                  const statusLabelsB: Record<string, string> = {
                    OPEN: "Offen", DISPONIERT: "Disponiert", IN_LIEFERUNG: "In Lieferung", VERRECHNET: "Verrechnet", ABGESCHLOSSEN: "Abgeschlossen",
                  };
                  return (
                    <Link key={b.id} href={`/baustellen/${b.id}`} className={`grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i !== order.baustellen.length - 1 ? "border-b border-gray-100" : ""}`}>
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
                      <div className="flex items-center justify-end gap-1">
                        <span className="p-1"><Trash2 className="h-3.5 w-3.5 text-gray-200" /></span>
                        <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </Link>
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
        description="Die Rechnung wird unwiderruflich gelöscht. Verknüpfte Lieferscheine bleiben unterschrieben und sind wieder verrechenbar."
        onConfirm={handleDeleteInvoice}
      />

      <ConfirmDialog
        open={!!confirmDeleteDnId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteDnId(null); }}
        title="Lieferschein löschen"
        description="Dieser Lieferschein wird unwiderruflich gelöscht."
        onConfirm={handleDeleteDn}
      />

      <ConfirmDialog
        open={showNoBaustelleDialog}
        onOpenChange={(open) => { if (!open) setShowNoBaustelleDialog(false); }}
        title="Keine Baustelle vorhanden"
        description="Bevor du den Auftrag disponieren kannst, muss zuerst eine Baustelle angelegt werden."
        confirmLabel="Zur Baustelle"
        cancelLabel="Abbrechen"
        onConfirm={() => {
          setShowNoBaustelleDialog(false);
          router.push(`/baustellen/neu?orderId=${order.id}`);
        }}
      />

      <ConfirmDialog
        open={showNoLieferscheinDialog}
        onOpenChange={(open) => { if (!open) setShowNoLieferscheinDialog(false); }}
        title="Kein Lieferschein vorhanden"
        description={'Bevor du den Auftrag auf \u201eIn Lieferung\u201c setzen kannst, muss zuerst ein Lieferschein angelegt werden.'}
        confirmLabel="Lieferschein anlegen"
        cancelLabel="Abbrechen"
        onConfirm={() => {
          setShowNoLieferscheinDialog(false);
          setActiveTab("Lieferscheine");
        }}
      />

      <ConfirmDialog
        open={showOffeneLieferscheineDialog}
        onOpenChange={(open) => { if (!open) setShowOffeneLieferscheineDialog(false); }}
        title="Lieferscheine noch nicht verrechnet"
        description={
          unsignedDeliveryNotes.length > 0
            ? `Es gibt noch ${unsignedDeliveryNotes.length} nicht unterschriebene${unsignedDeliveryNotes.length !== 1 ? " Lieferscheine" : "n Lieferschein"}. Nur unterschriebene Lieferscheine können verrechnet werden.`
            : `Es gibt noch ${openDeliveryNotes.length} unterschriebene${openDeliveryNotes.length !== 1 ? " Lieferscheine" : "n Lieferschein"}, die noch nicht verrechnet wurden. Bitte zuerst eine Rechnung erstellen.`
        }
        confirmLabel="Zu den Lieferscheinen"
        cancelLabel="Abbrechen"
        onConfirm={() => {
          setShowOffeneLieferscheineDialog(false);
          setActiveTab("Lieferscheine");
        }}
      />
    </div>
  );
}
