"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Plus, Trash2, X, AlertTriangle, FileText,
  Wrench, Clock, Activity, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  updateMachine,
  createMachineUsage,
  deleteMachineUsage,
  createMachineMaintenance,
  deleteMachineMaintenance,
} from "@/actions/machines";
import type {
  MachineRow, MachineUsageRow, MachineMaintenanceRow, MachineStatusType, MaintenanceTypeValue,
} from "@/actions/machines";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<MachineStatusType, string> = {
  AVAILABLE: "Verfügbar",
  IN_USE: "Im Einsatz",
  MAINTENANCE: "Wartung",
  OUT_OF_SERVICE: "Außer Betrieb",
};
const STATUS_COLOR: Record<MachineStatusType, string> = {
  AVAILABLE: "border-green-300 text-green-700 bg-green-50",
  IN_USE: "border-blue-300 text-blue-700 bg-blue-50",
  MAINTENANCE: "border-amber-300 text-amber-700 bg-amber-50",
  OUT_OF_SERVICE: "border-red-300 text-red-700 bg-red-50",
};
const MAINTENANCE_LABEL: Record<MaintenanceTypeValue, string> = {
  INSPECTION: "Inspektion",
  REPAIR: "Reparatur",
  SERVICE: "Service",
};
const MACHINE_TYPES = [
  "Bagger", "Radlader", "LKW", "Kipper", "Planierraupe", "Walze",
  "Grader", "Kran", "Dumper", "Kompressor", "Sonstiges",
];

