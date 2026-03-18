"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  differenceInCalendarDays,
  startOfDay,
  startOfMonth,
  parseISO,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon,
  Plus, Trash2, Search, X, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createDispositionEntry,
  updateDispositionEntry,
  deleteDispositionEntry,
  createResource,
} from "@/actions/disposition";
import type { Order, Contact, DispositionEntry, Resource as PrismaResource } from "@prisma/client";

type ResourceItem = {
  id: string;
  name: string;
  type: string;
  licensePlate?: string | null;
  assignedDriver?: { id: string; name: string } | null;
};
type OrderWithContact = Order & { contact: Contact };
type EntryWithRelations = DispositionEntry & {
  resource: PrismaResource;
  order: OrderWithContact;
};
type ViewType = "tag" | "woche" | "monat" | "timeline";
type TypeFilter = "ALL" | "FAHRER" | "FAHRZEUG" | "MASCHINE";

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Resource type display
const TYPE_LABEL: Record<string, string> = {
  FAHRER: "Fahrer", MASCHINE: "Maschine", FAHRZEUG: "Fahrzeug", OTHER: "Sonstiges",
};
const TYPE_ROW_COLOR: Record<string, string> = {
  FAHRER: "bg-blue-50",
  MASCHINE: "bg-orange-50",
  FAHRZEUG: "bg-emerald-50",
  OTHER: "bg-gray-50",
};
const TYPE_BADGE: Record<string, string> = {
  FAHRER: "bg-blue-100 text-blue-700",
  MASCHINE: "bg-orange-100 text-orange-700",
  FAHRZEUG: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-gray-100 text-gray-500",
};
const TYPE_SECTION_LABEL: Record<string, string> = {
  FAHRER: "Fahrer & Mitarbeiter",
  MASCHINE: "Maschinen",
  FAHRZEUG: "Fahrzeuge",
  OTHER: "Sonstiges",
};

const ORDER_STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-green-500", PLANNED: "bg-blue-400", COMPLETED: "bg-gray-300",
};

// Entry palette — softer tones that look good as bars
const ENTRY_PALETTE = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500",   "bg-cyan-500", "bg-indigo-500",  "bg-pink-500",
];

const CELL_WIDTH: Record<ViewType, number | undefined> = {
  tag: undefined, woche: undefined, monat: 52, timeline: 80,
};

// Type filter options
const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "ALL",     label: "Alle" },
  { key: "FAHRER",  label: "Fahrer" },
  { key: "FAHRZEUG", label: "Fahrzeuge" },
  { key: "MASCHINE", label: "Maschinen" },
];

// Resource type display order
const TYPE_ORDER = ["FAHRER", "FAHRZEUG", "MASCHINE", "OTHER"];

interface Props {
  resources: ResourceItem[];
  orders: OrderWithContact[];
  entries: EntryWithRelations[];
  rangeStartISO: string;
  initialView: ViewType;
  baustelleId?: string;
  baustelleName?: string;
}

