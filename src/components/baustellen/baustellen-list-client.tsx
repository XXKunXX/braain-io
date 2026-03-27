"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, X, ChevronRight, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateBaustelle, deleteBaustelle } from "@/actions/baustellen";
import type { BaustelleRow, BaustelleStatusType } from "@/actions/baustellen";
import { sortItems } from "@/lib/sort";
import { SortHeader } from "@/components/ui/sort-header";

const STATUS_LABEL: Record<BaustelleStatusType, string> = {
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
};
const STATUS_COLOR: Record<BaustelleStatusType, string> = {
  PLANNED: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETED: "bg-gray-100 text-gray-500",
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
  const [sortKey, setSortKey] = useState<string | null>("startDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filters
  const [filterOrder, setFilterOrder] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const base = baustellen.filter((b) => {
      if (filterOrder !== "ALL" && b.orderId !== filterOrder) return false;
      if (filterStatus !== "ALL" && b.status !== filterStatus) return false;
      if (filterFrom && new Date(b.startDate) < new Date(filterFrom)) return false;
      if (filterTo && b.endDate && new Date(b.endDate) > new Date(filterTo)) return false;
      return true;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "name") return item.name;
      if (key === "contact") return (item.contact ?? item.order.contact)?.companyName ?? "";
      if (key === "city") return item.city ?? "";
      if (key === "startDate") return new Date(item.startDate);
      if (key === "status") return item.status;
      return (item as Record<string, unknown>)[key];
    });
  }, [baustellen, filterOrder, filterStatus, filterFrom, filterTo, sortKey, sortDir]);

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
          <h1 className="text-xl font-semibold text-gray-900">Baustellen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{baustellen.length} Baustellen gesamt</p>
        </div>
        <Link
          href="/baustellen/neu"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Neue Baustelle
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterOrder}
          onChange={e => setFilterOrder(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Alle Aufträge</option>
          {orders.map(o => (
            <option key={o.id} value={o.id}>{o.orderNumber} – {o.title}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Alle Status</option>
          <option value="PLANNED">Geplant</option>
          <option value="ACTIVE">Aktiv</option>
          <option value="COMPLETED">Abgeschlossen</option>
        </select>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Von"
          />
          <span className="text-gray-400 text-xs">–</span>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Bis"
          />
        </div>
        {(filterOrder !== "ALL" || filterStatus !== "ALL" || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterOrder("ALL"); setFilterStatus("ALL"); setFilterFrom(""); setFilterTo(""); }}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-400 hover:text-gray-700 bg-white flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" />Filter zurücksetzen
          </button>
        )}
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} Baustellen</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">Keine Baustellen gefunden</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/80">
            <span />
            <SortHeader label="Baustelle" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Kunde" sortKey="contact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Adresse" sortKey="city" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Zeitraum" sortKey="startDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <span />
          </div>

          {/* Rows */}
          {filtered.map((b, i) => (
            <Link
              key={b.id}
              href={`/baustellen/${b.id}`}
              className={`flex md:grid md:grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 items-center hover:bg-gray-50/60 transition-colors group ${
                i !== filtered.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Icon */}
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-green-50">
                <HardHat className="h-3.5 w-3.5 text-green-600" />
              </div>

              {/* Name */}
              <div className="min-w-0 flex-1 md:flex-none flex items-center gap-2 overflow-hidden">
                <span className="text-sm font-medium text-gray-900 truncate">{b.name}</span>
              </div>

              {/* Kunde */}
              <span className="hidden md:block text-xs text-gray-500 truncate">
                {(b.contact ?? b.order.contact)?.companyName ?? "–"}
              </span>

              {/* Adresse */}
              <span className="hidden md:block text-xs text-gray-500 truncate">
                {[b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}
              </span>

              {/* Zeitraum */}
              <span className="hidden md:block text-xs text-gray-500 whitespace-nowrap">
                {fmt(b.startDate)}{b.endDate ? ` – ${fmt(b.endDate)}` : ""}
              </span>

              {/* Status badge */}
              <div className="hidden md:block">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[b.status]}`}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>

              {/* Right: edit/delete on hover + chevron */}
              <div className="flex items-center justify-end relative">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 absolute right-4">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(b); }}
                    className="text-gray-300 hover:text-gray-600 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(b.id, b.name); }}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:opacity-0 transition-opacity" />
              </div>
            </Link>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="PLZ">
                  <input type="text" className={IC} value={form.postalCode} onChange={(e) => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="1010" />
                </Field>
                <Field label="Ort">
                  <input type="text" className={IC} value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Wien" />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Startdatum *">
                  <input type="date" className={IC} value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </Field>
                <Field label="Enddatum">
                  <input type="date" className={IC} value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
