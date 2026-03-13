"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Plus, Trash2, X, Info, CalendarDays, Settings2, FileText, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  updateBaustelle,
  createBaustelleDispositionEntry,
  deleteBaustelleDispositionEntry,
  createBaustelleMachineUsage,
  deleteBaustelleMachineUsage,
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

type ResourceOption = { id: string; name: string; type: string };
type MachineOption = { id: string; name: string; machineType: string };
type OrderOption = { id: string; orderNumber: string; title: string };

type Baustelle = {
  id: string;
  orderId: string;
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
  dispositionEntries: Array<{
    id: string; startDate: Date; endDate: Date; notes: string | null;
    resource: { id: string; name: string; type: string };
  }>;
  machineUsages: Array<{
    id: string; startDate: Date; endDate: Date | null; hours: number | null;
    notes: string | null; driverName: string | null;
    machine: { id: string; name: string; machineType: string };
  }>;
  rapporte: Array<{
    id: string; date: Date; driverName: string | null; machineName: string | null;
    hours: number | null; description: string | null;
  }>;
};

interface Props {
  baustelle: Baustelle;
  resources: ResourceOption[];
  machines: MachineOption[];
  orders: OrderOption[];
  userNames: string[];
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BaustellenDetailClient({ baustelle: init, resources, machines, orders, userNames }: Props) {
  const router = useRouter();
  const [b, setB] = useState(init);
  const [tab, setTab] = useState<"overview" | "dispo" | "maschinen" | "rapporte" | "dokumente">("overview");

  // ── Overview edit ──────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [ef, setEf] = useState({
    orderId: b.orderId,
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

  // ── Disposition modal ──────────────────────────────────────────────────────
  const [dispoOpen, setDispoOpen] = useState(false);
  const [df, setDf] = useState({ resourceId: "", startDate: "", endDate: "", notes: "" });
  const [savingDispo, setSavingDispo] = useState(false);

  async function handleCreateDispo() {
    if (!df.resourceId || !df.startDate || !df.endDate) { toast.error("Ressource und Zeitraum erforderlich"); return; }
    setSavingDispo(true);
    const r = await createBaustelleDispositionEntry({
      baustelleId: b.id, orderId: b.orderId,
      resourceId: df.resourceId, startDate: df.startDate, endDate: df.endDate, notes: df.notes || undefined,
    });
    setSavingDispo(false);
    if ("error" in r) { toast.error("Fehler"); return; }
    setB(prev => ({ ...prev, dispositionEntries: [r.entry, ...prev.dispositionEntries] }));
    setDispoOpen(false);
    setDf({ resourceId: "", startDate: "", endDate: "", notes: "" });
    toast.success("Einsatz geplant");
  }

  async function handleDeleteDispo(id: string) {
    if (!confirm("Einsatz wirklich löschen?")) return;
    await deleteBaustelleDispositionEntry(id, b.id);
    setB(prev => ({ ...prev, dispositionEntries: prev.dispositionEntries.filter(e => e.id !== id) }));
    toast.success("Gelöscht");
  }

  // ── Machine modal ──────────────────────────────────────────────────────────
  const [machOpen, setMachOpen] = useState(false);
  const [mf, setMf] = useState({ machineId: "", driverName: "", startDate: "", endDate: "", hours: "", notes: "" });
  const [savingMach, setSavingMach] = useState(false);

  async function handleCreateMachine() {
    if (!mf.machineId || !mf.startDate) { toast.error("Maschine und Startdatum erforderlich"); return; }
    setSavingMach(true);
    const r = await createBaustelleMachineUsage({
      baustelleId: b.id, orderId: b.orderId,
      machineId: mf.machineId, driverName: mf.driverName || undefined,
      startDate: mf.startDate, endDate: mf.endDate || undefined,
      hours: mf.hours ? parseFloat(mf.hours) : null,
      notes: mf.notes || undefined,
    });
    setSavingMach(false);
    if ("error" in r) { toast.error("Fehler"); return; }
    setB(prev => ({ ...prev, machineUsages: [r.usage, ...prev.machineUsages] }));
    setMachOpen(false);
    setMf({ machineId: "", driverName: "", startDate: "", endDate: "", hours: "", notes: "" });
    toast.success("Maschine hinzugefügt");
  }

  async function handleDeleteMachine(id: string) {
    if (!confirm("Maschineneinsatz wirklich löschen?")) return;
    await deleteBaustelleMachineUsage(id, b.id);
    setB(prev => ({ ...prev, machineUsages: prev.machineUsages.filter(u => u.id !== id) }));
    toast.success("Gelöscht");
  }

  // ── Rapport modal ──────────────────────────────────────────────────────────
  const [rapOpen, setRapOpen] = useState(false);
  const [rf, setRf] = useState({ date: "", driverName: "", machineName: "", hours: "", description: "" });
  const [savingRap, setSavingRap] = useState(false);

  async function handleCreateRapport() {
    if (!rf.date) { toast.error("Datum erforderlich"); return; }
    setSavingRap(true);
    const r = await createTagesrapport({
      baustelleId: b.id, date: rf.date,
      driverName: rf.driverName || undefined, machineName: rf.machineName || undefined,
      hours: rf.hours ? parseFloat(rf.hours) : null,
      description: rf.description || undefined,
    });
    setSavingRap(false);
    if ("error" in r) { toast.error("Fehler"); return; }
    setB(prev => ({ ...prev, rapporte: [r.rapport, ...prev.rapporte] }));
    setRapOpen(false);
    setRf({ date: "", driverName: "", machineName: "", hours: "", description: "" });
    toast.success("Rapport erstellt");
  }

  async function handleDeleteRapport(id: string) {
    if (!confirm("Rapport wirklich löschen?")) return;
    await deleteTagesrapport(id, b.id);
    setB(prev => ({ ...prev, rapporte: prev.rapporte.filter(r => r.id !== id) }));
    toast.success("Gelöscht");
  }

  const TABS = [
    { key: "overview" as const, label: "Übersicht", icon: Info },
    { key: "dispo" as const, label: "Disposition", icon: CalendarDays, count: b.dispositionEntries.length },
    { key: "maschinen" as const, label: "Maschinen", icon: Settings2, count: b.machineUsages.length },
    { key: "rapporte" as const, label: "Rapporte", icon: FileText, count: b.rapporte.length },
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
              {b.order.orderNumber} {b.order.title}
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
          <div className="max-w-2xl">
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
                    ["Auftrag", `${b.order.orderNumber} – ${b.order.title}`],
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
                    <Field label="Auftrag *">
                      <select className={IC} value={ef.orderId} onChange={e => setEf(f => ({ ...f, orderId: e.target.value }))}>
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
          </div>
        )}

