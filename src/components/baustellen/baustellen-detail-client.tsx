"use client";

import { useState } from "react";
import { useTabLabels } from "@/hooks/use-tab-labels";
import { useEscapeKey } from "@/hooks/use-escape-key";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft, Pencil, Plus, Trash2, X, Info, CalendarDays, FileText, FolderOpen, User, Truck, ChevronRight, ChevronLeft, Receipt, Square, CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  updateBaustelle,
  deleteBaustelleDispositionEntry,
  deleteTagesrapport,
} from "@/actions/baustellen";
import { deleteDeliveryNote } from "@/actions/delivery-notes";
import { createInvoiceFromDeliveryNotes, deleteInvoice } from "@/actions/invoices";
import type { BaustelleStatusType } from "@/actions/baustellen";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<BaustelleStatusType, string> = {
  PLANNED: "Geplant", ACTIVE: "Aktiv", PENDING: "Ausstehend", INVOICED: "In Abrechnung", COMPLETED: "Abgeschlossen",
};
const STATUS_COLOR: Record<BaustelleStatusType, string> = {
  PLANNED: "border-gray-300 text-gray-600 bg-gray-50",
  ACTIVE: "border-blue-300 text-blue-700 bg-blue-50",
  PENDING: "border-red-300 text-red-700 bg-red-50",
  INVOICED: "border-orange-300 text-orange-700 bg-orange-50",
  COMPLETED: "border-green-300 text-green-700 bg-green-50",
};
const TYPE_LABEL: Record<string, string> = {
  FAHRER: "Fahrer", MASCHINE: "Maschine", FAHRZEUG: "Fahrzeug", OTHER: "Sonstiges",
};
const TYPE_COLOR: Record<string, string> = {
  FAHRER: "bg-blue-100 text-blue-700",
  MASCHINE: "bg-orange-100 text-orange-700",
  FAHRZEUG: "bg-green-100 text-green-700",
  OTHER: "bg-gray-100 text-gray-600",
};
const IC = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function fmt(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>{children}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderOption = { id: string; orderNumber: string; title: string };

type DispositionEntry = {
  id: string; startDate: Date; endDate: Date; notes: string | null;
  resource: { id: string; name: string; type: string };
};

type Baustelle = {
  id: string;
  orderId: string | null;
  contactId: string | null;
  name: string;
  description: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  startDate: Date;
  endDate: Date | null;
  status: BaustelleStatusType;
  bauleiter: string | null;
  contactPerson: string | null;
  phone: string | null;
  notes: string | null;
  order: OrderOption;
  contact: { id: string; companyName: string; firstName: string | null; lastName: string | null } | null;
  dispositionEntries: DispositionEntry[];
  rapporte: Array<{
    id: string; date: Date; driverName: string | null; machineName: string | null;
    hours: number | null; employees: number | null; description: string | null;
  }>;
  deliveryNotes: Array<{
    id: string; deliveryNumber: string; date: Date; material: string;
    quantity: number | null; unit: string; driver: string | null;
    signatureUrl: string | null;
    invoice: { id: string; invoiceNumber: string; status: string } | null;
  }>;
  invoices: Array<{
    id: string; invoiceNumber: string; invoiceDate: Date; totalAmount: number; status: string;
  }>;
  contactId: string | null;
};

interface Props {
  baustelle: Baustelle;
  orders: OrderOption[];
  userNames: string[];
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BaustellenDetailClient({ baustelle: init, orders, userNames }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [b, setB] = useState(init);
  const initialTab = (searchParams.get("tab") as "overview" | "dispo" | "rapporte" | "lieferscheine" | "rechnungen" | "dokumente" | null) ?? "overview";
  const [tab, setTab] = useState<"overview" | "dispo" | "rapporte" | "lieferscheine" | "rechnungen" | "dokumente">(initialTab);
  const { containerRef: tabContainerRef, showLabels } = useTabLabels();

  // ── Overview edit ──────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  useEscapeKey(() => setEditMode(false), editMode);
  const [ef, setEf] = useState({
    orderId: b.orderId ?? "",
    name: b.name,
    description: b.description ?? "",
    address: b.address ?? "",
    postalCode: b.postalCode ?? "",
    city: b.city ?? "",
    startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : "",
    endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 10) : "",
    status: b.status,
    bauleiter: b.bauleiter ?? "",
    contactPerson: b.contactPerson ?? "",
    phone: b.phone ?? "",
    notes: b.notes ?? "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleSaveEdit() {
    setSavingEdit(true);
    const r = await updateBaustelle(b.id, { ...ef, country: b.country });
    setSavingEdit(false);
    if ("error" in r) { toast.error("Fehler"); return; }
    setB((prev) => ({ ...prev, ...r.baustelle }));
    setEditMode(false);
    toast.success("Baustelle gespeichert");
    router.refresh();
  }

  // ── Disposition ────────────────────────────────────────────────────────────
  const [deleteDispoId, setDeleteDispoId] = useState<string | null>(null);

  async function confirmDeleteDispo() {
    if (!deleteDispoId) return;
    await deleteBaustelleDispositionEntry(deleteDispoId, b.id);
    setB(prev => ({ ...prev, dispositionEntries: prev.dispositionEntries.filter(e => e.id !== deleteDispoId) }));
    toast.success("Einsatz gelöscht");
    router.refresh();
  }

  // ── Rapport ────────────────────────────────────────────────────────────────
  const [deleteRapportId, setDeleteRapportId] = useState<string | null>(null);
  const [deleteLieferscheinId, setDeleteLieferscheinId] = useState<string | null>(null);

  // ── Lieferschein selection / invoice creation ──────────────────────────────
  const openDeliveryNotes = b.deliveryNotes.filter((dn) => !dn.invoice);
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
    if (!b.contactId || ids.length === 0) { toast.error("Keine Lieferscheine ausgewählt"); return; }
    setCreatingInvoice(true);
    const result = await createInvoiceFromDeliveryNotes(b.contactId, ids, b.orderId ?? undefined);
    setCreatingInvoice(false);
    if ("invoice" in result && result.invoice) {
      toast.success("Sammelrechnung erstellt");
      router.push(`/rechnungen/${result.invoice.id}?baustelleId=${b.id}&baustelleName=${encodeURIComponent(b.name)}`);
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

  async function confirmDeleteRapport() {
    if (!deleteRapportId) return;
    await deleteTagesrapport(deleteRapportId, b.id);
    setB(prev => ({ ...prev, rapporte: prev.rapporte.filter(r => r.id !== deleteRapportId) }));
    toast.success("Eintrag gelöscht");
    router.refresh();
  }

  async function confirmDeleteLieferschein() {
    if (!deleteLieferscheinId) return;
    const result = await deleteDeliveryNote(deleteLieferscheinId);
    if (!result.success) {
      toast.error(result.error ?? "Lieferschein konnte nicht gelöscht werden.");
      setDeleteLieferscheinId(null);
      return;
    }
    setB(prev => ({ ...prev, deliveryNotes: prev.deliveryNotes.filter(d => d.id !== deleteLieferscheinId) }));
    setDeleteLieferscheinId(null);
    toast.success("Lieferschein gelöscht");
  }

  // ── Resource overview (from disposition) ──────────────────────────────────
  const now = new Date();
  const activeNow = b.dispositionEntries.filter(
    e => new Date(e.startDate) <= now && new Date(e.endDate) >= now
  );
  const upcoming = b.dispositionEntries
    .filter(e => new Date(e.startDate) > now)
    .sort((a, z) => new Date(a.startDate).getTime() - new Date(z.startDate).getTime());

  const TABS = [
    { key: "overview" as const, label: "Übersicht", icon: Info },
    { key: "dispo" as const, label: "Disposition", icon: CalendarDays, count: b.dispositionEntries.length },
    { key: "rapporte" as const, label: "Bautagebuch", icon: FileText, count: b.rapporte.length },
    { key: "lieferscheine" as const, label: "Lieferscheine", icon: Truck, count: b.deliveryNotes.length },
    { key: "rechnungen" as const, label: "Rechnungen", icon: Receipt, count: b.invoices.length },
    { key: "dokumente" as const, label: "Dokumente", icon: FolderOpen },
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/baustellen" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-3.5 w-3.5" />
            Baustellen
          </Link>
          {b.orderId && b.order && (
            <Link href={`/auftraege/${b.orderId}?tab=Baustellen`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-3.5 w-3.5" />
              {b.order.orderNumber} {b.order.title}
            </Link>
          )}
        </div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{b.name}</h1>
              <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLOR[b.status]}`}>
                {STATUS_LABEL[b.status]}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              {b.order ? `${b.order.orderNumber} ${b.order.title}` : "Kein Auftrag"}
              {(b.address || b.city) && <> · {[b.address, b.city].filter(Boolean).join(", ")}</>}
            </p>
          </div>
        </div>
        {/* Tabs */}
        <div className="overflow-hidden mt-4">
        <div ref={tabContainerRef} className="flex items-center gap-1">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              title={label}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                tab === key
                  ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span data-tab-label className={showLabels ? "inline" : "hidden"}>{label}</span>
              {count !== undefined && count > 0 && <span data-tab-label className={showLabels ? "inline text-xs text-gray-400" : "hidden"}>({count})</span>}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className="flex-1 p-6">

        {/* ── TAB: Übersicht ─────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="max-w-2xl space-y-5">

            {/* Stammdaten */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Stammdaten</h2>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} className="text-gray-300 hover:text-gray-600 transition-colors" title="Bearbeiten">
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Abbrechen</Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                      {savingEdit ? "Speichert..." : "Speichern"}
                    </Button>
                  </div>
                )}
              </div>
              {!editMode ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    ["Baustellenname", b.name],
                    ["Auftrag", b.order ? `${b.order.orderNumber} – ${b.order.title}` : "–"],
                    ["Adresse", b.address],
                    ["PLZ / Ort", [b.postalCode, b.city].filter(Boolean).join(" ")],
                    ["Startdatum", fmt(b.startDate)],
                    ["Enddatum", b.endDate ? fmt(b.endDate) : "–"],
                    ["Status", STATUS_LABEL[b.status]],
                    ["Bauleiter", b.bauleiter],
                    ["Kontaktperson", b.contactPerson],
                    ["Telefon", b.phone],
                  ].map(([l, v]) => (
                    <div key={String(l)}>
                      <dt className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{l}</dt>
                      <dd className="text-sm text-gray-900 mt-0.5">{v ?? "–"}</dd>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <dt className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakt</dt>
                    <dd className="text-sm mt-0.5">
                      {(() => {
                        const c = b.contact ?? (b.order as any)?.contact ?? null;
                        return c ? (
                          <Link href={`/kontakte/${c.id}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                            <User className="h-3.5 w-3.5" />
                            {c.companyName}
                            {(c.firstName || c.lastName) && <span className="text-gray-400">· {[c.firstName, c.lastName].filter(Boolean).join(" ")}</span>}
                          </Link>
                        ) : (
                          <span className="text-gray-400">–</span>
                        );
                      })()}
                    </dd>
                  </div>
                  {b.description && (
                    <div className="col-span-2">
                      <dt className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Beschreibung</dt>
                      <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-line">{b.description}</dd>
                    </div>
                  )}
                  {b.notes && (
                    <div className="col-span-2">
                      <dt className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</dt>
                      <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-line">{b.notes}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name *"><input type="text" className={IC} value={ef.name} onChange={e => setEf(f => ({ ...f, name: e.target.value }))} /></Field>
                    <Field label="Auftrag">
                      <select className={IC} value={ef.orderId} onChange={e => setEf(f => ({ ...f, orderId: e.target.value }))}>
                        <option value="">– Kein Auftrag –</option>
                        {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber} – {o.title}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Adresse"><input type="text" className={IC} value={ef.address} onChange={e => setEf(f => ({ ...f, address: e.target.value }))} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="PLZ"><input type="text" className={IC} value={ef.postalCode} onChange={e => setEf(f => ({ ...f, postalCode: e.target.value }))} /></Field>
                    <Field label="Ort"><input type="text" className={IC} value={ef.city} onChange={e => setEf(f => ({ ...f, city: e.target.value }))} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Startdatum"><input type="date" className={IC} value={ef.startDate} onChange={e => setEf(f => ({ ...f, startDate: e.target.value }))} /></Field>
                    <Field label="Enddatum"><input type="date" className={IC} value={ef.endDate} onChange={e => setEf(f => ({ ...f, endDate: e.target.value }))} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bauleiter">
                      <select className={IC} value={ef.bauleiter} onChange={e => setEf(f => ({ ...f, bauleiter: e.target.value }))}>
                        <option value="">– Kein Bauleiter –</option>
                        {userNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select className={IC} value={ef.status} onChange={e => setEf(f => ({ ...f, status: e.target.value as BaustelleStatusType }))}>
                        <option value="PLANNED">Geplant</option>
                        <option value="ACTIVE">Aktiv</option>
                        <option value="COMPLETED">Abgeschlossen</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Kontaktperson"><input type="text" className={IC} value={ef.contactPerson} onChange={e => setEf(f => ({ ...f, contactPerson: e.target.value }))} /></Field>
                    <Field label="Telefon"><input type="tel" className={IC} value={ef.phone} onChange={e => setEf(f => ({ ...f, phone: e.target.value }))} /></Field>
                  </div>
                  <Field label="Beschreibung"><textarea rows={2} className={`${IC} resize-none`} value={ef.description} onChange={e => setEf(f => ({ ...f, description: e.target.value }))} /></Field>
                  <Field label="Notizen"><textarea rows={2} className={`${IC} resize-none`} value={ef.notes} onChange={e => setEf(f => ({ ...f, notes: e.target.value }))} /></Field>
                </div>
              )}
            </div>

            {/* Ressourcen-Übersicht (read-only, aus Disposition) */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Ressourcen</h2>
                <a
                  href={`/disposition?baustelleId=${b.id}&baustelleName=${encodeURIComponent(b.name)}&week=${new Date(b.startDate).toISOString().split('T')[0]}`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Im Disposition planen
                </a>
              </div>

              {/* Aktuell im Einsatz */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Heute im Einsatz</p>
                {activeNow.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Keine Ressourcen aktuell eingeplant</p>
                ) : (
                  <div className="space-y-1.5">
                    {activeNow.map(e => (
                      <div key={e.id} className="flex items-center gap-2.5 py-1.5 px-3 bg-green-50 border border-green-100 rounded-lg">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLOR[e.resource.type] ?? "bg-gray-100 text-gray-600"}`}>
                          {TYPE_LABEL[e.resource.type] ?? e.resource.type}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{e.resource.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmt(e.startDate)} – {fmt(e.endDate)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kommende Einsätze */}
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Kommende Einsätze</p>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Keine bevorstehenden Einsätze</p>
                ) : (
                  <div className="space-y-1.5">
                    {upcoming.slice(0, 5).map(e => (
                      <div key={e.id} className="flex items-center gap-2.5 py-1.5 px-3 bg-gray-50 border border-gray-100 rounded-lg">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_COLOR[e.resource.type] ?? "bg-gray-100 text-gray-600"}`}>
                          {TYPE_LABEL[e.resource.type] ?? e.resource.type}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{e.resource.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmt(e.startDate)} – {fmt(e.endDate)}</span>
                      </div>
                    ))}
                    {upcoming.length > 5 && (
                      <p className="text-xs text-gray-400 pl-1">+{upcoming.length - 5} weitere →{" "}
                        <button onClick={() => setTab("dispo")} className="text-blue-500 hover:underline">Alle anzeigen</button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Disposition ───────────────────────────────────────────── */}
        {tab === "dispo" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Geplante Einsätze</h2>
              <Link
                href={`/disposition?baustelleId=${b.id}&baustelleName=${encodeURIComponent(b.name)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
              >
                <CalendarDays className="h-4 w-4" />Im Disposition öffnen
              </Link>
            </div>
            {b.dispositionEntries.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Einsätze geplant</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_2fr_1fr_56px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Von", "Bis", "Ressource", "Notizen", ""].map(h => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {b.dispositionEntries.map((entry, i) => (
                  <div key={entry.id} className={`grid grid-cols-[1fr_1fr_2fr_1fr_56px] gap-3 px-5 py-3 items-center hover:bg-gray-50 ${i !== b.dispositionEntries.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <p className="text-sm text-gray-900">{fmt(entry.startDate)}</p>
                    <p className="text-sm text-gray-500">{fmt(entry.endDate)}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLOR[entry.resource.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {TYPE_LABEL[entry.resource.type] ?? entry.resource.type}
                      </span>
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.resource.name}</p>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{entry.notes || "–"}</p>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={(ev) => { ev.stopPropagation(); setDeleteDispoId(entry.id); }} className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">Einträge werden zentral im Dispositionsmodul verwaltet.</p>
          </div>
        )}

        {/* ── TAB: Bautagebuch ──────────────────────────────────────────── */}
        {tab === "rapporte" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Bautagebuch</h2>
            </div>
            {b.rapporte.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Einträge vorhanden</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1.5fr_1.5fr_0.7fr_0.7fr_2fr_56px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Datum", "Fahrer", "Maschine", "Stunden", "MA", "Beschreibung", ""].map(h => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {b.rapporte.map((r, i) => (
                  <div key={r.id} className={`grid grid-cols-[1fr_1.5fr_1.5fr_0.7fr_0.7fr_2fr_56px] gap-3 px-5 py-3 items-center hover:bg-gray-50 ${i !== b.rapporte.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <p className="text-sm text-gray-900">{fmt(r.date)}</p>
                    <p className="text-sm text-gray-500">{r.driverName || "–"}</p>
                    <p className="text-sm text-gray-500">{r.machineName || "–"}</p>
                    <p className="text-sm text-gray-500">{r.hours != null ? `${r.hours} h` : "–"}</p>
                    <p className="text-sm text-gray-500">{r.employees != null ? r.employees : "–"}</p>
                    <p className="text-sm text-gray-500 truncate">{r.description || "–"}</p>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={(ev) => { ev.stopPropagation(); setDeleteRapportId(r.id); }} className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Lieferscheine ─────────────────────────────────────────── */}
        {tab === "lieferscheine" && (
          <div className="space-y-3">
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
                            <Link href={`/lieferscheine/${dn.id}?baustelleId=${b.id}&baustelleName=${encodeURIComponent(b.name)}`} onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
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
                  <Link
                    href={`/lieferscheine/neu?baustelleId=${b.id}${b.orderId ? `&orderId=${b.orderId}` : ""}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
                  >
                    <Plus className="h-4 w-4" />Neuer Lieferschein
                  </Link>
                  <div className="flex-1" />
                  {(["all", "open", "billed"] as const).map((f) => {
                    const openCount = b.deliveryNotes.filter((dn) => !dn.invoice).length;
                    const billedCount = b.deliveryNotes.filter((dn) => dn.invoice).length;
                    const labels = { all: `Alle (${b.deliveryNotes.length})`, open: `Offen (${openCount})`, billed: `Verrechnet (${billedCount})` };
                    return (
                      <button key={f} onClick={() => setDnFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${dnFilter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                        {labels[f]}
                      </button>
                    );
                  })}
                  {openDeliveryNotes.length > 0 && b.contactId && (
                    <button onClick={enterSelectionMode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
                      <Receipt className="h-3.5 w-3.5" />Rechnung erstellen
                    </button>
                  )}
                </div>
                {b.deliveryNotes.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-2 text-center">
                    <Truck className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-400">Noch keine Lieferscheine erfasst</p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                    <div className="grid grid-cols-[80px_1fr_110px_100px_90px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                      {["Nr.", "Material", "Datum", "Menge", "Status", ""].map(h => (
                        <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                      ))}
                    </div>
                    {(() => {
                      const filtered = dnFilter === "open"
                        ? b.deliveryNotes.filter((dn) => !dn.invoice)
                        : dnFilter === "billed"
                        ? b.deliveryNotes.filter((dn) => dn.invoice)
                        : b.deliveryNotes;
                      return filtered.map((dn, i) => (
                        <Link key={dn.id} href={`/lieferscheine/${dn.id}?baustelleId=${b.id}&baustelleName=${encodeURIComponent(b.name)}`}
                          className={`group grid grid-cols-[80px_1fr_110px_100px_90px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < filtered.length - 1 ? "border-b border-gray-100" : ""}`}>
                          <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                          <span className="text-sm font-medium text-gray-900 truncate pr-3">{dn.material}</span>
                          <span className="text-sm text-gray-400">{format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}</span>
                          <span className="text-sm text-gray-500 font-mono">{dn.quantity != null ? dn.quantity.toLocaleString("de-DE") : "–"} {dn.unit}</span>
                          {dn.invoice
                            ? <span className="text-xs font-medium text-green-600 truncate">{dn.invoice.invoiceNumber}</span>
                            : <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full w-fit">Offen</span>
                          }
                          <div className="flex items-center justify-end gap-1">
                            {(() => {
                              const blocked = dn.invoice?.status === "VERSENDET" || dn.invoice?.status === "BEZAHLT";
                              return (
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!blocked) setDeleteLieferscheinId(dn.id); }}
                                  className={`transition-colors p-0.5 ${blocked ? "text-gray-200 cursor-not-allowed" : "text-gray-300 hover:text-red-400"}`}
                                  title={blocked ? "Rechnung bereits versendet oder bezahlt" : "Löschen"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              );
                            })()}
                            <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors flex-shrink-0" />
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

        {/* ── TAB: Rechnungen ────────────────────────────────────────────── */}
        {tab === "rechnungen" && (
          <div>
            {b.invoices.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-2 text-center">
                <Receipt className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">Noch keine Rechnungen vorhanden</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <div className="grid grid-cols-[100px_120px_1fr_100px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Nr.", "Datum", "Betrag", "Status", ""].map(h => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {b.invoices.map((inv, i) => {
                  const invStatusColors: Record<string, string> = {
                    ENTWURF: "bg-gray-100 text-gray-600", VERSENDET: "bg-blue-50 text-blue-700",
                    BEZAHLT: "bg-green-50 text-green-700", STORNIERT: "bg-red-50 text-red-600",
                  };
                  const invStatusLabels: Record<string, string> = {
                    ENTWURF: "Entwurf", VERSENDET: "Versendet", BEZAHLT: "Bezahlt", STORNIERT: "Storniert",
                  };
                  return (
                    <Link key={inv.id} href={`/rechnungen/${inv.id}?baustelleId=${b.id}&baustelleName=${encodeURIComponent(b.name)}`}
                      className={`group grid grid-cols-[100px_120px_1fr_100px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < b.invoices.length - 1 ? "border-b border-gray-100" : ""}`}>
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

        {/* ── TAB: Dokumente ─────────────────────────────────────────────── */}
        {tab === "dokumente" && (
          <div className="max-w-xl">
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <FolderOpen className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Dokumenten-Upload</p>
              <p className="text-xs text-gray-400 mt-1">
                Baustellenfotos, Pläne, Verträge, Lieferscheine und Protokolle können hier hochgeladen werden.<br />
                Diese Funktion wird in einer zukünftigen Version verfügbar sein.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog: Disposition löschen ───────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteDispoId}
        onOpenChange={(open) => { if (!open) setDeleteDispoId(null); }}
        title="Einsatz löschen"
        description="Dieser Dispositionseintrag wird unwiderruflich gelöscht."
        onConfirm={confirmDeleteDispo}
      />

      {/* ── Dialog: Rapport löschen ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteRapportId}
        onOpenChange={(open) => { if (!open) setDeleteRapportId(null); }}
        title="Eintrag löschen"
        description="Dieser Bautagebuch-Eintrag wird unwiderruflich gelöscht."
        onConfirm={confirmDeleteRapport}
      />

      {/* ── Dialog: Lieferschein löschen ──────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteLieferscheinId}
        onOpenChange={open => { if (!open) setDeleteLieferscheinId(null); }}
        title="Lieferschein löschen"
        description={
          deleteLieferscheinId && (b.deliveryNotes.find(d => d.id === deleteLieferscheinId) as any)?.signatureUrl
            ? "Dieser Lieferschein wurde bereits unterschrieben. Soll er trotzdem gelöscht werden?"
            : "Soll dieser Lieferschein wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
        }
        variant={
          deleteLieferscheinId && (b.deliveryNotes.find(d => d.id === deleteLieferscheinId) as any)?.signatureUrl
            ? "warning"
            : "destructive"
        }
        onConfirm={confirmDeleteLieferschein}
      />

      {/* ── Dialog: Rechnung löschen ───────────────────────────────────────────── */}
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