export function DispositionCalendar({
  resources,
  orders,
  entries,
  rangeStartISO,
  initialView,
  baustelleId,
  baustelleName,
}: Props) {
  const router = useRouter();
  const today = new Date();
  const rangeStart = parseISO(rangeStartISO);

  // Local entries state for optimistic updates
  const [localEntries, setLocalEntries] = useState<EntryWithRelations[]>(entries);
  useEffect(() => { setLocalEntries(entries); }, [entries]);

  const [view, setView] = useState<ViewType>(initialView);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drag state
  const dragOrderId = useRef<string | null>(null);
  const dragEntry = useRef<EntryWithRelations | null>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ resourceId: string; dayIdx: number } | null>(null);

  // Drop modal
  const [dropModal, setDropModal] = useState<{ resourceId: string; orderId: string } | null>(null);
  const [dropForm, setDropForm] = useState({ startDate: "", endDate: "", notes: "" });
  const [dropSubmitting, setDropSubmitting] = useState(false);

  // Edit entry modal
  const [editModal, setEditModal] = useState<EntryWithRelations | null>(null);
  const [editForm, setEditForm] = useState({ startDate: "", endDate: "", notes: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Collapsed order sections
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [plannedCollapsed, setPlannedCollapsed] = useState(true);

  const [entryForm, setEntryForm] = useState({
    resourceId: "", orderId: "",
    startDate: format(rangeStart, "yyyy-MM-dd"),
    endDate: format(rangeStart, "yyyy-MM-dd"),
    notes: "",
  });
  const [resourceForm, setResourceForm] = useState({
    name: "", type: "FAHRER" as "FAHRER" | "MASCHINE" | "FAHRZEUG" | "OTHER", description: "",
  });

  // Days array
  const days = useMemo(() => {
    switch (view) {
      case "tag": return [rangeStart];
      case "woche": return Array.from({ length: 6 }, (_, i) => addDays(rangeStart, i));
      case "monat": {
        const ms = startOfMonth(rangeStart);
        const count = differenceInCalendarDays(new Date(ms.getFullYear(), ms.getMonth() + 1, 0), ms) + 1;
        return Array.from({ length: count }, (_, i) => addDays(ms, i));
      }
      case "timeline": return Array.from({ length: 14 }, (_, i) => addDays(rangeStart, i));
    }
  }, [view, rangeStart]);

  const numDays = days.length;
  const cellWidth = CELL_WIDTH[view];

  // Filtered + grouped resources (exclude PRODUKT)
  const visibleResources = useMemo(() => {
    let r = resources.filter(res => res.type !== "PRODUKT");
    if (typeFilter !== "ALL") r = r.filter(res => res.type === typeFilter);
    return r;
  }, [resources, typeFilter]);

  const groupedResources = useMemo(() => {
    const map: Record<string, ResourceItem[]> = {};
    for (const r of visibleResources) {
      map[r.type] = map[r.type] ?? [];
      map[r.type].push(r);
    }
    return TYPE_ORDER
      .filter(t => map[t]?.length)
      .map(t => ({ type: t, items: map[t] }));
  }, [visibleResources]);

  // URL builder (preserves Baustelle filter)
  function dispoUrl(week: string, v: ViewType) {
    const p = new URLSearchParams({ week, view: v });
    if (baustelleId) p.set("baustelleId", baustelleId);
    if (baustelleName) p.set("baustelleName", baustelleName);
    return `/disposition?${p.toString()}`;
  }

  // Navigation
  function navigate(direction: "prev" | "next" | "today") {
    let target: Date;
    if (direction === "today") { target = today; }
    else {
      const d = direction === "prev" ? -1 : 1;
      if (view === "tag") target = addDays(rangeStart, d);
      else if (view === "monat") target = d < 0 ? subMonths(rangeStart, 1) : addMonths(rangeStart, 1);
      else if (view === "timeline") target = d < 0 ? subWeeks(rangeStart, 2) : addWeeks(rangeStart, 2);
      else target = d < 0 ? subWeeks(rangeStart, 1) : addWeeks(rangeStart, 1);
    }
    router.push(dispoUrl(format(target, "yyyy-MM-dd"), view));
  }

  function switchView(v: ViewType) {
    setView(v);
    router.push(dispoUrl(format(rangeStart, "yyyy-MM-dd"), v));
  }

  // Range label
  const rangeLabel = useMemo(() => {
    if (view === "tag") return format(rangeStart, "EEEE, dd. MMMM yyyy", { locale: de });
    if (view === "monat") return format(rangeStart, "MMMM yyyy", { locale: de });
    if (view === "timeline") {
      const end = addDays(rangeStart, 13);
      return `${format(rangeStart, "dd.MM.", { locale: de })} – ${format(end, "dd.MM.yyyy", { locale: de })}`;
    }
    return `KW ${format(rangeStart, "w", { locale: de })} · ${format(rangeStart, "dd.MM.", { locale: de })} – ${format(addDays(rangeStart, 5), "dd.MM.yyyy", { locale: de })}`;
  }, [view, rangeStart]);

  // Orders panel
  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter(o => !q || o.title.toLowerCase().includes(q) || o.contact.companyName.toLowerCase().includes(q));
  }, [orders, search]);
  const activeOrders = filteredOrders.filter(o => o.status === "ACTIVE");
  const plannedOrders = filteredOrders.filter(o => o.status === "PLANNED");

  const orderColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    orders.forEach((o, i) => { map[o.id] = ENTRY_PALETTE[i % ENTRY_PALETTE.length]; });
    return map;
  }, [orders]);

  // Entry positioning
  function getEntryStyle(entry: EntryWithRelations) {
    const rangeStartDay = startOfDay(days[0]);
    const rangeEndDay = startOfDay(days[numDays - 1]);
    const entryStart = startOfDay(new Date(entry.startDate));
    const entryEnd = startOfDay(new Date(entry.endDate));
    const clampedStart = entryStart < rangeStartDay ? rangeStartDay : entryStart;
    const clampedEnd = entryEnd > rangeEndDay ? rangeEndDay : entryEnd;
    const startOffset = differenceInCalendarDays(clampedStart, rangeStartDay);
    const endOffset = differenceInCalendarDays(clampedEnd, rangeStartDay);
    if (startOffset >= numDays || endOffset < 0) return null;
    const spanDays = endOffset - startOffset + 1;
    if (cellWidth) {
      return { left: `${startOffset * cellWidth + 2}px`, width: `${spanDays * cellWidth - 4}px`, spanDays };
    }
    return { left: `${(startOffset / numDays) * 100}%`, width: `calc(${(spanDays / numDays) * 100}% - 4px)`, spanDays };
  }

  // Conflict detection
  const dropConflict = useMemo(() => {
    if (!dropModal || !dropForm.startDate || !dropForm.endDate) return null;
    const newStart = new Date(dropForm.startDate);
    const newEnd = new Date(dropForm.endDate);
    if (newEnd <= newStart) return null;
    const conflicts = localEntries.filter(e =>
      e.resourceId === dropModal.resourceId &&
      new Date(e.startDate) < newEnd &&
      new Date(e.endDate) > newStart
    );
    return conflicts.length ? conflicts.map(e => e.order.title).join(", ") : null;
  }, [dropModal, dropForm.startDate, dropForm.endDate, entries]);

  // Drag & drop
  function handleDragStart(e: React.DragEvent, orderId: string) {
    dragOrderId.current = orderId;
    dragEntry.current = null;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("type", "order");
  }
  function handleEntryDragStart(e: React.DragEvent, entry: EntryWithRelations) {
    e.stopPropagation();
    dragEntry.current = entry;
    dragOrderId.current = null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "entry");
    setDraggingEntryId(entry.id);
  }
  function handleDragEnd() {
    setDraggingEntryId(null);
  }
  function handleDragOver(e: React.DragEvent, resourceId: string, dayIdx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragEntry.current ? "move" : "copy";
    setDropTarget({ resourceId, dayIdx });
  }
  function handleDragLeave() { setDropTarget(null); }
  async function handleDrop(e: React.DragEvent, resourceId: string, day: Date) {
    e.preventDefault();
    setDropTarget(null);

    // Moving an existing entry
    if (dragEntry.current) {
      const entry = dragEntry.current;
      dragEntry.current = null;
      setDraggingEntryId(null);
      const dayOffset = differenceInCalendarDays(startOfDay(day), startOfDay(new Date(entry.startDate)));
      if (dayOffset === 0 && resourceId === entry.resourceId) return; // no change
      const newStart = addDays(new Date(entry.startDate), dayOffset);
      const newEnd = addDays(new Date(entry.endDate), dayOffset);
      const newResourceId = resourceId !== entry.resourceId ? resourceId : entry.resourceId;

      // Optimistic update — instant UI
      const snapshot = localEntries;
      setLocalEntries(prev => prev.map(e =>
        e.id === entry.id
          ? { ...e, startDate: newStart, endDate: newEnd, resourceId: newResourceId }
          : e
      ));

      const result = await updateDispositionEntry(entry.id, {
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
        notes: entry.notes ?? undefined,
        resourceId: resourceId !== entry.resourceId ? resourceId : undefined,
      });
      if ("error" in result && result.error) {
        setLocalEntries(snapshot); // revert
        toast.error("Fehler beim Verschieben");
        return;
      }
      router.refresh(); // sync server state silently in background
      return;
    }

    // Assigning an order from the panel
    const orderId = dragOrderId.current;
    if (!orderId) return;
    const dateStr = format(day, "yyyy-MM-dd");
    setDropForm({ startDate: `${dateStr}T07:00`, endDate: `${dateStr}T17:00`, notes: "" });
    setDropModal({ resourceId, orderId });
  }

  async function handleDropModalSubmit() {
    if (!dropModal) return;
    if (!dropForm.startDate || !dropForm.endDate) { toast.error("Start und Ende sind erforderlich"); return; }
    if (new Date(dropForm.endDate) <= new Date(dropForm.startDate)) { toast.error("Ende muss nach dem Start liegen"); return; }
    setDropSubmitting(true);
    const result = await createDispositionEntry({
      resourceId: dropModal.resourceId, orderId: dropModal.orderId,
      baustelleId: baustelleId || null,
      startDate: dropForm.startDate, endDate: dropForm.endDate, notes: dropForm.notes,
    });
    setDropSubmitting(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Eintrag erstellt");
    setDropModal(null);
    router.refresh();
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm("Eintrag löschen?")) return;
    const snapshot = localEntries;
    setLocalEntries(prev => prev.filter(e => e.id !== id));
    const result = await deleteDispositionEntry(id);
    if (!("success" in result)) { setLocalEntries(snapshot); toast.error("Fehler beim Löschen"); return; }
    toast.success("Eintrag gelöscht");
    router.refresh();
  }

  function handleOpenEditModal(entry: EntryWithRelations) {
    setEditForm({
      startDate: format(new Date(entry.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(entry.endDate), "yyyy-MM-dd'T'HH:mm"),
      notes: entry.notes ?? "",
    });
    setEditModal(entry);
  }

  async function handleEditModalSubmit() {
    if (!editModal) return;
    if (!editForm.startDate || !editForm.endDate) { toast.error("Start und Ende sind erforderlich"); return; }
    if (new Date(editForm.endDate) <= new Date(editForm.startDate)) { toast.error("Ende muss nach dem Start liegen"); return; }
    setEditSubmitting(true);
    const result = await updateDispositionEntry(editModal.id, editForm);
    setEditSubmitting(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Speichern"); return; }
    toast.success("Eintrag aktualisiert");
    setEditModal(null);
    router.refresh();
  }

  async function handleAddEntry() {
    if (!entryForm.resourceId || !entryForm.orderId) { toast.error("Ressource und Auftrag sind erforderlich"); return; }
    setIsSubmitting(true);
    const result = await createDispositionEntry({ ...entryForm, baustelleId: baustelleId || null });
    setIsSubmitting(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Eintrag erstellt");
    setShowAddEntry(false);
    router.refresh();
  }

  async function handleAddResource() {
    if (!resourceForm.name.trim()) { toast.error("Name ist erforderlich"); return; }
    setIsSubmitting(true);
    const result = await createResource({ name: resourceForm.name, type: resourceForm.type, description: resourceForm.description || undefined });
    setIsSubmitting(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Ressource erstellt");
    setShowAddResource(false);
    setResourceForm({ name: "", type: "FAHRER", description: "" });
    router.refresh();
  }

  function dayCellStyle(): React.CSSProperties {
    return cellWidth ? { width: cellWidth, flexShrink: 0 } : { flex: 1 };
  }

  const INP = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-3.5 bg-white border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Disposition</h1>
          <p className="text-xs text-gray-400 mt-0.5">Ressourcenplanung</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => navigate("prev")} className="px-2.5 py-1.5 hover:bg-gray-50 border-r border-gray-200 transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            </button>
            <button onClick={() => navigate("today")} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-200 transition-colors">
              Heute
            </button>
            <button onClick={() => navigate("next")} className="px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => setShowAddEntry(true)}>
            <Plus className="h-3.5 w-3.5" />Eintrag
          </Button>
        </div>
      </div>

      {/* ── Baustelle filter banner ─────────────────────────────────────────── */}
      {baustelleId && (
        <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <span className="font-medium">Baustelle:</span>
            <span className="font-semibold">{baustelleName ?? baustelleId}</span>
            <span className="text-blue-400 text-xs hidden sm:inline">· Neue Einträge werden dieser Baustelle zugeordnet</span>
          </div>
          <a href={`/baustellen/${baustelleId}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
            <ArrowLeft className="h-3.5 w-3.5" />Zurück zur Baustelle
          </a>
        </div>
      )}

      {/* ── View tabs + type filter + range label ──────────────────────────── */}
      <div className="px-6 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-4 flex-shrink-0">
        {/* View tabs */}
        <div className="flex items-center gap-0.5">
          {(["tag", "woche", "monat", "timeline"] as ViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                view === v ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {v === "tag" ? "Tag" : v === "woche" ? "Woche" : v === "monat" ? "Monat" : "Timeline"}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex items-center gap-1">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                typeFilter === key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Range label */}
        <span className="text-xs font-medium text-gray-500 capitalize whitespace-nowrap">{rangeLabel}</span>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel: orders */}
        <div className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="px-4 pt-3 pb-2 border-b border-gray-100">
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">Aufträge</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
              <input
                type="text"
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 h-7 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {orders.length > 0 && (
              <p className="px-4 py-1.5 text-[10px] text-gray-300 bg-gray-50/60 border-b border-gray-100">
                In Kalender ziehen zum Zuweisen
              </p>
            )}

            {/* Active orders */}
            {activeOrders.length > 0 && (
              <div>
                <button
                  onClick={() => setActiveCollapsed(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Aktiv ({activeOrders.length})</span>
                  {activeCollapsed ? <ChevronRightIcon className="h-3 w-3 text-gray-300" /> : <ChevronDown className="h-3 w-3 text-gray-300" />}
                </button>
                {!activeCollapsed && activeOrders.map((order) => (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, order.id)}
                    onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                    className={`px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-2.5 cursor-grab active:cursor-grabbing select-none ${
                      selectedOrderId === order.id ? "bg-blue-50 border-l-2 border-l-blue-400" : ""
                    }`}
                  >
                    <div className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${ORDER_STATUS_DOT[order.status]}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{order.title}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{order.contact.companyName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Planned orders */}
            {plannedOrders.length > 0 && (
              <div>
                <button
                  onClick={() => setPlannedCollapsed(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Geplant ({plannedOrders.length})</span>
                  {plannedCollapsed ? <ChevronRightIcon className="h-3 w-3 text-gray-300" /> : <ChevronDown className="h-3 w-3 text-gray-300" />}
                </button>
                {!plannedCollapsed && plannedOrders.map((order) => (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, order.id)}
                    onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                    className={`px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-2.5 cursor-grab active:cursor-grabbing select-none ${
                      selectedOrderId === order.id ? "bg-blue-50 border-l-2 border-l-blue-400" : ""
                    }`}
                  >
                    <div className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${ORDER_STATUS_DOT[order.status]}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{order.title}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{order.contact.companyName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredOrders.length === 0 && (
              <div className="p-6 text-center text-xs text-gray-300">Keine Aufträge</div>
            )}
          </div>
        </div>

        {/* Right panel: Gantt */}
        <div className="flex-1 overflow-auto">
          {/* Sticky day-header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
            <div className="flex">
              <div className="w-52 flex-shrink-0 px-4 py-2.5 border-r border-gray-200 bg-gray-50/80 flex items-center">
                <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Ressource</span>
              </div>
              <div className="flex flex-1" style={cellWidth ? { width: numDays * cellWidth } : {}}>
                {days.map((day, idx) => {
                  const isToday = isSameDay(day, today);
                  const isOtherMonth = view === "monat" && !isSameMonth(day, rangeStart);
                  return (
                    <div
                      key={idx}
                      className={`text-center py-2 border-r last:border-r-0 border-gray-100 ${
                        isToday ? "bg-blue-50" : isOtherMonth ? "bg-gray-50/60" : ""
                      }`}
                      style={dayCellStyle()}
                    >
                      {view !== "tag" && (
                        <p className={`text-[9px] font-bold tracking-widest uppercase leading-none mb-0.5 ${isToday ? "text-blue-500" : "text-gray-300"}`}>
                          {WEEKDAY_SHORT[(day.getDay() + 6) % 7]}
                        </p>
                      )}
                      <p className={`text-xs font-bold leading-tight ${isToday ? "text-blue-700" : isOtherMonth ? "text-gray-300" : "text-gray-600"}`}>
                        {format(day, view === "monat" ? "d" : view === "tag" ? "d. MMMM" : "d", { locale: de })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Resource rows — grouped by type */}
          {visibleResources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-sm text-gray-400 mb-3">
                {typeFilter !== "ALL" ? `Keine ${TYPE_LABEL[typeFilter]} vorhanden` : "Noch keine Ressourcen angelegt"}
              </p>
              {typeFilter === "ALL" && (
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddResource(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Ressource hinzufügen
                </Button>
              )}
            </div>
          ) : (
            <>
              {groupedResources.map(({ type, items }) => (
                <div key={type}>
                  {/* Section header */}
                  <div className="flex border-b border-gray-100">
                    <div className={`w-52 flex-shrink-0 px-4 py-1.5 border-r border-gray-200 ${TYPE_ROW_COLOR[type] ?? "bg-gray-50"}`}>
                      <span className={`text-[10px] font-bold tracking-widest uppercase ${
                        type === "FAHRER" ? "text-blue-500" :
                        type === "MASCHINE" ? "text-orange-500" :
                        type === "FAHRZEUG" ? "text-emerald-500" : "text-gray-400"
                      }`}>
                        {TYPE_SECTION_LABEL[type] ?? type}
                      </span>
                    </div>
                    <div className={`flex-1 ${TYPE_ROW_COLOR[type] ?? "bg-gray-50"}`}
                      style={cellWidth ? { width: numDays * cellWidth } : {}}
                    />
                  </div>

                  {/* Resource rows in this group */}
                  {items.map((resource) => {
                    const resourceEntries = localEntries.filter(e => e.resourceId === resource.id);
                    return (
                      <div key={resource.id} className="flex border-b border-gray-100 hover:bg-gray-50/50 transition-colors" style={{ minHeight: 56 }}>
                        {/* Resource label */}
                        <div className="w-52 flex-shrink-0 px-4 py-3 border-r border-gray-200 bg-white flex flex-col justify-center">
                          <p className="text-xs font-semibold text-gray-900 truncate">{resource.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {resource.licensePlate && (
                              <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1 rounded">{resource.licensePlate}</span>
                            )}
                            {resource.assignedDriver && (
                              <span className="text-[10px] text-gray-400 truncate">{resource.assignedDriver.name}</span>
                            )}
                          </div>
                        </div>

                        {/* Gantt area */}
                        <div className="flex-1 relative" style={{ minHeight: 56, ...(cellWidth ? { width: numDays * cellWidth } : {}) }}>
                          {/* Droppable day cells */}
                          <div className="absolute inset-0 flex">
                            {days.map((day, idx) => {
                              const isOver = dropTarget?.resourceId === resource.id && dropTarget?.dayIdx === idx;
                              const isToday = isSameDay(day, today);
                              return (
                                <div
                                  key={idx}
                                  className={`border-r last:border-r-0 border-gray-100 transition-colors ${
                                    isOver ? "bg-blue-100/50" : isToday ? "bg-blue-50/30" : ""
                                  }`}
                                  style={dayCellStyle()}
                                  onDragOver={(e) => handleDragOver(e, resource.id, idx)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, resource.id, day)}
                                />
                              );
                            })}
                          </div>

                          {/* Entry blocks */}
                          {resourceEntries.map((entry) => {
                            const style = getEntryStyle(entry);
                            if (!style) return null;
                            const isHighlighted = !selectedOrderId || selectedOrderId === entry.orderId;
                            const isDragging = draggingEntryId === entry.id;
                            const colorClass = orderColorMap[entry.orderId] ?? "bg-violet-500";
                            return (
                              <div
                                key={entry.id}
                                draggable
                                onDragStart={(e) => handleEntryDragStart(e, entry)}
                                onDragEnd={handleDragEnd}
                                className={`absolute top-2 rounded-md px-2.5 flex items-center gap-1.5 text-white text-[11px] font-medium group cursor-grab active:cursor-grabbing transition-opacity shadow-sm ${colorClass} ${
                                  isDragging ? "opacity-30" : isHighlighted ? "opacity-100" : "opacity-15"
                                }`}
                                style={{ left: style.left, width: style.width, height: 32, bottom: 8 }}
                                title={`${entry.order.title} — ${entry.order.contact.companyName}${entry.notes ? `\n${entry.notes}` : ""}`}
                                onClick={() => handleOpenEditModal(entry)}
                              >
                                <span className="truncate flex-1 leading-tight">
                                  {entry.order.title}
                                  {style.spanDays > 1 && <span className="opacity-60 ml-1">· {style.spanDays}T</span>}
                                </span>
                                <button
                                  className="opacity-0 group-hover:opacity-100 hover:text-red-200 transition-opacity flex-shrink-0 ml-0.5"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Add resource row */}
              <div className="flex border-b border-dashed border-gray-100">
                <div className="w-52 flex-shrink-0 px-4 py-3 border-r border-gray-200">
                  <button onClick={() => setShowAddResource(true)} className="text-xs text-gray-300 hover:text-gray-500 flex items-center gap-1 transition-colors">
                    <Plus className="h-3 w-3" />Ressource hinzufügen
                  </button>
                </div>
                <div className="flex-1" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal: Add Entry ───────────────────────────────────────────────── */}
      {showAddEntry && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Neuer Eintrag</h2>
              <button onClick={() => setShowAddEntry(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ressource *</label>
                <select className={INP} value={entryForm.resourceId} onChange={(e) => setEntryForm(d => ({ ...d, resourceId: e.target.value }))}>
                  <option value="">– Ressource wählen –</option>
                  {groupedResources.map(({ type, items }) => (
                    <optgroup key={type} label={TYPE_SECTION_LABEL[type] ?? type}>
                      {items.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Auftrag *</label>
                <select className={INP} value={entryForm.orderId} onChange={(e) => setEntryForm(d => ({ ...d, orderId: e.target.value }))}>
                  <option value="">– Auftrag wählen –</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.title} — {o.contact.companyName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Von</label>
                  <input type="date" className={INP} value={entryForm.startDate} onChange={(e) => setEntryForm(d => ({ ...d, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bis</label>
                  <input type="date" className={INP} value={entryForm.endDate} onChange={(e) => setEntryForm(d => ({ ...d, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
                <input type="text" className={INP} placeholder="Optional..." value={entryForm.notes} onChange={(e) => setEntryForm(d => ({ ...d, notes: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddEntry(false)}>Abbrechen</Button>
              <Button onClick={handleAddEntry} disabled={isSubmitting}>{isSubmitting ? "Wird erstellt..." : "Eintrag erstellen"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Resource ────────────────────────────────────────────── */}
      {showAddResource && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Neue Ressource</h2>
              <button onClick={() => setShowAddResource(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" className={INP} placeholder="z.B. Klaus Wagner" value={resourceForm.name} onChange={(e) => setResourceForm(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Typ</label>
                <select className={INP} value={resourceForm.type} onChange={(e) => setResourceForm(d => ({ ...d, type: e.target.value as typeof resourceForm.type }))}>
                  <option value="FAHRER">Fahrer</option>
                  <option value="FAHRZEUG">Fahrzeug</option>
                  <option value="MASCHINE">Maschine</option>
                  <option value="OTHER">Sonstiges</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
                <input type="text" className={INP} placeholder="Optional..." value={resourceForm.description} onChange={(e) => setResourceForm(d => ({ ...d, description: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddResource(false)}>Abbrechen</Button>
              <Button onClick={handleAddResource} disabled={isSubmitting}>{isSubmitting ? "Wird erstellt..." : "Ressource erstellen"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Entry ──────────────────────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Eintrag bearbeiten</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{editModal.order.title} → {editModal.resource.name}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start *</label>
                <input type="datetime-local" className={INP} value={editForm.startDate} onChange={(e) => setEditForm(d => ({ ...d, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ende *</label>
                <input type="datetime-local" className={INP} value={editForm.endDate} onChange={(e) => setEditForm(d => ({ ...d, endDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
                <input type="text" className={INP} placeholder="Optional..." value={editForm.notes} onChange={(e) => setEditForm(d => ({ ...d, notes: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <button className="text-xs text-red-400 hover:text-red-600" onClick={() => { setEditModal(null); handleDeleteEntry(editModal.id); }}>
                Eintrag löschen
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditModal(null)}>Abbrechen</Button>
                <Button onClick={handleEditModalSubmit} disabled={editSubmitting}>{editSubmitting ? "Speichert..." : "Speichern"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Drop – set time range ───────────────────────────────────── */}
      {dropModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Zeitraum festlegen</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {orders.find(o => o.id === dropModal.orderId)?.title} → {resources.find(r => r.id === dropModal.resourceId)?.name}
                </p>
              </div>
              <button onClick={() => setDropModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start *</label>
                <input type="datetime-local" className={INP} value={dropForm.startDate} onChange={(e) => setDropForm(d => ({ ...d, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ende *</label>
                <input type="datetime-local" className={INP} value={dropForm.endDate} onChange={(e) => setDropForm(d => ({ ...d, endDate: e.target.value }))} />
              </div>
              {dropConflict && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
                  <span className="text-amber-400 text-sm flex-shrink-0">⚠</span>
                  <p className="text-xs text-amber-700">
                    <strong>Terminkonflikt:</strong> Bereits belegt mit <strong>{dropConflict}</strong>. Trotzdem speichern möglich.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
                <input type="text" className={INP} placeholder="Optional..." value={dropForm.notes} onChange={(e) => setDropForm(d => ({ ...d, notes: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDropModal(null)}>Abbrechen</Button>
              <Button onClick={handleDropModalSubmit} disabled={dropSubmitting}>{dropSubmitting ? "Wird erstellt..." : "Eintrag erstellen"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
