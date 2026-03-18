"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Plus, Trash2, X, Info, CalendarDays, FileText, FolderOpen, User, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  updateBaustelle,
  deleteBaustelleDispositionEntry,
  createTagesrapport,
  deleteTagesrapport,
} from "@/actions/baustellen";
import type { BaustelleStatusType } from "@/actions/baustellen";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<BaustelleStatusType, string> = {
  PLANNED: "Geplant", ACTIVE: "Aktiv", COMPLETED: "Abgeschlossen",
};
const STATUS_COLOR: Record<BaustelleStatusType, string> = {
  PLANNED: "border-gray-300 text-gray-600 bg-gray-50",
  ACTIVE: "border-blue-300 text-blue-700 bg-blue-50",
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
  contact: { id: string; companyName: string; contactPerson: string | null } | null;
  dispositionEntries: DispositionEntry[];
  rapporte: Array<{
    id: string; date: Date; driverName: string | null; machineName: string | null;
    hours: number | null; employees: number | null; description: string | null;
  }>;
  deliveryNotes: Array<{
    id: string; deliveryNumber: string; date: Date; material: string;
    quantity: number | null; unit: string; driver: string | null;
  }>;
};

interface Props {
  baustelle: Baustelle;
  orders: OrderOption[];
  userNames: string[];
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BaustellenDetailClient({ baustelle: init, orders, userNames }: Props) {
  const router = useRouter();
  const [b, setB] = useState(init);
  const [tab, setTab] = useState<"overview" | "dispo" | "rapporte" | "lieferscheine" | "dokumente">("overview");

  // ── Overview edit ──────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
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
    toast.success("Gespeichert");
    router.refresh();
  }

  // ── Disposition ────────────────────────────────────────────────────────────
  async function handleDeleteDispo(id: string) {
    if (!confirm("Einsatz wirklich löschen?")) return;
    await deleteBaustelleDispositionEntry(id, b.id);
    setB(prev => ({ ...prev, dispositionEntries: prev.dispositionEntries.filter(e => e.id !== id) }));
    toast.success("Gelöscht");
  }

  // ── Rapport modal ──────────────────────────────────────────────────────────
  const [rapOpen, setRapOpen] = useState(false);
  const [rf, setRf] = useState({ date: "", driverName: "", machineName: "", hours: "", employees: "", description: "" });
  const [savingRap, setSavingRap] = useState(false);

  async function handleCreateRapport() {
    if (!rf.date) { toast.error("Datum erforderlich"); return; }
    setSavingRap(true);
    const r = await createTagesrapport({
      baustelleId: b.id, date: rf.date,
      driverName: rf.driverName || undefined, machineName: rf.machineName || undefined,
      hours: rf.hours ? parseFloat(rf.hours) : null,
      employees: rf.employees ? parseInt(rf.employees) : null,
      description: rf.description || undefined,
    });
    setSavingRap(false);
    if ("error" in r) { toast.error("Fehler"); return; }
    setB(prev => ({ ...prev, rapporte: [r.rapport, ...prev.rapporte] }));
    setRapOpen(false);
    setRf({ date: "", driverName: "", machineName: "", hours: "", employees: "", description: "" });
    toast.success("Rapport erstellt");
  }

