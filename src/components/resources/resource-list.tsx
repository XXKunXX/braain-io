"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, X, User, Truck, Settings2, Package, Pencil, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createResource, updateResource, deleteResource } from "@/actions/resources";
import type { ResourceFormData } from "@/actions/resources";
import { MachineTab } from "@/components/machines/machine-tab";
import type { MachineRow } from "@/actions/machines";

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
};

export function ResourceList({ resources, machines = [] }: { resources: Resource[]; machines?: MachineRow[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("FAHRER");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ResourceFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return resources.filter(
      (r) =>
        r.type === activeTab &&
        (!q ||
          r.name.toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.phone ?? "").toLowerCase().includes(q))
    );
  }, [resources, activeTab, search]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, type: activeTab as ResourceFormData["type"] });
    setEditingId(null);
    setShowForm(true);
  }

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
    if (!form.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    setIsSubmitting(true);
    const result = editingId
      ? await updateResource(editingId, form)
      : await createResource(form);
    setIsSubmitting(false);

    if ("error" in result && result.error) {
      toast.error("Fehler beim Speichern");
      return;
    }
    toast.success(editingId ? "Ressource aktualisiert" : "Ressource erstellt");
    closeForm();
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    await deleteResource(id);
    toast.success("Ressource gelöscht");
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ressourcen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{resources.length} Ressourcen</p>
        </div>
        {activeTab !== "MASCHINE" && (
          <Button onClick={openCreate} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="h-4 w-4" />
            Neue Ressource
          </Button>
        )}
      </div>

      {/* Type tabs */}
      <div className="flex items-center gap-1">
        {TYPE_TABS.filter((t) => (tabCounts[t.key] ?? 0) > 0 || t.key === activeTab || t.key === "MASCHINE").map(
          ({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                activeTab === key
                  ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {(tabCounts[key] ?? 0) > 0 && (
                <span className="text-xs text-gray-400">({tabCounts[key]})</span>
              )}
            </button>
          )
        )}
      </div>

      {/* Machine tab — handled by its own component */}
      {activeTab === "MASCHINE" && <MachineTab machines={machines} />}

      {/* Search */}
      {activeTab !== "MASCHINE" && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      )}

      {/* Table (not shown for MASCHINE tab — handled above) */}
      {activeTab !== "MASCHINE" && (filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Keine Einträge gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          {activeTab === "FAHRZEUG" ? (
            <div className="grid grid-cols-[2fr_1.5fr_2fr_1fr_64px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              {["Name", "Kennzeichen", "Fahrer", "Status", ""].map(h => (
                <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
              ))}
            </div>
          ) : (
            <div className={`grid gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80 ${activeTab === "FAHRER" ? "grid-cols-[2fr_2fr_1.5fr_1fr_24px_64px]" : "grid-cols-[2fr_2fr_1.5fr_1fr_64px]"}`}>
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Name</span>
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">E-Mail</span>
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Telefon</span>
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</span>
              {activeTab === "FAHRER" && <span />}
              <span />
            </div>
          )}

          {/* Rows */}
          {filtered.map((resource, i) => (
            <div
              key={resource.id}
              className={`grid gap-4 px-5 py-3.5 items-center group hover:bg-gray-50 transition-colors ${
                activeTab === "FAHRZEUG"
                  ? "grid-cols-[2fr_1.5fr_2fr_1fr_64px]"
                  : activeTab === "FAHRER"
                  ? "grid-cols-[2fr_2fr_1.5fr_1fr_24px_64px]"
                  : "grid-cols-[2fr_2fr_1.5fr_1fr_64px]"
              } ${i !== filtered.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <p className="text-sm font-semibold text-gray-900 truncate">{resource.name}</p>
              {activeTab === "FAHRZEUG" ? (
                <>
                  <p className="text-sm text-gray-500 font-mono">{resource.licensePlate || "–"}</p>
                  <p className="text-sm text-gray-500 truncate">{resource.assignedDriver?.name || "–"}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 truncate">{resource.email || "–"}</p>
                  <p className="text-sm text-gray-500 truncate">{resource.phone || "–"}</p>
                </>
              )}
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
              {activeTab === "FAHRER" && (
                <div title={resource.clerkUserId ? "App-Nutzer verknüpft" : "Kein App-Nutzer"}>
                  <Link2 className={`h-3.5 w-3.5 ${resource.clerkUserId ? "text-blue-500" : "text-gray-200"}`} />
                </div>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(resource)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(resource.id, resource.name)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {editingId ? "Ressource bearbeiten" : "Neue Ressource"}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((d) => ({ ...d, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                  value={form.description ?? ""}
                  onChange={(e) => setForm((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
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
                      onChange={(e) => setForm((d) => ({ ...d, licensePlate: e.target.value.toUpperCase() }))}
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
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
              <Button variant="outline" onClick={closeForm}>Abbrechen</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Wird gespeichert..." : editingId ? "Speichern" : "Ressource erstellen"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