        {/* ── TAB: Disposition ───────────────────────────────────────────── */}
        {tab === "dispo" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Geplante Einsätze</h2>
              <Button onClick={() => setDispoOpen(true)} size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
                <Plus className="h-4 w-4" />Einsatz planen
              </Button>
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
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.resource.name}</p>
                      <p className="text-xs text-gray-400">{e.resource.type}</p>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{e.notes || "–"}</p>
                    <button onClick={() => handleDeleteDispo(e.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">Einsätze erscheinen automatisch im Dispositionskalender.</p>
          </div>
        )}

        {/* ── TAB: Maschinen ─────────────────────────────────────────────── */}
        {tab === "maschinen" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Maschineneinsätze</h2>
              <Button onClick={() => setMachOpen(true)} size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
                <Plus className="h-4 w-4" />Maschine hinzufügen
              </Button>
            </div>
            {b.machineUsages.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Maschinen zugeordnet</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_40px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Maschine", "Typ", "Einsatzbeginn", "Einsatzende", "Stunden", ""].map(h => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {b.machineUsages.map((u, i) => (
                  <div key={u.id} className={`grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_40px] gap-3 px-5 py-3 items-center group hover:bg-gray-50 ${i !== b.machineUsages.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <div>
                      <Link href={`/ressourcen/maschinen/${u.machine.id}`} className="text-sm font-medium text-blue-600 hover:underline">{u.machine.name}</Link>
                      {u.driverName && <p className="text-xs text-gray-400">{u.driverName}</p>}
                    </div>
                    <p className="text-sm text-gray-500">{u.machine.machineType}</p>
                    <p className="text-sm text-gray-900">{fmt(u.startDate)}</p>
                    <p className="text-sm text-gray-500">{u.endDate ? fmt(u.endDate) : "laufend"}</p>
                    <p className="text-sm text-gray-500">{u.hours != null ? `${u.hours} h` : "–"}</p>
                    <button onClick={() => handleDeleteMachine(u.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Rapporte ──────────────────────────────────────────────── */}
        {tab === "rapporte" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Tagesrapporte</h2>
              <Button onClick={() => setRapOpen(true)} size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
                <Plus className="h-4 w-4" />Rapport erstellen
              </Button>
            </div>
            {b.rapporte.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Rapporte erfasst</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_2fr_40px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Datum", "Fahrer", "Maschine", "Stunden", "Beschreibung", ""].map(h => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {b.rapporte.map((r, i) => (
                  <div key={r.id} className={`grid grid-cols-[1fr_1.5fr_1.5fr_1fr_2fr_40px] gap-3 px-5 py-3 items-center group hover:bg-gray-50 ${i !== b.rapporte.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <p className="text-sm text-gray-900">{fmt(r.date)}</p>
                    <p className="text-sm text-gray-500">{r.driverName || "–"}</p>
                    <p className="text-sm text-gray-500">{r.machineName || "–"}</p>
                    <p className="text-sm text-gray-500">{r.hours != null ? `${r.hours} h` : "–"}</p>
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

      {/* ── Modal: Einsatz planen ─────────────────────────────────────────────── */}
      {dispoOpen && (
        <Modal title="Einsatz planen" onClose={() => setDispoOpen(false)}>
          <div className="space-y-3">
            <Field label="Ressource *">
              <select className={IC} value={df.resourceId} onChange={e => setDf(f => ({ ...f, resourceId: e.target.value }))}>
                <option value="">– Ressource wählen –</option>
                {resources.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Von *"><input type="date" className={IC} value={df.startDate} onChange={e => setDf(f => ({ ...f, startDate: e.target.value }))} /></Field>
              <Field label="Bis *"><input type="date" className={IC} value={df.endDate} onChange={e => setDf(f => ({ ...f, endDate: e.target.value }))} /></Field>
            </div>
            <Field label="Notizen"><textarea rows={2} className={`${IC} resize-none`} value={df.notes} onChange={e => setDf(f => ({ ...f, notes: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
            <Button variant="outline" onClick={() => setDispoOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateDispo} disabled={savingDispo}>{savingDispo ? "Speichert..." : "Einsatz planen"}</Button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Maschine hinzufügen ────────────────────────────────────────── */}
      {machOpen && (
        <Modal title="Maschine hinzufügen" onClose={() => setMachOpen(false)}>
          <div className="space-y-3">
            <Field label="Maschine *">
              <select className={IC} value={mf.machineId} onChange={e => setMf(f => ({ ...f, machineId: e.target.value }))}>
                <option value="">– Maschine wählen –</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.machineType})</option>)}
              </select>
            </Field>
            <Field label="Fahrer">
              <input type="text" className={IC} placeholder="Name des Fahrers" value={mf.driverName} onChange={e => setMf(f => ({ ...f, driverName: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Einsatzbeginn *"><input type="date" className={IC} value={mf.startDate} onChange={e => setMf(f => ({ ...f, startDate: e.target.value }))} /></Field>
              <Field label="Einsatzende"><input type="date" className={IC} value={mf.endDate} onChange={e => setMf(f => ({ ...f, endDate: e.target.value }))} /></Field>
            </div>
            <Field label="Einsatzstunden"><input type="number" min="0" step="0.5" className={IC} value={mf.hours} onChange={e => setMf(f => ({ ...f, hours: e.target.value }))} /></Field>
            <Field label="Notizen"><textarea rows={2} className={`${IC} resize-none`} value={mf.notes} onChange={e => setMf(f => ({ ...f, notes: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
            <Button variant="outline" onClick={() => setMachOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateMachine} disabled={savingMach}>{savingMach ? "Speichert..." : "Maschine hinzufügen"}</Button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Rapport erstellen ──────────────────────────────────────────── */}
      {rapOpen && (
        <Modal title="Tagesrapport erstellen" onClose={() => setRapOpen(false)}>
          <div className="space-y-3">
            <Field label="Datum *"><input type="date" className={IC} value={rf.date} onChange={e => setRf(f => ({ ...f, date: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fahrer"><input type="text" className={IC} value={rf.driverName} onChange={e => setRf(f => ({ ...f, driverName: e.target.value }))} /></Field>
              <Field label="Maschine"><input type="text" className={IC} value={rf.machineName} onChange={e => setRf(f => ({ ...f, machineName: e.target.value }))} /></Field>
            </div>
            <Field label="Stunden"><input type="number" min="0" step="0.5" className={IC} value={rf.hours} onChange={e => setRf(f => ({ ...f, hours: e.target.value }))} /></Field>
            <Field label="Beschreibung"><textarea rows={3} className={`${IC} resize-none`} value={rf.description} onChange={e => setRf(f => ({ ...f, description: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
            <Button variant="outline" onClick={() => setRapOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateRapport} disabled={savingRap}>{savingRap ? "Speichert..." : "Rapport speichern"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
