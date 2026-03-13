"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Eye, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateBaustelle, deleteBaustelle } from "@/actions/baustellen";
import type { BaustelleRow, BaustelleStatusType } from "@/actions/baustellen";

const STATUS_LABEL: Record<BaustelleStatusType, string> = {
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
};
const STATUS_COLOR: Record<BaustelleStatusType, string> = {
  PLANNED: "border-gray-300 text-gray-600 bg-gray-50",
  ACTIVE: "border-blue-300 text-blue-700 bg-blue-50",
  COMPLETED: "border-green-300 text-green-700 bg-green-50",
};

function fmt(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE");
}

type OrderOption = { id: string; orderNumber: string; title: string };
type UserOption = string;

type FormData = {
  orderId: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  startDate: string;
  endDate: string;
  status: BaustelleStatusType;
  bauleiter: string;
  contactPerson: string;
  phone: string;
  description: string;
  notes: string;
};

const EMPTY: FormData = {
  orderId: "", name: "", address: "", postalCode: "", city: "",
  startDate: "", endDate: "", status: "PLANNED",
  bauleiter: "", contactPerson: "", phone: "", description: "", notes: "",
};

interface Props {
  baustellen: BaustelleRow[];
  orders: OrderOption[];
  userNames: UserOption[];
}

export function BaustellenListClient({ baustellen, orders, userNames }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openEdit(b: BaustelleRow) {
    setForm({
      orderId: b.orderId,
      name: b.name,
      address: b.address ?? "",
      postalCode: b.postalCode ?? "",
      city: b.city ?? "",
      startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : "",
      endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 10) : "",
      status: b.status,
      bauleiter: b.bauleiter ?? "",
      contactPerson: b.contactPerson ?? "",
      phone: b.phone ?? "",
      description: b.description ?? "",
      notes: b.notes ?? "",
    });
    setEditingId(b.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.orderId || !form.startDate) {
      toast.error("Name, Auftrag und Startdatum sind erforderlich");
      return;
    }
    setSaving(true);
    const payload = {
      orderId: form.orderId,
      name: form.name,
      address: form.address || undefined,
      postalCode: form.postalCode || undefined,
      city: form.city || undefined,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      status: form.status,
      bauleiter: form.bauleiter || undefined,
      contactPerson: form.contactPerson || undefined,
      phone: form.phone || undefined,
      description: form.description || undefined,
      notes: form.notes || undefined,
    };
    if (!editingId) return;
    const result = await updateBaustelle(editingId, payload);
    setSaving(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Speichern"); return; }
    toast.success("Baustelle aktualisiert");
    closeForm();
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    await deleteBaustelle(id);
    toast.success("Baustelle gelöscht");
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Baustellen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{baustellen.length} Baustellen</p>
        </div>
        <Link href="/baustellen/neu">
          <Button className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="h-4 w-4" />
            Neue Baustelle
          </Button>
        </Link>
      </div>

      {/* Table */}
      {baustellen.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">Noch keine Baustellen erfasst</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2fr_2fr_2fr_1fr_1fr_1.2fr_80px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
            {["Baustelle", "Auftrag", "Adresse", "Start", "Ende", "Status", ""].map((h) => (
              <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
            ))}
          </div>
          {baustellen.map((b, i) => (
            <div
              key={b.id}
              className={`grid grid-cols-[2fr_2fr_2fr_1fr_1fr_1.2fr_80px] gap-3 px-5 py-3.5 items-center group hover:bg-gray-50 transition-colors ${i !== baustellen.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
              <p className="text-sm text-gray-500 truncate">{b.order.orderNumber} {b.order.title}</p>
              <p className="text-sm text-gray-500 truncate">
                {[b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}
              </p>
              <p className="text-sm text-gray-500">{fmt(b.startDate)}</p>
              <p className="text-sm text-gray-500">{b.endDate ? fmt(b.endDate) : "–"}</p>
              <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border w-fit ${STATUS_COLOR[b.status]}`}>
                {STATUS_LABEL[b.status]}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/baustellen/${b.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="Details">
                  <Eye className="h-3.5 w-3.5" />
                </Link>
                <button onClick={() => openEdit(b)} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(b.id, b.name)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">Baustelle bearbeiten</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name *">
                  <input type="text" className={IC} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Baustelle Hauptstraße" />
                </Field>
                <Field label="Auftrag *">
                  <select className={IC} value={form.orderId} onChange={(e) => setForm(f => ({ ...f, orderId: e.target.value }))}>
                    <option value="">– Auftrag wählen –</option>
                    {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber} – {o.title}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Adresse">
                <input type="text" className={IC} value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Musterstraße 1" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="PLZ">
                  <input type="text" className={IC} value={form.postalCode} onChange={(e) => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="1010" />
                </Field>
                <Field label="Ort">
                  <input type="text" className={IC} value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Wien" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Startdatum *">
                  <input type="date" className={IC} value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </Field>
                <Field label="Enddatum">
                  <input type="date" className={IC} value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bauleiter">
                  <select className={IC} value={form.bauleiter} onChange={(e) => setForm(f => ({ ...f, bauleiter: e.target.value }))}>
                    <option value="">– Kein Bauleiter –</option>
                    {userNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select className={IC} value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as BaustelleStatusType }))}>
                    <option value="PLANNED">Geplant</option>
                    <option value="ACTIVE">Aktiv</option>
                    <option value="COMPLETED">Abgeschlossen</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kontaktperson">
                  <input type="text" className={IC} value={form.contactPerson} onChange={(e) => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
                </Field>
                <Field label="Telefon">
                  <input type="tel" className={IC} value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                </Field>
              </div>
              <Field label="Beschreibung">
                <textarea rows={2} className={`${IC} resize-none`} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
              <Field label="Notizen">
                <textarea rows={2} className={`${IC} resize-none`} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
              </Field>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Speichert..." : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const IC = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