  async function handleDeleteRapport(id: string) {
    if (!confirm("Rapport wirklich löschen?")) return;
    await deleteTagesrapport(id, b.id);
    setB(prev => ({ ...prev, rapporte: prev.rapporte.filter(r => r.id !== id) }));
    toast.success("Gelöscht");
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
    { key: "rapporte" as const, label: "Tagesberichte", icon: FileText, count: b.rapporte.length },
    { key: "lieferscheine" as const, label: "Lieferscheine", icon: Truck, count: b.deliveryNotes.length },
    { key: "dokumente" as const, label: "Dokumente", icon: FolderOpen },
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <Link href="/baustellen" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Baustellen
        </Link>
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
        <div className="flex items-center gap-1 mt-4">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                tab === key
                  ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count !== undefined && count > 0 && <span className="text-xs text-gray-400">({count})</span>}
            </button>
          ))}
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
                  <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />Bearbeiten
                  </Button>
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
                            {c.contactPerson && <span className="text-gray-400">· {c.contactPerson}</span>}
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
                  href={`/disposition?baustelleId=${b.id}&baustelleName=${encodeURIComponent(b.name)}`}
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
              <a
                href={`/disposition?baustelleId=${b.id}&baustelleName=${encodeURIComponent(b.name)}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <CalendarDays className="h-4 w-4" />Im Disposition öffnen
              </a>
            </div>
            {b.dispositionEntries.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Einsätze geplant</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_2fr_1fr_40px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Von", "Bis", "Ressource", "Notizen", ""].map(h => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {b.dispositionEntries.map((e, i) => (
                  <div key={e.id} className={`grid grid-cols-[1fr_1fr_2fr_1fr_40px] gap-3 px-5 py-3 items-center group hover:bg-gray-50 ${i !== b.dispositionEntries.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <p className="text-sm text-gray-900">{fmt(e.startDate)}</p>
                    <p className="text-sm text-gray-500">{fmt(e.endDate)}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLOR[e.resource.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {TYPE_LABEL[e.resource.type] ?? e.resource.type}
                      </span>
                      <p className="text-sm font-medium text-gray-900 truncate">{e.resource.name}</p>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{e.notes || "–"}</p>
                    <button onClick={() => handleDeleteDispo(e.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">Einträge werden zentral im Dispositionsmodul verwaltet.</p>
          </div>
        )}

        {/* ── TAB: Tagesberichte ─────────────────────────────────────────── */}
        {tab === "rapporte" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Tagesberichte</h2>
              <Button onClick={() => setRapOpen(true)} size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4" />Tagesbericht erstellen
              </Button>
            </div>
            {b.rapporte.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Tagesberichte erfasst</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1.5fr_1.5fr_0.7fr_0.7fr_2fr_40px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Datum", "Fahrer", "Maschine", "Stunden", "MA", "Beschreibung", ""].map(h => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {b.rapporte.map((r, i) => (
                  <div key={r.id} className={`grid grid-cols-[1fr_1.5fr_1.5fr_0.7fr_0.7fr_2fr_40px] gap-3 px-5 py-3 items-center group hover:bg-gray-50 ${i !== b.rapporte.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <p className="text-sm text-gray-900">{fmt(r.date)}</p>
                    <p className="text-sm text-gray-500">{r.driverName || "–"}</p>
                    <p className="text-sm text-gray-500">{r.machineName || "–"}</p>
                    <p className="text-sm text-gray-500">{r.hours != null ? `${r.hours} h` : "–"}</p>
                    <p className="text-sm text-gray-500">{r.employees != null ? r.employees : "–"}</p>
                    <p className="text-sm text-gray-500 truncate">{r.description || "–"}</p>
                    <button onClick={() => handleDeleteRapport(r.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Lieferscheine ─────────────────────────────────────────── */}
        {tab === "lieferscheine" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Lieferscheine</h2>
              <a
                href={`/lieferscheine/neu?baustelleId=${b.id}${b.orderId ? `&orderId=${b.orderId}` : ""}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />Neuer Lieferschein
              </a>
            </div>
            {b.deliveryNotes.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Lieferscheine</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr_80px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Nr.", "Datum", "Material", "Menge", "Fahrer", ""].map(h => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {b.deliveryNotes.map((dn, i) => (
                  <div key={dn.id} className={`grid grid-cols-[1fr_1fr_2fr_1fr_1fr_80px] gap-3 px-5 py-3 items-center hover:bg-gray-50 ${i !== b.deliveryNotes.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                    <span className="text-sm text-gray-700">{fmt(dn.date)}</span>
                    <span className="text-sm font-medium text-gray-900 truncate">{dn.material}</span>
                    <span className="text-sm font-mono text-gray-700">{dn.quantity != null ? dn.quantity.toLocaleString("de-DE") : "–"} {dn.unit}</span>
                    <span className="text-sm text-gray-500">{dn.driver ?? "–"}</span>
                    <a href={`/lieferscheine/${dn.id}`} className="text-xs text-blue-600 hover:underline text-right">Öffnen</a>
                  </div>
                ))}
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

      {/* ── Modal: Tagesbericht erstellen ─────────────────────────────────────── */}
      {rapOpen && (
        <Modal title="Tagesbericht erstellen" onClose={() => setRapOpen(false)}>
          <div className="space-y-3">
            <Field label="Datum *"><input type="date" className={IC} value={rf.date} onChange={e => setRf(f => ({ ...f, date: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fahrer"><input type="text" className={IC} value={rf.driverName} onChange={e => setRf(f => ({ ...f, driverName: e.target.value }))} /></Field>
              <Field label="Maschine"><input type="text" className={IC} value={rf.machineName} onChange={e => setRf(f => ({ ...f, machineName: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stunden"><input type="number" min="0" step="0.5" className={IC} value={rf.hours} onChange={e => setRf(f => ({ ...f, hours: e.target.value }))} /></Field>
              <Field label="Mitarbeiter (Anzahl)"><input type="number" min="0" step="1" className={IC} value={rf.employees} onChange={e => setRf(f => ({ ...f, employees: e.target.value }))} /></Field>
            </div>
            <Field label="Beschreibung"><textarea rows={3} className={`${IC} resize-none`} value={rf.description} onChange={e => setRf(f => ({ ...f, description: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
            <Button variant="outline" onClick={() => setRapOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateRapport} disabled={savingRap}>{savingRap ? "Speichert..." : "Bericht speichern"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
