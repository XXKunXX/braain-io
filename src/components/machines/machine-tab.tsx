"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertTriangle, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createMachine, updateMachine, deleteMachine } from "@/actions/machines";
import type { MachineRow, MachineStatusType } from "@/actions/machines";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return machines;
    return machines.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.machineType.toLowerCase().includes(q) ||
      (m.manufacturer ?? "").toLowerCase().includes(q) ||
      (m.model ?? "").toLowerCase().includes(q)
    );
  }, [machines, search]);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteMachine(deleteTarget.id);
    toast.success("Maschine gelöscht");
    router.refresh();
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button onClick={openCreate} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Neue Maschine
        </Button>
      </div>

      {/* Table */}
      {machines.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Noch keine Maschinen erfasst</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Keine Maschinen gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2fr_1.2fr_1.5fr_1.2fr_1fr_1fr_56px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
            {["Name", "Typ", "Hersteller", "Modell", "Status", "Stundensatz", ""].map((h) => (
              <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
            ))}
          </div>
          {filtered.map((m, i) => (
            <Link
              key={m.id}
              href={`/ressourcen/maschinen/${m.id}`}
              className={`grid grid-cols-[2fr_1.2fr_1.5fr_1.2fr_1fr_1fr_56px] gap-3 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i !== filtered.length - 1 ? "border-b border-gray-100" : ""}`}
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
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget({ id: m.id, name: m.name }); }}
                  className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ConfirmDialog: Maschine löschen */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Maschine löschen"
        description={deleteTarget ? `"${deleteTarget.name}" wird unwiderruflich gelöscht. Alle Einsätze und Wartungen werden ebenfalls gelöscht.` : undefined}
        onConfirm={confirmDelete}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Maschine bearbeiten" : "Neue Maschine"}</DialogTitle>
          </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Name *</Label>
                  <Input
                    placeholder="z.B. Bagger 01"
                    value={form.name}
                    onChange={(e) => setForm((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Maschinentyp *</Label>
                  <Select value={form.machineType} onValueChange={(v) => setForm((d) => ({ ...d, machineType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MACHINE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.machineType === "Sonstiges" && (
                    <Input
                      className="mt-1.5"
                      placeholder="Typ eingeben..."
                      value={form.machineTypeCustom}
                      onChange={(e) => setForm((d) => ({ ...d, machineTypeCustom: e.target.value }))}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Hersteller</Label>
                  <Input
                    placeholder="z.B. Caterpillar"
                    value={form.manufacturer}
                    onChange={(e) => setForm((d) => ({ ...d, manufacturer: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Modell</Label>
                  <Input
                    placeholder="z.B. 320"
                    value={form.model}
                    onChange={(e) => setForm((d) => ({ ...d, model: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Baujahr</Label>
                  <Input
                    type="number"
                    placeholder="2020"
                    min="1950"
                    max="2099"
                    value={form.year}
                    onChange={(e) => setForm((d) => ({ ...d, year: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Kennzeichen</Label>
                  <Input
                    placeholder="z.B. W-12345"
                    value={form.licensePlate}
                    onChange={(e) => setForm((d) => ({ ...d, licensePlate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Seriennummer</Label>
                  <Input
                    placeholder="Optional"
                    value={form.serialNumber}
                    onChange={(e) => setForm((d) => ({ ...d, serialNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Stundensatz (€/h)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.hourlyRate}
                    onChange={(e) => setForm((d) => ({ ...d, hourlyRate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((d) => ({ ...d, status: v as MachineStatusType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Verfügbar</SelectItem>
                    <SelectItem value="IN_USE">Im Einsatz</SelectItem>
                    <SelectItem value="MAINTENANCE">Wartung</SelectItem>
                    <SelectItem value="OUT_OF_SERVICE">Außer Betrieb</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Notizen</Label>
                <Textarea
                  rows={2}
                  className="resize-none"
                  placeholder="Optional"
                  value={form.notes}
                  onChange={(e) => setForm((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Speichert..." : editingId ? "Speichern" : "Maschine erstellen"}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