function fmt(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE");
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MachineWithRelations = MachineRow & {
  usages: MachineUsageRow[];
  maintenances: MachineMaintenanceRow[];
};

type OrderOption = { id: string; orderNumber: string; title: string };
type DriverOption = { id: string; name: string };

interface Props {
  machine: MachineWithRelations;
  orders: OrderOption[];
  drivers: DriverOption[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MachineDetailClient({ machine: initialMachine, orders, drivers }: Props) {
  const router = useRouter();
  const [machine, setMachine] = useState(initialMachine);
  const [activeTab, setActiveTab] = useState<"overview" | "usage" | "maintenance" | "documents">("overview");

  // ── Overview edit mode ───────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: machine.name,
    machineType: MACHINE_TYPES.includes(machine.machineType) ? machine.machineType : "Sonstiges",
    machineTypeCustom: MACHINE_TYPES.includes(machine.machineType) ? "" : machine.machineType,
    manufacturer: machine.manufacturer ?? "",
    model: machine.model ?? "",
    year: machine.year?.toString() ?? "",
    serialNumber: machine.serialNumber ?? "",
    licensePlate: machine.licensePlate ?? "",
    hourlyRate: machine.hourlyRate?.toString() ?? "",
    status: machine.status,
    notes: machine.notes ?? "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleSaveEdit() {
    const machineType =
      editForm.machineType === "Sonstiges" && editForm.machineTypeCustom.trim()
        ? editForm.machineTypeCustom.trim()
        : editForm.machineType;
    setSavingEdit(true);
    const result = await updateMachine(machine.id, {
      name: editForm.name,
      machineType,
      manufacturer: editForm.manufacturer || undefined,
      model: editForm.model || undefined,
      year: editForm.year ? parseInt(editForm.year) : null,
      serialNumber: editForm.serialNumber || undefined,
      licensePlate: editForm.licensePlate || undefined,
      hourlyRate: editForm.hourlyRate ? parseFloat(editForm.hourlyRate) : null,
      status: editForm.status as MachineStatusType,
      notes: editForm.notes || undefined,
    });
    setSavingEdit(false);
    if ("error" in result) { toast.error("Fehler beim Speichern"); return; }
    setMachine((m) => ({ ...m, ...(result.machine as Partial<MachineWithRelations>) }));
    setEditMode(false);
    toast.success("Gespeichert");
    router.refresh();
  }

  // ── Usage modal ──────────────────────────────────────────────────────────
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageForm, setUsageForm] = useState({
    orderId: "", driverName: "", startDate: "", endDate: "", hours: "", notes: "",
  });
  const [savingUsage, setSavingUsage] = useState(false);

  async function handleCreateUsage() {
    if (!usageForm.startDate) { toast.error("Startdatum erforderlich"); return; }
    setSavingUsage(true);
    const result = await createMachineUsage({
      machineId: machine.id,
      orderId: usageForm.orderId || null,
      driverName: usageForm.driverName || undefined,
      startDate: usageForm.startDate,
      endDate: usageForm.endDate || undefined,
      hours: usageForm.hours ? parseFloat(usageForm.hours) : null,
      notes: usageForm.notes || undefined,
    });
    setSavingUsage(false);
    if ("error" in result) { toast.error("Fehler beim Speichern"); return; }
    setMachine((m) => ({
      ...m,
      usages: [result.usage as MachineUsageRow, ...m.usages],
    }));
    setUsageOpen(false);
    setUsageForm({ orderId: "", driverName: "", startDate: "", endDate: "", hours: "", notes: "" });
    toast.success("Einsatz hinzugefügt");
  }

  async function handleDeleteUsage(id: string) {
    if (!confirm("Einsatz wirklich löschen?")) return;
    await deleteMachineUsage(id, machine.id);
    setMachine((m) => ({ ...m, usages: m.usages.filter((u) => u.id !== id) }));
    toast.success("Einsatz gelöscht");
  }

  // ── Maintenance modal ────────────────────────────────────────────────────
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintForm, setMaintForm] = useState({
    maintenanceType: "SERVICE" as MaintenanceTypeValue,
    description: "", date: "", cost: "", nextServiceDate: "", performedBy: "",
  });
  const [savingMaint, setSavingMaint] = useState(false);

  async function handleCreateMaintenance() {
    if (!maintForm.date) { toast.error("Wartungsdatum erforderlich"); return; }
    setSavingMaint(true);
    const result = await createMachineMaintenance({
      machineId: machine.id,
      maintenanceType: maintForm.maintenanceType,
      description: maintForm.description || undefined,
      date: maintForm.date,
      cost: maintForm.cost ? parseFloat(maintForm.cost) : null,
      nextServiceDate: maintForm.nextServiceDate || undefined,
      performedBy: maintForm.performedBy || undefined,
    });
    setSavingMaint(false);
    if ("error" in result) { toast.error("Fehler beim Speichern"); return; }
    const newMaint = result.maintenance as MachineMaintenanceRow;
    setMachine((m) => ({
      ...m,
      maintenances: [newMaint, ...m.maintenances],
      hasOverdueMaintenance:
        newMaint.nextServiceDate != null && new Date(newMaint.nextServiceDate) < new Date()
          ? true
          : m.hasOverdueMaintenance,
    }));
    setMaintOpen(false);
    setMaintForm({ maintenanceType: "SERVICE", description: "", date: "", cost: "", nextServiceDate: "", performedBy: "" });
    toast.success("Wartung hinzugefügt");
  }

  async function handleDeleteMaintenance(id: string) {
    if (!confirm("Wartungseintrag wirklich löschen?")) return;
    await deleteMachineMaintenance(id, machine.id);
    setMachine((m) => ({ ...m, maintenances: m.maintenances.filter((x) => x.id !== id) }));
    toast.success("Wartung gelöscht");
  }

  const overdueMaint = machine.maintenances.some(
    (m) => m.nextServiceDate && new Date(m.nextServiceDate) < new Date()
  );

  // ── Tabs config ──────────────────────────────────────────────────────────
  const TABS = [
    { key: "overview" as const, label: "Übersicht", icon: Info },
    { key: "usage" as const, label: "Einsatzhistorie", icon: Activity, count: machine.usages.length },
    { key: "maintenance" as const, label: "Wartung / Service", icon: Wrench, count: machine.maintenances.length, warn: overdueMaint },
    { key: "documents" as const, label: "Dokumente", icon: FileText },
  ];

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <Link href="/ressourcen" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Ressourcen
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{machine.name}</h1>
              <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLOR[machine.status]}`}>
                {STATUS_LABEL[machine.status]}
              </span>
              {machine.hasOverdueMaintenance && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-300 text-amber-700 bg-amber-50">
                  <AlertTriangle className="h-3 w-3" />
                  Wartung fällig
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{machine.machineType}{machine.manufacturer ? ` · ${machine.manufacturer}` : ""}{machine.model ? ` ${machine.model}` : ""}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mt-4">
          {TABS.map(({ key, label, icon: Icon, count, warn }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                activeTab === key
                  ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span className="text-xs text-gray-400">({count})</span>
              )}
              {warn && <AlertTriangle className="h-3 w-3 text-amber-500" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6">
        {/* ── TAB: Übersicht ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Stammdaten</h2>
                {!editMode ? (
                  <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Bearbeiten
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
                    ["Maschinenname", machine.name],
                    ["Maschinentyp", machine.machineType],
                    ["Hersteller", machine.manufacturer],
                    ["Modell", machine.model],
                    ["Baujahr", machine.year],
                    ["Seriennummer", machine.serialNumber],
                    ["Kennzeichen", machine.licensePlate],
                    ["Stundensatz", machine.hourlyRate != null ? `${machine.hourlyRate.toLocaleString("de-DE")} €/h` : null],
                    ["Status", STATUS_LABEL[machine.status]],
                    ["Erfasst am", fmt(machine.createdAt)],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{label}</dt>
                      <dd className="text-sm text-gray-900 mt-0.5">{value ?? "–"}</dd>
                    </div>
                  ))}
                  {machine.notes && (
                    <div className="col-span-2">
                      <dt className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</dt>
                      <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-line">{machine.notes}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name *">
                      <input type="text" className={INPUT_CLS} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    </Field>
                    <Field label="Maschinentyp *">
                      <select className={INPUT_CLS} value={editForm.machineType} onChange={(e) => setEditForm((f) => ({ ...f, machineType: e.target.value }))}>
                        {MACHINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {editForm.machineType === "Sonstiges" && (
                        <input type="text" className={`mt-1.5 ${INPUT_CLS}`} placeholder="Typ eingeben..." value={editForm.machineTypeCustom} onChange={(e) => setEditForm((f) => ({ ...f, machineTypeCustom: e.target.value }))} />
                      )}
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Hersteller">
                      <input type="text" className={INPUT_CLS} value={editForm.manufacturer} onChange={(e) => setEditForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                    </Field>
                    <Field label="Modell">
                      <input type="text" className={INPUT_CLS} value={editForm.model} onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Baujahr">
                      <input type="number" className={INPUT_CLS} placeholder="2020" value={editForm.year} onChange={(e) => setEditForm((f) => ({ ...f, year: e.target.value }))} />
                    </Field>
                    <Field label="Kennzeichen">
                      <input type="text" className={INPUT_CLS} value={editForm.licensePlate} onChange={(e) => setEditForm((f) => ({ ...f, licensePlate: e.target.value }))} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Seriennummer">
                      <input type="text" className={INPUT_CLS} value={editForm.serialNumber} onChange={(e) => setEditForm((f) => ({ ...f, serialNumber: e.target.value }))} />
                    </Field>
                    <Field label="Stundensatz (€/h)">
                      <input type="number" min="0" step="0.01" className={INPUT_CLS} value={editForm.hourlyRate} onChange={(e) => setEditForm((f) => ({ ...f, hourlyRate: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Status">
                    <select className={INPUT_CLS} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as MachineStatusType }))}>
                      <option value="AVAILABLE">Verfügbar</option>
                      <option value="IN_USE">Im Einsatz</option>
                      <option value="MAINTENANCE">Wartung</option>
                      <option value="OUT_OF_SERVICE">Außer Betrieb</option>
                    </select>
                  </Field>
                  <Field label="Notizen">
                    <textarea rows={3} className={`${INPUT_CLS} resize-none`} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Einsatzhistorie ───────────────────────────────────────── */}
        {activeTab === "usage" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Einsatzhistorie</h2>
              <Button onClick={() => setUsageOpen(true)} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" size="sm">
                <Plus className="h-4 w-4" />
                Neuen Einsatz
              </Button>
            </div>

            {machine.usages.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Einsätze erfasst</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_2fr_1.5fr_1fr_40px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Startdatum", "Enddatum", "Auftrag", "Fahrer", "Stunden", ""].map((h) => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {machine.usages.map((u, i) => (
                  <div key={u.id} className={`grid grid-cols-[1fr_1fr_2fr_1.5fr_1fr_40px] gap-3 px-5 py-3 items-center group hover:bg-gray-50 ${i !== machine.usages.length - 1 ? "border-b border-gray-100" : ""}`}>
                    <p className="text-sm text-gray-900">{fmt(u.startDate)}</p>
                    <p className="text-sm text-gray-500">{u.endDate ? fmt(u.endDate) : "laufend"}</p>
                    <div>
                      {u.order ? (
                        <Link href={`/auftraege/${u.order.id}`} className="text-sm text-blue-600 hover:underline">
                          {u.order.orderNumber} {u.order.title}
                        </Link>
                      ) : (
                        <p className="text-sm text-gray-400">–</p>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{u.driverName || "–"}</p>
                    <p className="text-sm text-gray-500">{u.hours != null ? `${u.hours} h` : "–"}</p>
                    <button onClick={() => handleDeleteUsage(u.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Wartung / Service ─────────────────────────────────────── */}
        {activeTab === "maintenance" && (
          <div>
            {overdueMaint && (
              <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>Ein oder mehrere Servicetermine sind überfällig.</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Wartung &amp; Service</h2>
              <Button onClick={() => setMaintOpen(true)} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" size="sm">
                <Plus className="h-4 w-4" />
                Neue Wartung
              </Button>
            </div>

            {machine.maintenances.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">Noch keine Wartungseinträge</div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr_1.5fr_40px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Datum", "Typ", "Beschreibung", "Kosten", "Nächster Service", "Durchgeführt von", ""].map((h) => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {machine.maintenances.map((m, i) => {
                  const isOverdue = m.nextServiceDate && new Date(m.nextServiceDate) < new Date();
                  return (
                    <div key={m.id} className={`grid grid-cols-[1fr_1fr_2fr_1fr_1fr_1.5fr_40px] gap-3 px-5 py-3 items-center group hover:bg-gray-50 ${i !== machine.maintenances.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <p className="text-sm text-gray-900">{fmt(m.date)}</p>
                      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 bg-gray-50 w-fit">
                        {MAINTENANCE_LABEL[m.maintenanceType]}
                      </span>
                      <p className="text-sm text-gray-500 truncate">{m.description || "–"}</p>
                      <p className="text-sm text-gray-500">
                        {m.cost != null ? `${m.cost.toLocaleString("de-DE")} €` : "–"}
                      </p>
                      <div className="flex items-center gap-1">
                        <p className={`text-sm ${isOverdue ? "text-amber-600 font-medium" : "text-gray-500"}`}>
                          {m.nextServiceDate ? fmt(m.nextServiceDate) : "–"}
                        </p>
                        {isOverdue && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{m.performedBy || "–"}</p>
                      <button onClick={() => handleDeleteMaintenance(m.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Dokumente ─────────────────────────────────────────────── */}
        {activeTab === "documents" && (
          <div className="max-w-xl">
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Dokument-Upload</p>
              <p className="text-xs text-gray-400 mt-1">
                Serviceberichte, Prüfberichte, Handbücher und Wartungsprotokolle können hier hochgeladen werden.
                <br />
                Diese Funktion wird in einer zukünftigen Version verfügbar sein.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Einsatz erfassen ──────────────────────────────────────────── */}
      {usageOpen && (
        <Modal title="Einsatz erfassen" onClose={() => setUsageOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Startdatum *">
                <input type="date" className={INPUT_CLS} value={usageForm.startDate} onChange={(e) => setUsageForm((f) => ({ ...f, startDate: e.target.value }))} />
              </Field>
              <Field label="Enddatum">
                <input type="date" className={INPUT_CLS} value={usageForm.endDate} onChange={(e) => setUsageForm((f) => ({ ...f, endDate: e.target.value }))} />
              </Field>
            </div>
            <Field label="Auftrag">
              <select className={INPUT_CLS} value={usageForm.orderId} onChange={(e) => setUsageForm((f) => ({ ...f, orderId: e.target.value }))}>
                <option value="">– Kein Auftrag –</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.orderNumber} – {o.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Fahrer">
              <select className={INPUT_CLS} value={usageForm.driverName} onChange={(e) => setUsageForm((f) => ({ ...f, driverName: e.target.value }))}>
                <option value="">– Kein Fahrer –</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Einsatzstunden">
              <input type="number" min="0" step="0.5" className={INPUT_CLS} placeholder="0" value={usageForm.hours} onChange={(e) => setUsageForm((f) => ({ ...f, hours: e.target.value }))} />
            </Field>
            <Field label="Notizen">
              <textarea rows={2} className={`${INPUT_CLS} resize-none`} value={usageForm.notes} onChange={(e) => setUsageForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
            <Button variant="outline" onClick={() => setUsageOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateUsage} disabled={savingUsage}>
              {savingUsage ? "Speichert..." : "Einsatz speichern"}
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Wartung erfassen ──────────────────────────────────────────── */}
      {maintOpen && (
        <Modal title="Wartung erfassen" onClose={() => setMaintOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Datum *">
                <input type="date" className={INPUT_CLS} value={maintForm.date} onChange={(e) => setMaintForm((f) => ({ ...f, date: e.target.value }))} />
              </Field>
              <Field label="Typ">
                <select className={INPUT_CLS} value={maintForm.maintenanceType} onChange={(e) => setMaintForm((f) => ({ ...f, maintenanceType: e.target.value as MaintenanceTypeValue }))}>
                  <option value="SERVICE">Service</option>
                  <option value="INSPECTION">Inspektion</option>
                  <option value="REPAIR">Reparatur</option>
                </select>
              </Field>
            </div>
            <Field label="Beschreibung">
              <input type="text" className={INPUT_CLS} placeholder="z.B. Ölwechsel, Filterreinigung..." value={maintForm.description} onChange={(e) => setMaintForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kosten (€)">
                <input type="number" min="0" step="0.01" className={INPUT_CLS} placeholder="0.00" value={maintForm.cost} onChange={(e) => setMaintForm((f) => ({ ...f, cost: e.target.value }))} />
              </Field>
              <Field label="Nächster Servicetermin">
                <input type="date" className={INPUT_CLS} value={maintForm.nextServiceDate} onChange={(e) => setMaintForm((f) => ({ ...f, nextServiceDate: e.target.value }))} />
              </Field>
            </div>
            <Field label="Durchgeführt von">
              <input type="text" className={INPUT_CLS} placeholder="Name oder Werkstatt" value={maintForm.performedBy} onChange={(e) => setMaintForm((f) => ({ ...f, performedBy: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
            <Button variant="outline" onClick={() => setMaintOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateMaintenance} disabled={savingMaint}>
              {savingMaint ? "Speichert..." : "Wartung speichern"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
