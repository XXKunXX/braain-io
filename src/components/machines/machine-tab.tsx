"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createMachine, updateMachine, deleteMachine } from "@/actions/machines";
import type { MachineRow, MachineStatusType } from "@/actions/machines";
import Link from "next/link";

const MACHINE_TYPES = [
  "Bagger", "Radlader", "LKW", "Kipper", "Planierraupe", "Walze",
  "Grader", "Kran", "Dumper", "Kompressor", "Sonstiges",
];

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

type FormData = {
  name: string;
  machineType: string;
  machineTypeCustom: string;
  manufacturer: string;
  model: string;
  year: string;
  serialNumber: string;
  licensePlate: string;
  hourlyRate: string;
  status: MachineStatusType;
  notes: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  machineType: "Bagger",
  machineTypeCustom: "",
  manufacturer: "",
  model: "",
  year: "",
  serialNumber: "",
  licensePlate: "",
  hourlyRate: "",
  status: "AVAILABLE",
  notes: "",
};

export function MachineTab({ machines }: { machines: MachineRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(m: MachineRow) {
    const isCustom = !MACHINE_TYPES.includes(m.machineType);
    setForm({
      name: m.name,
      machineType: isCustom ? "Sonstiges" : m.machineType,
      machineTypeCustom: isCustom ? m.machineType : "",
      manufacturer: m.manufacturer ?? "",
      model: m.model ?? "",
      year: m.year?.toString() ?? "",
      serialNumber: m.serialNumber ?? "",
      licensePlate: m.licensePlate ?? "",
      hourlyRate: m.hourlyRate?.toString() ?? "",
      status: m.status,
      notes: m.notes ?? "",
    });
    setEditingId(m.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function resolvedType() {
    return form.machineType === "Sonstiges" && form.machineTypeCustom.trim()
      ? form.machineTypeCustom.trim()
      : form.machineType;
  }

  async function handleSubmit() {
    if (!form.name.trim() || !resolvedType()) {
      toast.error("Name und Typ sind erforderlich");
      return;
    }
    setIsSubmitting(true);
    const payload = {
      name: form.name.trim(),
      machineType: resolvedType(),
      manufacturer: form.manufacturer || undefined,
      model: form.model || undefined,
      year: form.year ? parseInt(form.year) : null,
      serialNumber: form.serialNumber || undefined,
      licensePlate: form.licensePlate || undefined,
      hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
      status: form.status,
      notes: form.notes || undefined,
    };

    const result = editingId
      ? await updateMachine(editingId, payload)
      : await createMachine(payload);
    setIsSubmitting(false);

    if ("error" in result && result.error) {
      toast.error("Fehler beim Speichern");
      return;
    }
    toast.success(editingId ? "Maschine aktualisiert" : "Maschine erstellt");
    closeForm();
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen? Alle Einsätze und Wartungen werden ebenfalls gelöscht.`)) return;
    await deleteMachine(id);
    toast.success("Maschine gelöscht");
    router.refresh();
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{machines.length} Maschinen</p>
        <Button onClick={openCreate} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="h-4 w-4" />
          Neue Maschine
        </Button>
      </div>

      {/* Table */}
      {machines.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Noch keine Maschinen erfasst</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2fr_1.2fr_1.5fr_1.2fr_1fr_1fr_80px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
            {["Name", "Typ", "Hersteller", "Modell", "Status", "Stundensatz", ""].map((h) => (
              <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
            ))}
          </div>
          {machines.map((m, i) => (
            <div
              key={m.id}
              className={`grid grid-cols-[2fr_1.2fr_1.5fr_1.2fr_1fr_1fr_80px] gap-3 px-5 py-3.5 items-center group hover:bg-gray-50 transition-colors ${i !== machines.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                {m.hasOverdueMaintenance && (
                  <span title="Wartung fällig">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{m.machineType}</p>
              <p className="text-sm text-gray-500 truncate">{m.manufacturer || "–"}</p>
              <p className="text-sm text-gray-500 truncate">{m.model || "–"}</p>
              <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[m.status]}`}>
                {STATUS_LABEL[m.status]}
              </span>
              <p className="text-sm text-gray-500">
                {m.hourlyRate != null ? `${m.hourlyRate.toLocaleString("de-DE")} €/h` : "–"}
              </p>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/ressourcen/maschinen/${m.id}`}
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Details"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={() => openEdit(m)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                  title="Bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(m.id, m.name)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="Löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">
                {editingId ? "Maschine bearbeiten" : "Neue Maschine"}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Bagger 01"
                    value={form.name}
                    onChange={(e) => setForm((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Maschinentyp *</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.machineType}
                    onChange={(e) => setForm((d) => ({ ...d, machineType: e.target.value }))}
                  >
                    {MACHINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {form.machineType === "Sonstiges" && (
                    <input
                      type="text"
                      className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Typ eingeben..."
                      value={form.machineTypeCustom}
                      onChange={(e) => setForm((d) => ({ ...d, machineTypeCustom: e.target.value }))}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hersteller</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Caterpillar"
                    value={form.manufacturer}
                    onChange={(e) => setForm((d) => ({ ...d, manufacturer: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Modell</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. 320"
                    value={form.model}
                    onChange={(e) => setForm((d) => ({ ...d, model: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Baujahr</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="2020"
                    min="1950"
                    max="2099"
                    value={form.year}
                    onChange={(e) => setForm((d) => ({ ...d, year: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kennzeichen</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. W-12345"
                    value={form.licensePlate}
                    onChange={(e) => setForm((d) => ({ ...d, licensePlate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Seriennummer</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                    value={form.serialNumber}
                    onChange={(e) => setForm((d) => ({ ...d, serialNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stundensatz (€/h)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    value={form.hourlyRate}
                    onChange={(e) => setForm((d) => ({ ...d, hourlyRate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.status}
                  onChange={(e) => setForm((d) => ({ ...d, status: e.target.value as MachineStatusType }))}
                >
                  <option value="AVAILABLE">Verfügbar</option>
                  <option value="IN_USE">Im Einsatz</option>
                  <option value="MAINTENANCE">Wartung</option>
                  <option value="OUT_OF_SERVICE">Außer Betrieb</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Optional"
                  value={form.notes}
                  onChange={(e) => setForm((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
              <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Wird gespeichert..." : editingId ? "Speichern" : "Maschine erstellen"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
