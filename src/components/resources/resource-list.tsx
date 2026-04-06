"use client";

import { useState, useMemo, useEffect } from "react";
import { useTabLabels } from "@/hooks/use-tab-labels";
import { useRouter } from "next/navigation";
import { Search, Plus, User, Truck, Settings2, Package, Trash2, Link2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateResource, deleteResource } from "@/actions/resources";
import type { ResourceFormData } from "@/actions/resources";
import { MachineTab } from "@/components/machines/machine-tab";
import type { MachineRow } from "@/actions/machines";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";
import { formatLicensePlate } from "@/lib/license-plate";

type Resource = {
  id: string;
  name: string;
  type: "FAHRER" | "MASCHINE" | "FAHRZEUG" | "PRODUKT" | "OTHER";
  email: string | null;
  phone: string | null;
  description: string | null;
  active: boolean;
  clerkUserId: string | null;
  licensePlate: string | null;
  driverResourceId: string | null;
  assignedDriver: { id: string; name: string } | null;
  isDeployed: boolean;
};

type ClerkUser = { id: string; name: string; email: string | null };

const TYPE_TABS = [
  { key: "FAHRER", label: "Fahrer", icon: User },
  { key: "FAHRZEUG", label: "Fahrzeuge", icon: Truck },
  { key: "MASCHINE", label: "Maschinen", icon: Settings2 },
  { key: "PRODUKT", label: "Produkte", icon: Package },
  { key: "OTHER", label: "Sonstiges", icon: Package },
] as const;

const EMPTY_FORM: ResourceFormData = {
  name: "",
  type: "FAHRER",
  email: "",
  phone: "",
  description: "",
  clerkUserId: "",
  licensePlate: "",
  driverResourceId: "",
  vehicleManufacturer: "",
  vehicleModel: "",
  vehicleYear: "",
};

