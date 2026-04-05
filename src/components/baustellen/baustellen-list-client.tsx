"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, X, ChevronRight, HardHat, Files, Calendar, Zap, AlertCircle, Receipt, CheckCircle2 } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { updateBaustelle, deleteBaustelle } from "@/actions/baustellen";
import type { BaustelleRow, BaustelleStatusType } from "@/actions/baustellen";
import { sortItems } from "@/lib/sort";
import { SortHeader } from "@/components/ui/sort-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUS_TABS = [
  { key: "ALL", label: "Alle", icon: Files },
  { key: "OPEN", label: "Offen", icon: Calendar },
  { key: "DISPONIERT", label: "Disponiert", icon: Zap },
  { key: "IN_LIEFERUNG", label: "In Lieferung", icon: AlertCircle },
  { key: "VERRECHNET", label: "Verrechnet", icon: Receipt },
  { key: "ABGESCHLOSSEN", label: "Abgeschlossen", icon: CheckCircle2 },
] as const;

const STATUS_LABEL: Record<BaustelleStatusType, string> = {
  OPEN: "Offen",
  DISPONIERT: "Disponiert",
  IN_LIEFERUNG: "In Lieferung",
  VERRECHNET: "Verrechnet",
  ABGESCHLOSSEN: "Abgeschlossen",
};

function fmt(d: Date | string | null | undefined) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE");
}

type OrderOption = { id: string; orderNumber: string; title: string };
type UserOption = string;

type FormData = {
  orderId: string | null;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  startDate: string;
  endDate: string;
  status: BaustelleStatusType;
  bauleiter: string | null;
  contactPerson: string;
  phone: string;
  description: string;
  notes: string;
};

const EMPTY: FormData = {
  orderId: "", name: "", address: "", postalCode: "", city: "",
  startDate: "", endDate: "", status: "OPEN",
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [sortKey, setSortKey] = useState<string | null>("startDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [activeTab, setActiveTab] = useState("ALL");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: baustellen.length };
    for (const b of baustellen) {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
    }
    return counts;
  }, [baustellen]);

  const filtered = useMemo(() => {
    const base = baustellen.filter((b) => {
      if (activeTab !== "ALL" && b.status !== activeTab) return false;
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
  }, [baustellen, activeTab, filterFrom, filterTo, sortKey, sortDir]);

  const hasExtraFilters = filterFrom || filterTo;

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteBaustelle(deleteTarget.id);
    toast.success("Baustelle gelöscht");
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Baustellen</h1>
        <p className="text-sm text-gray-400 mt-0.5">{baustellen.length} Baustellen gesamt</p>
      </div>

      {/* Status Tabs */}
      <div className="overflow-hidden">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_TABS.filter(({ key }) => key === "ALL" || (tabCounts[key] ?? 0) > 0).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              title={label}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                activeTab === key
                  ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {(tabCounts[key] ?? 0) > 0 && (
                <span className="text-xs text-gray-400">({tabCounts[key]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Date filter + CTA */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors bg-white outline-none cursor-pointer ${
              filterFrom
                ? "border-gray-300 text-gray-900 shadow-sm"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          />
          <span className="text-gray-300 text-xs">–</span>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors bg-white outline-none cursor-pointer ${
              filterTo
                ? "border-gray-300 text-gray-900 shadow-sm"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          />
        </div>
        {hasExtraFilters && (
          <button
            onClick={() => { setFilterFrom(""); setFilterTo(""); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Zurücksetzen
          </button>
        )}
        <span className="text-sm text-gray-400">{filtered.length} Baustellen</span>
        <div className="ml-auto">
          <Link href="/baustellen/neu" className="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm gap-1.5">
            <Plus className="h-4 w-4" />
            Neue Baustelle
          </Link>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={HardHat}
          headline="Keine Baustellen gefunden"
          subline="Passe die Filter an oder lege eine neue Baustelle an."
          ctaLabel="Neue Baustelle"
          ctaHref="/baustellen/neu"
        />
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filtered.map((b) => (
              <Link
                key={b.id}
                href={`/baustellen/${b.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 truncate">
                        {(b.contact ?? b.order.contact)?.companyName ?? "–"}
                      </span>
                      {b.city && <span className="text-xs text-gray-400">{b.city}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={b.status} />
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {fmt(b.startDate)}{b.endDate ? ` – ${fmt(b.endDate)}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget({ id: b.id, name: b.name }); }}
                      className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <SortHeader label="Baustelle" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Kunde" sortKey="contact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Adresse" sortKey="city" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Zeitraum" sortKey="startDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
            </div>

            {filtered.map((b, i) => (
              <Link
                key={b.id}
                href={`/baustellen/${b.id}`}
                className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
                  i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <span className="text-sm font-medium text-gray-900 truncate">{b.name}</span>
                <span className="text-sm text-gray-500 truncate">
                  {(b.contact ?? b.order.contact)?.companyName ?? "–"}
                </span>
                <span className="text-sm text-gray-500 truncate">
                  {[b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}
                </span>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  {fmt(b.startDate)}{b.endDate ? ` – ${fmt(b.endDate)}` : ""}
                </span>
                <div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: b.id, name: b.name }); }}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ConfirmDialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Baustelle löschen"
        description={deleteTarget ? `"${deleteTarget.name}" wird unwiderruflich gelöscht.` : undefined}
        onConfirm={confirmDelete}
      />

      {/* Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Baustelle bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name *">
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Baustelle Hauptstraße" />
              </Field>
              <Field label="Auftrag *">
                <Select value={form.orderId} onValueChange={(v) => setForm(f => ({ ...f, orderId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Auftrag wählen..." /></SelectTrigger>
                  <SelectContent>
                    {orders.map(o => <SelectItem key={o.id} value={o.id}>{o.orderNumber} – {o.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Adresse">
              <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Musterstraße 1" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="PLZ">
                <Input value={form.postalCode} onChange={(e) => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="1010" />
              </Field>
              <Field label="Ort">
                <Input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Wien" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Startdatum *">
                <Input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </Field>
              <Field label="Enddatum">
                <Input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Bauleiter">
                <Select value={form.bauleiter || "_none"} onValueChange={(v) => setForm(f => ({ ...f, bauleiter: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Kein Bauleiter" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Kein Bauleiter</SelectItem>
                    {userNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as BaustelleStatusType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Offen</SelectItem>
                    <SelectItem value="DISPONIERT">Disponiert</SelectItem>
                    <SelectItem value="IN_LIEFERUNG">In Lieferung</SelectItem>
                    <SelectItem value="VERRECHNET">Verrechnet</SelectItem>
                    <SelectItem value="ABGESCHLOSSEN">Abgeschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Kontaktperson">
                <Input value={form.contactPerson} onChange={(e) => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
              </Field>
              <Field label="Telefon">
                <Input type="tel" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            <Field label="Beschreibung">
              <Textarea rows={2} className="resize-none" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label="Notizen">
              <Textarea rows={2} className="resize-none" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      {children}
    </div>
  );
}