export function ResourceList({ resources, machines = [] }: { resources: Resource[]; machines?: MachineRow[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("FAHRER");
  const { containerRef: tabContainerRef, showLabels } = useTabLabels();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ResourceFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetch("/api/clerk-users")
      .then((r) => r.json())
      .then((data) => setClerkUsers(data.users ?? []))
      .catch(() => {});
  }, []);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of resources) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
    // MASCHINE tab shows Machine model records, not Resource records
    counts["MASCHINE"] = machines.length;
    return counts;
  }, [resources, machines]);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const base = resources.filter(
      (r) =>
        r.type === activeTab &&
        matchesSearch(search, r.name, r.email, r.phone)
    );
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "name") return item.name;
      if (key === "active") return item.active ? "aktiv" : "inaktiv";
      return (item as Record<string, unknown>)[key];
    });
  }, [resources, activeTab, search, sortKey, sortDir]);

  function openEdit(r: Resource) {
    setForm({
      name: r.name,
      type: r.type,
      email: r.email ?? "",
      phone: r.phone ?? "",
      description: r.description ?? "",
      clerkUserId: r.clerkUserId ?? "",
      licensePlate: r.licensePlate ?? "",
      driverResourceId: r.driverResourceId ?? "",
      vehicleManufacturer: (r as any).vehicleManufacturer ?? "",
      vehicleModel: (r as any).vehicleModel ?? "",
      vehicleYear: (r as any).vehicleYear ?? "",
      unit: (r as any).unit ?? "",
      price: (r as any).price ? String((r as any).price) : "",
      quoteDescription: (r as any).quoteDescription ?? "",
    });
    setEditingId(r.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !editingId) return;
    setIsSubmitting(true);
    const result = await updateResource(editingId, form);
    setIsSubmitting(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Speichern"); return; }
    toast.success("Ressource aktualisiert");
    closeForm();
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteResource(deleteTarget.id);
    toast.success("Ressource gelöscht");
    router.refresh();
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Type tabs */}
      <div className="overflow-hidden">
        <div ref={tabContainerRef} className="flex items-center gap-1">
          {TYPE_TABS.filter((t) => (tabCounts[t.key] ?? 0) > 0 || t.key === activeTab || t.key === "MASCHINE" || t.key === "FAHRZEUG").map(
            ({ key, label, icon: Icon }) => (
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
                <span data-tab-label className={showLabels ? "inline" : "hidden"}>{label}</span>
                {(tabCounts[key] ?? 0) > 0 && (
                  <span data-tab-label className={showLabels ? "inline text-xs text-gray-400" : "hidden"}>({tabCounts[key]})</span>
                )}
              </button>
            )
          )}
        </div>
      </div>

      {/* Machine tab — handled by its own component */}
      {activeTab === "MASCHINE" && <MachineTab machines={machines} />}

      {/* Search + CTA */}
      {activeTab !== "MASCHINE" && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Link href={`/ressourcen/neu?type=${activeTab}`}>
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Neue Ressource
            </Button>
          </Link>
        </div>
      )}

      {/* Table (not shown for MASCHINE tab — handled above) */}
      {activeTab !== "MASCHINE" && (filtered.length === 0 ? (
        <EmptyState
          icon={activeTab === "FAHRER" ? User : activeTab === "FAHRZEUG" ? Truck : activeTab === "PRODUKT" ? Package : Settings2}
          headline="Keine Einträge gefunden"
          subline="Passe die Suche an oder lege eine neue Ressource an."
        />
      ) : (
        <>
        {/* Mobile Card Layout */}
        <div className="md:hidden space-y-3">
          {filtered.map((resource) => (
            <div
              key={resource.id}
              onClick={() => openEdit(resource)}
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{resource.name}</p>
                  {activeTab === "FAHRZEUG" && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {resource.licensePlate && (
                        <span className="text-xs text-gray-500 font-mono">{resource.licensePlate}</span>
                      )}
                      {resource.assignedDriver && (
                        <span className="text-xs text-gray-400">{resource.assignedDriver.name}</span>
                      )}
                    </div>
                  )}
                  {activeTab === "PRODUKT" && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {(resource as any).unit && <span className="text-xs text-gray-500">{(resource as any).unit}</span>}
                      {(resource as any).price && <span className="text-xs text-gray-500">€ {Number((resource as any).price).toFixed(2)}</span>}
                    </div>
                  )}
                  {activeTab !== "FAHRZEUG" && activeTab !== "PRODUKT" && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {resource.email && <span className="text-xs text-gray-400">{resource.email}</span>}
                      {resource.phone && <span className="text-xs text-gray-400">{resource.phone}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {activeTab !== "PRODUKT" && (
                    resource.isDeployed ? (
                      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50">Im Einsatz</span>
                    ) : (
                      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full border border-green-300 text-green-700 bg-green-50">Verfügbar</span>
                    )
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: resource.id, name: resource.name }); }}
                    className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          {activeTab === "FAHRZEUG" ? (
            <div className="grid grid-cols-[2fr_1.5fr_2fr_1fr_64px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <SortHeader label="Name" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kennzeichen</span>
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Fahrer</span>
              <SortHeader label="Status" sortKey="active" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span />
            </div>
          ) : activeTab === "PRODUKT" ? (
            <div className="grid grid-cols-[2fr_1fr_1fr_2fr_64px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <SortHeader label="Name" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Einheit</span>
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Preis</span>
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Artikelbeschreibung</span>
              <span />
            </div>
          ) : (
            <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr_64px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <SortHeader label="Name" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">E-Mail</span>
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Telefon</span>
              <SortHeader label="Status" sortKey="active" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span />
            </div>
          )}

          {/* Rows */}
          {filtered.map((resource, i) => (
            <div
              key={resource.id}
              onClick={() => openEdit(resource)}
              className={`grid gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors cursor-pointer ${
                activeTab === "FAHRZEUG"
                  ? "grid-cols-[2fr_1.5fr_2fr_1fr_64px]"
                  : activeTab === "PRODUKT"
                  ? "grid-cols-[2fr_1fr_1fr_2fr_64px]"
                  : "grid-cols-[2fr_2fr_1.5fr_1fr_64px]"
              } ${i !== filtered.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <p className="text-sm font-semibold text-gray-900 truncate">{resource.name}</p>
              {activeTab === "FAHRZEUG" ? (
                <>
                  <p className="text-sm text-gray-500 font-mono">{resource.licensePlate ? formatLicensePlate(resource.licensePlate) : "–"}</p>
                  <p className="text-sm text-gray-500 truncate">{resource.assignedDriver?.name || "–"}</p>
                </>
              ) : activeTab === "PRODUKT" ? (
                <>
                  <p className="text-sm text-gray-500">{(resource as any).unit || "–"}</p>
                  <p className="text-sm text-gray-500">{(resource as any).price ? `€ ${Number((resource as any).price).toFixed(2)}` : "–"}</p>
                  <p className="text-sm text-gray-500 truncate">{(resource as any).quoteDescription || "–"}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 truncate">{resource.email || "–"}</p>
                  <p className="text-sm text-gray-500 truncate">{resource.phone || "–"}</p>
                </>
              )}
              {activeTab !== "PRODUKT" && (
                <div>
                  {resource.isDeployed ? (
                    <span className="inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50">
                      Im Einsatz
                    </span>
                  ) : (
                    <span className="inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full border border-green-300 text-green-700 bg-green-50">
                      Verfügbar
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end gap-1">
                {activeTab === "FAHRER" && (
                  <span title={resource.clerkUserId ? "App-Nutzer verknüpft" : "Kein App-Nutzer"}>
                    <Link2 className={`h-3.5 w-3.5 ${resource.clerkUserId ? "text-blue-500" : "text-gray-200"}`} />
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: resource.id, name: resource.name }); }}
                  className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
        </>
      ))}

      {/* ConfirmDialog: Ressource löschen */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Ressource löschen"
        description={deleteTarget ? `"${deleteTarget.name}" wird unwiderruflich gelöscht.` : undefined}
        onConfirm={confirmDelete}
      />

      {/* Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ressource bearbeiten</DialogTitle>
          </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Klaus Wagner"
                    value={form.name}
                    onChange={(e) => setForm((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Typ</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.type}
                    onChange={(e) =>
                      setForm((d) => ({ ...d, type: e.target.value as ResourceFormData["type"] }))
                    }
                  >
                    <option value="FAHRER">Fahrer</option>
                    <option value="MASCHINE">Maschine</option>
                    <option value="FAHRZEUG">Fahrzeug</option>
                    <option value="PRODUKT">Produkt</option>
                    <option value="OTHER">Sonstiges</option>
                  </select>
                </div>
              </div>
              {form.type === "PRODUKT" ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Einheit</label>
                      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={(form as any).unit ?? ""} onChange={(e) => setForm((d) => ({ ...d, unit: e.target.value }))}>
                        <option value="">– Einheit wählen –</option>
                        <option value="t">t (Tonnen)</option>
                        <option value="m³">m³ (Kubikmeter)</option>
                        <option value="m²">m² (Quadratmeter)</option>
                        <option value="m">m (Meter)</option>
                        <option value="Stk">Stk (Stück)</option>
                        <option value="Std">Std (Stunden)</option>
                        <option value="Pauschale">Pauschale</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Preis (€)</label>
                      <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" value={(form as any).price ?? ""} onChange={(e) => setForm((d) => ({ ...d, price: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Artikelbeschreibung für Angebot</label>
                    <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Beschreibungstext..." value={(form as any).quoteDescription ?? ""} onChange={(e) => setForm((d) => ({ ...d, quoteDescription: e.target.value }))} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">E-Mail</label>
                    <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" value={form.email ?? ""} onChange={(e) => setForm((d) => ({ ...d, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                    <input type="tel" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" value={form.phone ?? ""} onChange={(e) => setForm((d) => ({ ...d, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
                    <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" value={form.description ?? ""} onChange={(e) => setForm((d) => ({ ...d, description: e.target.value }))} />
                  </div>
                </>
              )}
              {form.type === "FAHRER" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    App-Nutzer verknüpfen
                  </label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.clerkUserId ?? ""}
                    onChange={(e) => setForm((d) => ({ ...d, clerkUserId: e.target.value }))}
                  >
                    <option value="">— Kein Nutzer —</option>
                    {clerkUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.email ? ` (${u.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Fahrer kann sich damit in der App anmelden und seine Aufträge sehen.
                  </p>
                </div>
              )}
              {form.type === "FAHRZEUG" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Kennzeichen</label>
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      placeholder="z.B. W 12345 A"
                      value={form.licensePlate ?? ""}
                      onChange={(e) => setForm((d) => ({ ...d, licensePlate: formatLicensePlate(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fahrer verknüpfen</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.driverResourceId ?? ""}
                      onChange={(e) => setForm((d) => ({ ...d, driverResourceId: e.target.value }))}
                    >
                      <option value="">— Kein Fahrer —</option>
                      {resources.filter(r => r.type === "FAHRER").map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hersteller</label>
                      <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="z.B. Mercedes" value={(form as any).vehicleManufacturer ?? ""} onChange={(e) => setForm((d) => ({ ...d, vehicleManufacturer: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Modell</label>
                      <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="z.B. Sprinter" value={(form as any).vehicleModel ?? ""} onChange={(e) => setForm((d) => ({ ...d, vehicleModel: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Baujahr</label>
                      <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="2021" value={(form as any).vehicleYear ?? ""} onChange={(e) => setForm((d) => ({ ...d, vehicleYear: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Speichert..." : "Speichern"}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
