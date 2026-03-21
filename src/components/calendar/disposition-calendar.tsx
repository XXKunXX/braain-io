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
  Plus, Trash2, Search, X, ArrowLeft, Send, AlertTriangle, Lock, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createDispositionEntry,
  updateDispositionEntry,
  deleteDispositionEntry,
  createResource,
  sendTagesplan,
} from "@/actions/disposition";

type ResourceItem = {
  id: string;
  name: string;
  type: string;
  licensePlate?: string | null;
  assignedDriver?: { id: string; name: string } | null;
};

type BaustelleItem = {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  city: string | null;
  orderId: string | null;
  contact: { id: string; companyName: string } | null;
  order: { id: string; orderNumber: string; title: string } | null;
};

type EntryWithRelations = {
  id: string;
  resourceId: string;
  baustelleId: string | null;
  orderId: string | null;
  startDate: Date;
  endDate: Date;
  notes: string | null;
  blockType: string | null;
  resource: { id: string; name: string; type: string };
  baustelle: {
    id: string;
    name: string;
    city: string | null;
    contact: { id: string; companyName: string } | null;
  } | null;
};

type ViewType = "tag" | "woche" | "monat" | "timeline" | "6wochen";
type TypeFilter = "ALL" | "FAHRER" | "FAHRZEUG" | "MASCHINE";

// Hourly view constants (tag view)
const HOUR_START = 6;
const HOUR_END = 20;
const HOUR_WIDTH = 64; // px per hour column

const BLOCK_TYPE_LABEL: Record<string, string> = {
  URLAUB: "Urlaub", SERVICE: "Service", KRANK: "Krank",
};
const BLOCK_TYPE_COLOR: Record<string, string> = {
  URLAUB: "bg-gray-400", SERVICE: "bg-orange-400", KRANK: "bg-red-400",
};

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TYPE_LABEL: Record<string, string> = {
  FAHRER: "Fahrer", MASCHINE: "Maschine", FAHRZEUG: "Fahrzeug", OTHER: "Sonstiges",
};
const TYPE_ROW_COLOR: Record<string, string> = {
  FAHRER: "bg-blue-50", MASCHINE: "bg-orange-50", FAHRZEUG: "bg-emerald-50", OTHER: "bg-gray-50",
};
const TYPE_SECTION_LABEL: Record<string, string> = {
  FAHRER: "Fahrer & Mitarbeiter", MASCHINE: "Maschinen", FAHRZEUG: "Fahrzeuge", OTHER: "Sonstiges",
};

const BAUSTELLE_STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-green-500", PLANNED: "bg-blue-400", COMPLETED: "bg-gray-300",
};

const ENTRY_PALETTE = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500",   "bg-cyan-500", "bg-indigo-500",  "bg-pink-500",
];

const CELL_WIDTH: Record<ViewType, number | undefined> = {
  tag: HOUR_WIDTH, woche: undefined, monat: 52, timeline: 80, "6wochen": 36,
};

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "ALL",      label: "Alle" },
  { key: "FAHRER",   label: "Fahrer" },
  { key: "FAHRZEUG", label: "Fahrzeuge" },
  { key: "MASCHINE", label: "Maschinen" },
];

const TYPE_ORDER = ["FAHRER", "FAHRZEUG", "MASCHINE", "OTHER"];

interface Props {
  resources: ResourceItem[];
  baustellen: BaustelleItem[];
  entries: EntryWithRelations[];
  rangeStartISO: string;
  initialView: ViewType;
  baustelleId?: string;
  baustelleName?: string;
}

export function DispositionCalendar({
  resources,
  baustellen,
  entries,
  rangeStartISO,
  initialView,
  baustelleId,
  baustelleName,
}: Props) {
  const router = useRouter();
  const today = new Date();
  const rangeStart = parseISO(rangeStartISO);

  const [view, setView] = useState<ViewType>(initialView);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [selectedBaustelleId, setSelectedBaustelleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drag state
  const dragBaustelleId = useRef<string | null>(null);
  const dragEntry = useRef<EntryWithRelations | null>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ resourceId: string; dayIdx: number } | null>(null);

  // Drop modal (assign baustelle to resource)
  const [dropModal, setDropModal] = useState<{ resourceId: string; baustelleId: string } | null>(null);
  const [dropForm, setDropForm] = useState({ startDate: "", endDate: "", notes: "" });
  const [dropSubmitting, setDropSubmitting] = useState(false);
  const [dropWithStammfahrer, setDropWithStammfahrer] = useState(true);

  // Verfügbarkeit / Sperren modal
  const [sperrModal, setSperrModal] = useState<{ resourceId: string } | null>(null);
  const [sperrForm, setSperrForm] = useState({ blockType: "URLAUB" as "URLAUB" | "SERVICE" | "KRANK", startDate: "", endDate: "", notes: "" });
  const [sperrSubmitting, setSperrSubmitting] = useState(false);

  // Tagesplan senden
  const [sendingTagesplan, setSendingTagesplan] = useState(false);

  // Edit entry modal
  const [editModal, setEditModal] = useState<EntryWithRelations | null>(null);
  const [editForm, setEditForm] = useState({ startDate: "", endDate: "", notes: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Local entries for optimistic updates
  const [localEntries, setLocalEntries] = useState<EntryWithRelations[]>(entries);
  useEffect(() => { setLocalEntries(entries); }, [entries]);

  // Resize handles for hourly view
  type ResizeState = { entryId: string; side: "left" | "right"; startX: number; origStartMs: number; origEndMs: number };
  const resizingRef = useRef<ResizeState | null>(null);
  const resizePreviewRef = useRef<{ id: string; startMs: number; endMs: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<{ id: string; startMs: number; endMs: number } | null>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return;
      const { entryId, side, startX, origStartMs, origEndMs } = resizingRef.current;
      const dx = e.clientX - startX;
      // Snap to 15 min increments
      const minutesDelta = Math.round((dx / HOUR_WIDTH) * 4) * 15;
      const msDelta = minutesDelta * 60_000;
      const dayStart = new Date(rangeStart); dayStart.setHours(HOUR_START, 0, 0, 0);
      const dayEnd = new Date(rangeStart); dayEnd.setHours(HOUR_END, 0, 0, 0);
      let startMs = origStartMs;
      let endMs = origEndMs;
      if (side === "left") {
        startMs = Math.max(dayStart.getTime(), Math.min(origStartMs + msDelta, origEndMs - 15 * 60_000));
      } else {
        endMs = Math.max(origStartMs + 15 * 60_000, Math.min(origEndMs + msDelta, dayEnd.getTime()));
      }
      const preview = { id: entryId, startMs, endMs };
      resizePreviewRef.current = preview;
      setResizePreview(preview);
    }

    async function onMouseUp() {
      const state = resizingRef.current;
      const preview = resizePreviewRef.current;
      resizingRef.current = null;
      resizePreviewRef.current = null;
      setResizePreview(null);
      if (!state || !preview) return;
      const newStart = new Date(preview.startMs);
      const newEnd = new Date(preview.endMs);
      const snapshot = localEntries;
      setLocalEntries(prev => prev.map(e =>
        e.id === state.entryId ? { ...e, startDate: newStart, endDate: newEnd } : e
      ));
      const result = await updateDispositionEntry(state.entryId, {
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
      });
      if ("error" in result && result.error) { setLocalEntries(snapshot); toast.error("Fehler beim Speichern"); }
      else router.refresh();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigate("prev"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); navigate("next"); }
      else if (e.key.toLowerCase() === "t") navigate("today");
      else if (e.key.toLowerCase() === "d") switchView("tag");
      else if (e.key.toLowerCase() === "w") switchView("woche");
      else if (e.key.toLowerCase() === "m") switchView("monat");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, rangeStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collapsed sections
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [plannedCollapsed, setPlannedCollapsed] = useState(true);

  const [entryForm, setEntryForm] = useState({
    resourceId: "", baustelleId: baustelleId ?? "",
    startDate: format(rangeStart, "yyyy-MM-dd'T'07:00"),
    endDate: format(rangeStart, "yyyy-MM-dd'T'17:00"),
    notes: "",
    allDay: false,
  });
  const [resourceForm, setResourceForm] = useState({
    name: "", type: "FAHRER" as "FAHRER" | "MASCHINE" | "FAHRZEUG" | "OTHER", description: "",
  });

  // Days array – for "tag" view we use hours as columns instead (see hourly render below)
  const days = useMemo(() => {
    switch (view) {
      case "tag": return [rangeStart]; // single day; header uses hours
      case "woche": return Array.from({ length: 6 }, (_, i) => addDays(rangeStart, i));
      case "monat": {
        const ms = startOfMonth(rangeStart);
        const count = differenceInCalendarDays(new Date(ms.getFullYear(), ms.getMonth() + 1, 0), ms) + 1;
        return Array.from({ length: count }, (_, i) => addDays(ms, i));
      }
      case "timeline": return Array.from({ length: 14 }, (_, i) => addDays(rangeStart, i));
      case "6wochen": return Array.from({ length: 42 }, (_, i) => addDays(rangeStart, i));
    }
  }, [view, rangeStart]);

  // Hours array for "tag" (hourly) view
  const hours = useMemo(() =>
    Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
  []);

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
    return TYPE_ORDER.filter(t => map[t]?.length).map(t => ({ type: t, items: map[t] }));
  }, [visibleResources]);

  // URL builder
  function dispoUrl(week: string, v: ViewType) {
    const p = new URLSearchParams({ week, view: v });
    if (baustelleId) p.set("baustelleId", baustelleId);
    if (baustelleName) p.set("baustelleName", baustelleName);
    return `/disposition?${p.toString()}`;
  }

  function navigate(direction: "prev" | "next" | "today") {
    let target: Date;
    if (direction === "today") { target = today; }
    else {
      const d = direction === "prev" ? -1 : 1;
      if (view === "tag") target = addDays(rangeStart, d);
      else if (view === "monat") target = d < 0 ? subMonths(rangeStart, 1) : addMonths(rangeStart, 1);
      else if (view === "timeline") target = d < 0 ? subWeeks(rangeStart, 2) : addWeeks(rangeStart, 2);
      else if (view === "6wochen") target = d < 0 ? addDays(rangeStart, -42) : addDays(rangeStart, 42);
      else target = d < 0 ? subWeeks(rangeStart, 1) : addWeeks(rangeStart, 1);
    }
    router.push(dispoUrl(format(target, "yyyy-MM-dd"), view));
  }

  function switchView(v: ViewType) {
    setView(v);
    router.push(dispoUrl(format(today, "yyyy-MM-dd"), v));
  }

  const rangeLabel = useMemo(() => {
    if (view === "tag") return format(rangeStart, "EEEE, dd. MMMM yyyy", { locale: de });
    if (view === "monat") return format(rangeStart, "MMMM yyyy", { locale: de });
    if (view === "timeline") {
      const end = addDays(rangeStart, 13);
      return `${format(rangeStart, "dd.MM.", { locale: de })} – ${format(end, "dd.MM.yyyy", { locale: de })}`;
    }
    if (view === "6wochen") {
      const end = addDays(rangeStart, 41);
      return `${format(rangeStart, "dd.MM.", { locale: de })} – ${format(end, "dd.MM.yyyy", { locale: de })} (6 Wochen)`;
    }
    return `KW ${format(rangeStart, "w", { locale: de })} · ${format(rangeStart, "dd.MM.", { locale: de })} – ${format(addDays(rangeStart, 5), "dd.MM.yyyy", { locale: de })}`;
  }, [view, rangeStart]);

  // Baustellen panel
  const filteredBaustellen = useMemo(() => {
    const q = search.toLowerCase();
    return baustellen.filter(b =>
      !q ||
      b.name.toLowerCase().includes(q) ||
      (b.contact?.companyName ?? "").toLowerCase().includes(q) ||
      (b.city ?? "").toLowerCase().includes(q)
    );
  }, [baustellen, search]);
  const activeBaustellen = filteredBaustellen.filter(b => b.status === "ACTIVE");
  const plannedBaustellen = filteredBaustellen.filter(b => b.status === "PLANNED");

  const baustelleColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    baustellen.forEach((b, i) => { map[b.id] = ENTRY_PALETTE[i % ENTRY_PALETTE.length]; });
    return map;
  }, [baustellen]);

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

  // Drag & drop
  function handleDragStart(e: React.DragEvent, bId: string) {
    dragBaustelleId.current = bId;
    dragEntry.current = null;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("type", "baustelle");
  }
  function handleEntryDragStart(e: React.DragEvent, entry: EntryWithRelations) {
    e.stopPropagation();
    dragEntry.current = entry;
    dragBaustelleId.current = null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "entry");
    setDraggingEntryId(entry.id);
  }
  function handleDragEnd() { setDraggingEntryId(null); }
  function handleDragOver(e: React.DragEvent, resourceId: string, dayIdx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragEntry.current ? "move" : "copy";
    setDropTarget({ resourceId, dayIdx });
  }
  function handleDragLeave() { setDropTarget(null); }

  async function handleDrop(e: React.DragEvent, resourceId: string, day: Date) {
    e.preventDefault();
    setDropTarget(null);

    // Move existing entry
    if (dragEntry.current) {
      const entry = dragEntry.current;
      dragEntry.current = null;
      setDraggingEntryId(null);
      const dayOffset = differenceInCalendarDays(startOfDay(day), startOfDay(new Date(entry.startDate)));
      if (dayOffset === 0 && resourceId === entry.resourceId) return;
      const newStart = addDays(new Date(entry.startDate), dayOffset);
      const newEnd = addDays(new Date(entry.endDate), dayOffset);
      const newResourceId = resourceId !== entry.resourceId ? resourceId : entry.resourceId;
      const snapshot = localEntries;
      setLocalEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, startDate: newStart, endDate: newEnd, resourceId: newResourceId } : e
      ));
      const result = await updateDispositionEntry(entry.id, {
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
        notes: entry.notes ?? undefined,
        resourceId: resourceId !== entry.resourceId ? resourceId : undefined,
      });
      if ("error" in result && result.error) { setLocalEntries(snapshot); toast.error("Fehler beim Verschieben"); return; }

      // Update paired Stammfahrer entry if vehicle changed
      if (resourceId !== entry.resourceId) {
        const oldResource = resources.find(r => r.id === entry.resourceId);
        const newResource = resources.find(r => r.id === resourceId);
        const oldDriverId = oldResource?.assignedDriver?.id;
        const newDriverId = newResource?.assignedDriver?.id;
        if (oldDriverId && newDriverId && oldDriverId !== newDriverId) {
          const pairedEntry = localEntries.find(e =>
            e.id !== entry.id &&
            e.resourceId === oldDriverId &&
            (entry.baustelleId ? e.baustelleId === entry.baustelleId : e.orderId === entry.orderId)
          );
          if (pairedEntry) {
            setLocalEntries(prev => prev.map(e =>
              e.id === pairedEntry.id ? { ...e, startDate: newStart, endDate: newEnd, resourceId: newDriverId } : e
            ));
            await updateDispositionEntry(pairedEntry.id, {
              startDate: newStart.toISOString(),
              endDate: newEnd.toISOString(),
              notes: pairedEntry.notes ?? undefined,
              resourceId: newDriverId,
            });
          }
        }
      }

      router.refresh();
      return;
    }

    // Assign baustelle from panel
    const bId = dragBaustelleId.current;
    if (!bId) return;
    const dateStr = format(day, "yyyy-MM-dd");
    setDropForm({ startDate: `${dateStr}T07:00`, endDate: `${dateStr}T17:00`, notes: "" });
    setDropWithStammfahrer(true);
    setDropModal({ resourceId, baustelleId: bId });
  }

  async function handleDropModalSubmit() {
    if (!dropModal) return;
    if (!dropForm.startDate || !dropForm.endDate) { toast.error("Start und Ende sind erforderlich"); return; }
    if (new Date(dropForm.endDate) <= new Date(dropForm.startDate)) { toast.error("Ende muss nach dem Start liegen"); return; }
    setDropSubmitting(true);
    const result = await createDispositionEntry({
      resourceId: dropModal.resourceId,
      baustelleId: dropModal.baustelleId,
      startDate: dropForm.startDate,
      endDate: dropForm.endDate,
      notes: dropForm.notes,
    });
    // Stammfahrer auto-create
    const dropResource = resources.find(r => r.id === dropModal.resourceId);
    if (dropWithStammfahrer && dropResource?.assignedDriver) {
      await createDispositionEntry({
        resourceId: dropResource.assignedDriver.id,
        baustelleId: dropModal.baustelleId,
        startDate: dropForm.startDate,
        endDate: dropForm.endDate,
        notes: dropForm.notes || undefined,
      });
    }
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
    if (!entryForm.resourceId || !entryForm.baustelleId) { toast.error("Ressource und Baustelle sind erforderlich"); return; }
    setIsSubmitting(true);
    const dateBase = entryForm.startDate.slice(0, 10);
    const startDate = entryForm.allDay ? `${dateBase}T00:00` : entryForm.startDate;
    const endDateBase = entryForm.endDate.slice(0, 10);
    const endDate = entryForm.allDay ? `${endDateBase}T23:59` : entryForm.endDate;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { allDay, ...formData } = entryForm;
    const result = await createDispositionEntry({ ...formData, startDate, endDate });
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

  // Hourly entry positioning (for "tag" view)
  function getHourStyle(startDate: Date, endDate: Date) {
    const dayStart = new Date(rangeStart); dayStart.setHours(HOUR_START, 0, 0, 0);
    const dayEnd = new Date(rangeStart); dayEnd.setHours(HOUR_END, 0, 0, 0);
    if (endDate <= dayStart || startDate >= dayEnd) return null;
    const cs = startDate < dayStart ? dayStart : startDate;
    const ce = endDate > dayEnd ? dayEnd : endDate;
    const leftHours = (cs.getTime() - dayStart.getTime()) / 3_600_000;
    const durationHours = (ce.getTime() - cs.getTime()) / 3_600_000;
    return { left: leftHours * HOUR_WIDTH + 2, width: Math.max(durationHours * HOUR_WIDTH - 4, 20) };
  }

  function getEntryHourStyle(entry: EntryWithRelations) {
    const isResizing = resizePreview?.id === entry.id;
    const start = isResizing ? new Date(resizePreview!.startMs) : new Date(entry.startDate);
    const end = isResizing ? new Date(resizePreview!.endMs) : new Date(entry.endDate);
    return getHourStyle(start, end);
  }

  // Conflict detection: does a resource have overlapping entries?
  function getConflicts(resourceId: string, startStr: string, endStr: string, excludeId?: string) {
    if (!startStr || !endStr) return [];
    const s = new Date(startStr);
    const e = new Date(endStr);
    return localEntries.filter(en =>
      en.resourceId === resourceId &&
      en.id !== excludeId &&
      new Date(en.startDate) < e &&
      new Date(en.endDate) > s
    );
  }

  async function handleSendTagesplan() {
    setSendingTagesplan(true);
    const result = await sendTagesplan(rangeStart.toISOString());
    setSendingTagesplan(false);
    if ("sent" in result) {
      if (result.sent === 0) toast.info("Keine Fahrer mit App-Zugang für heute gefunden");
      else toast.success(`Tagesplan an ${result.sent} Fahrer gesendet`);
    } else {
      toast.error("Fehler beim Senden");
    }
  }

  async function handleSperrSubmit() {
    if (!sperrModal) return;
    if (!sperrForm.startDate || !sperrForm.endDate) { toast.error("Start und Ende sind erforderlich"); return; }
    if (new Date(sperrForm.endDate) <= new Date(sperrForm.startDate)) { toast.error("Ende muss nach dem Start liegen"); return; }
    setSperrSubmitting(true);
    const result = await createDispositionEntry({
      resourceId: sperrModal.resourceId,
      startDate: sperrForm.startDate,
      endDate: sperrForm.endDate,
      notes: sperrForm.notes || undefined,
      blockType: sperrForm.blockType,
    });
    setSperrSubmitting(false);
    if ("error" in result && result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success(`${BLOCK_TYPE_LABEL[sperrForm.blockType]} eingetragen`);
    setSperrModal(null);
    router.refresh();
  }

  async function handleDuplicateEntry() {
    if (!editModal) return;
    const newStart = addDays(new Date(editModal.startDate), 1);
    const newEnd = addDays(new Date(editModal.endDate), 1);
    const result = await createDispositionEntry({
      resourceId: editModal.resourceId,
      baustelleId: editModal.baustelleId ?? undefined,
      startDate: newStart.toISOString(),
      endDate: newEnd.toISOString(),
      notes: editModal.notes ?? undefined,
      blockType: (editModal.blockType as "URLAUB" | "SERVICE" | "KRANK" | undefined) ?? undefined,
    });
    if ("error" in result && result.error) { toast.error("Fehler beim Duplizieren"); return; }
    toast.success("Eintrag auf nächsten Tag kopiert");
    setEditModal(null);
    router.refresh();
  }

  function handlePrintTagesplan() {
    const dateStr = format(rangeStart, "EEEE, d. MMMM yyyy", { locale: de });
    const rows = visibleResources.flatMap(r => {
      const rEntries = localEntries
        .filter(e => e.resourceId === r.id && isSameDay(new Date(e.startDate), rangeStart))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      return rEntries.map(e => ({
        resource: r.name,
        baustelle: e.blockType ? (BLOCK_TYPE_LABEL[e.blockType] ?? e.blockType) : (e.baustelle?.name ?? "–"),
        von: format(new Date(e.startDate), "HH:mm"),
        bis: format(new Date(e.endDate), "HH:mm"),
        notes: e.notes ?? "",
      }));
    });
    const tableRows = rows.map(r => `<tr><td>${r.resource}</td><td>${r.baustelle}</td><td>${r.von}</td><td>${r.bis}</td><td>${r.notes}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Tagesplan ${dateStr}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#333;font-size:13px}h1{font-size:18px;margin:0 0 4px}
    .sub{color:#666;font-size:12px;margin-bottom:20px}table{width:100%;border-collapse:collapse}
    th{background:#f5f5f5;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e5e5e5}
    td{padding:8px 10px;border-bottom:1px solid #eee}tr:last-child td{border-bottom:none}
    @media print{body{padding:0}}</style></head>
    <body><h1>Tagesplan</h1><div class="sub">${dateStr}</div>
    <table><thead><tr><th>Ressource</th><th>Baustelle</th><th>Von</th><th>Bis</th><th>Notizen</th></tr></thead>
    <tbody>${tableRows || "<tr><td colspan='5' style='color:#999;text-align:center;padding:20px'>Keine Einträge</td></tr>"}</tbody></table>
    <script>window.onload=()=>window.print();</script></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  function getUtilization(resourceId: string): number {
    const resourceEnts = localEntries.filter(e => e.resourceId === resourceId && !e.blockType);
    if (view === "tag") {
      const dayStart = new Date(rangeStart); dayStart.setHours(HOUR_START, 0, 0, 0);
      const dayEnd = new Date(rangeStart); dayEnd.setHours(HOUR_END, 0, 0, 0);
      const totalMs = (HOUR_END - HOUR_START) * 3_600_000;
      const plannedMs = resourceEnts.reduce((sum, e) => {
        const s = Math.max(new Date(e.startDate).getTime(), dayStart.getTime());
        const en = Math.min(new Date(e.endDate).getTime(), dayEnd.getTime());
        return sum + Math.max(0, en - s);
      }, 0);
      return Math.min(1, plannedMs / totalMs);
    }
    const coveredDays = days.filter(day =>
      resourceEnts.some(e => isSameDay(new Date(e.startDate), day))
    ).length;
    return numDays > 0 ? Math.min(1, coveredDays / numDays) : 0;
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
          {view === "tag" && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleSendTagesplan} disabled={sendingTagesplan}>
              <Send className="h-3.5 w-3.5" />{sendingTagesplan ? "Sendet..." : "Tagesplan senden"}
            </Button>
          )}
          {view === "tag" && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handlePrintTagesplan}>
              <Printer className="h-3.5 w-3.5" />Drucken
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => {
            const dateStr = format(rangeStart, "yyyy-MM-dd");
            setSperrForm({ blockType: "URLAUB", startDate: `${dateStr}T00:00`, endDate: `${dateStr}T23:59`, notes: "" });
            setSperrModal({ resourceId: "" });
          }}>
            <Lock className="h-3.5 w-3.5" />Sperren
          </Button>
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
          </div>
          <a href={`/baustellen/${baustelleId}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
            <ArrowLeft className="h-3.5 w-3.5" />Zurück zur Baustelle
          </a>
        </div>
      )}

      {/* ── View tabs + type filter + range label ──────────────────────────── */}
      <div className="px-6 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {(["tag", "woche", "monat", "timeline", "6wochen"] as ViewType[]).map((v) => (
            <button key={v} onClick={() => switchView(v)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                view === v ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              {v === "tag" ? "Tag" : v === "woche" ? "Woche" : v === "monat" ? "Monat" : v === "timeline" ? "Timeline" : "6 Wochen"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setTypeFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                typeFilter === key ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs font-medium text-gray-500 capitalize whitespace-nowrap">{rangeLabel}</span>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel: baustellen */}
        <div className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="px-4 pt-3 pb-2 border-b border-gray-100">
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">Baustellen</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
              <input type="text" placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 h-7 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-300" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {baustellen.length > 0 && (
              <p className="px-4 py-1.5 text-[10px] text-gray-300 bg-gray-50/60 border-b border-gray-100">
                In Kalender ziehen zum Zuweisen
              </p>
            )}

            {activeBaustellen.length > 0 && (
              <div>
                <button onClick={() => setActiveCollapsed(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-gray-50 transition-colors border-b border-gray-100">
                  <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Aktiv ({activeBaustellen.length})</span>
                  {activeCollapsed ? <ChevronRightIcon className="h-3 w-3 text-gray-300" /> : <ChevronDown className="h-3 w-3 text-gray-300" />}
                </button>
                {!activeCollapsed && activeBaustellen.map((b) => (
                  <div key={b.id} draggable
                    onDragStart={(e) => handleDragStart(e, b.id)}
                    onClick={() => setSelectedBaustelleId(selectedBaustelleId === b.id ? null : b.id)}
                    className={`px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-2.5 cursor-grab active:cursor-grabbing select-none ${
                      selectedBaustelleId === b.id ? "bg-blue-50 border-l-2 border-l-blue-400" : ""
                    }`}>
                    <div className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${BAUSTELLE_STATUS_DOT[b.status]}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{b.name}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {b.contact?.companyName ?? b.city ?? "–"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {plannedBaustellen.length > 0 && (
              <div>
                <button onClick={() => setPlannedCollapsed(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-gray-50 transition-colors border-b border-gray-100">
                  <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Geplant ({plannedBaustellen.length})</span>
                  {plannedCollapsed ? <ChevronRightIcon className="h-3 w-3 text-gray-300" /> : <ChevronDown className="h-3 w-3 text-gray-300" />}
                </button>
                {!plannedCollapsed && plannedBaustellen.map((b) => (
                  <div key={b.id} draggable
                    onDragStart={(e) => handleDragStart(e, b.id)}
                    onClick={() => setSelectedBaustelleId(selectedBaustelleId === b.id ? null : b.id)}
                    className={`px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-2.5 cursor-grab active:cursor-grabbing select-none ${
                      selectedBaustelleId === b.id ? "bg-blue-50 border-l-2 border-l-blue-400" : ""
                    }`}>
                    <div className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${BAUSTELLE_STATUS_DOT[b.status]}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{b.name}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {b.contact?.companyName ?? b.city ?? "–"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredBaustellen.length === 0 && (
              <div className="p-6 text-center text-xs text-gray-300">Keine Baustellen</div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-auto">
          {view === "tag" ? (
            /* ══ STUNDEN-ANSICHT (hourly) ══════════════════════════════════════ */
            <>
              {/* Hour header */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm flex">
                <div className="w-52 flex-shrink-0 px-4 py-2.5 border-r border-gray-200 bg-gray-50/80 flex items-center">
                  <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Ressource</span>
                </div>
                <div className="flex flex-shrink-0">
                  {hours.map((h) => (
                    <div key={h} className="border-r border-gray-100 text-center py-2 flex-shrink-0" style={{ width: HOUR_WIDTH }}>
                      <p className="text-xs font-bold text-gray-500">{h}:00</p>
                    </div>
                  ))}
                </div>
              </div>

              {visibleResources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <p className="text-sm text-gray-400 mb-3">Noch keine Ressourcen angelegt</p>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddResource(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Ressource hinzufügen
                  </Button>
                </div>
              ) : (
                <>
                  {groupedResources.map(({ type, items }) => (
                    <div key={type}>
                      <div className="flex border-b border-gray-100">
                        <div className={`w-52 flex-shrink-0 px-4 py-1.5 border-r border-gray-200 ${TYPE_ROW_COLOR[type] ?? "bg-gray-50"}`}>
                          <span className={`text-[10px] font-bold tracking-widest uppercase ${
                            type === "FAHRER" ? "text-blue-500" : type === "MASCHINE" ? "text-orange-500" :
                            type === "FAHRZEUG" ? "text-emerald-500" : "text-gray-400"
                          }`}>{TYPE_SECTION_LABEL[type] ?? type}</span>
                        </div>
                        <div className={`flex-shrink-0 ${TYPE_ROW_COLOR[type] ?? "bg-gray-50"}`} style={{ width: hours.length * HOUR_WIDTH }} />
                      </div>

                      {items.map((resource) => {
                        const resourceEntries = localEntries.filter(e => e.resourceId === resource.id);
                        return (
                          <div key={resource.id} className="flex border-b border-gray-100 hover:bg-gray-50/50 transition-colors" style={{ minHeight: 56 }}>
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
                              {(() => {
                                const util = getUtilization(resource.id);
                                if (util === 0) return null;
                                return (
                                  <div className="w-full bg-gray-100 rounded-full h-1 mt-1.5">
                                    <div className={`h-1 rounded-full transition-all ${util >= 0.8 ? "bg-green-400" : util >= 0.4 ? "bg-amber-400" : "bg-blue-300"}`}
                                      style={{ width: `${util * 100}%` }} />
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="relative flex-shrink-0" style={{ width: hours.length * HOUR_WIDTH, minHeight: 56 }}>
                              <div className="absolute inset-0 flex">
                                {hours.map((h, idx) => {
                                  const isOver = dropTarget?.resourceId === resource.id && dropTarget?.dayIdx === idx;
                                  return (
                                    <div key={h}
                                      className={`border-r border-gray-100 flex-shrink-0 transition-colors ${isOver ? "bg-blue-100/50" : ""}`}
                                      style={{ width: HOUR_WIDTH }}
                                      onDragOver={(e) => handleDragOver(e, resource.id, idx)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        setDropTarget(null);
                                        if (dragEntry.current) {
                                          // Time-aware move: shift entry to dropped hour, preserve duration
                                          const entry = dragEntry.current;
                                          dragEntry.current = null;
                                          setDraggingEntryId(null);
                                          const origStart = new Date(entry.startDate);
                                          const origEnd = new Date(entry.endDate);
                                          const durationMs = origEnd.getTime() - origStart.getTime();
                                          const newStart = new Date(rangeStart);
                                          newStart.setHours(h, 0, 0, 0);
                                          const newEnd = new Date(newStart.getTime() + durationMs);
                                          if (newStart.getTime() === origStart.getTime() && resource.id === entry.resourceId) return;
                                          const snapshot = localEntries;
                                          setLocalEntries(prev => prev.map(en =>
                                            en.id === entry.id ? { ...en, startDate: newStart, endDate: newEnd, resourceId: resource.id } : en
                                          ));
                                          updateDispositionEntry(entry.id, {
                                            startDate: newStart.toISOString(),
                                            endDate: newEnd.toISOString(),
                                            notes: entry.notes ?? undefined,
                                            resourceId: resource.id !== entry.resourceId ? resource.id : undefined,
                                          }).then(result => {
                                            if ("error" in result && result.error) { setLocalEntries(snapshot); toast.error("Fehler beim Verschieben"); }
                                            else router.refresh();
                                          });
                                          return;
                                        }
                                        const bId = dragBaustelleId.current;
                                        if (!bId) return;
                                        const dateStr = format(rangeStart, "yyyy-MM-dd");
                                        const startH = String(h).padStart(2, "0");
                                        const endH = String(Math.min(h + 8, HOUR_END)).padStart(2, "0");
                                        setDropForm({ startDate: `${dateStr}T${startH}:00`, endDate: `${dateStr}T${endH}:00`, notes: "" });
                                        setDropWithStammfahrer(true);
                                        setDropModal({ resourceId: resource.id, baustelleId: bId });
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              {resourceEntries.map((entry) => {
                                const isResizingThis = resizePreview?.id === entry.id;
                                const style = getEntryHourStyle(entry);
                                if (!style) return null;
                                const isDragging = draggingEntryId === entry.id;
                                const colorClass = entry.blockType
                                  ? (BLOCK_TYPE_COLOR[entry.blockType] ?? "bg-gray-400")
                                  : (entry.baustelleId ? (baustelleColorMap[entry.baustelleId] ?? "bg-violet-500") : "bg-gray-400");
                                const label = entry.blockType
                                  ? (BLOCK_TYPE_LABEL[entry.blockType] ?? entry.blockType)
                                  : (entry.baustelle?.name ?? "Eintrag");
                                const effStart = isResizingThis ? new Date(resizePreview!.startMs) : new Date(entry.startDate);
                                const effEnd = isResizingThis ? new Date(resizePreview!.endMs) : new Date(entry.endDate);
                                const timeLabel = `${format(effStart, "HH:mm")}–${format(effEnd, "HH:mm")}`;
                                const hasConflict = !entry.blockType && localEntries.some(other =>
                                  other.id !== entry.id &&
                                  other.resourceId === entry.resourceId &&
                                  !other.blockType &&
                                  new Date(other.startDate) < new Date(entry.endDate) &&
                                  new Date(other.endDate) > new Date(entry.startDate)
                                );
                                return (
                                  <div key={entry.id} draggable={!entry.blockType && !isResizingThis}
                                    onDragStart={(e) => { if (entry.blockType || isResizingThis) { e.preventDefault(); return; } handleEntryDragStart(e, entry); }}
                                    onDragEnd={handleDragEnd}
                                    className={`absolute top-2 rounded-md flex items-center text-white text-[11px] font-medium group shadow-sm select-none ${colorClass} ${isDragging ? "opacity-30" : "opacity-100"} ${isResizingThis ? "ring-2 ring-white/60" : ""}`}
                                    style={{ left: style.left, width: style.width, height: 32, bottom: 8, cursor: isResizingThis ? "ew-resize" : "grab" }}
                                    title={`${label}\n${timeLabel}${entry.baustelle?.city ? ` · ${entry.baustelle.city}` : ""}${entry.notes ? `\n${entry.notes}` : ""}`}
                                    onDoubleClick={() => !isResizingThis && handleOpenEditModal(entry)}>

                                    {/* Left resize handle */}
                                    {!entry.blockType && (
                                      <div className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center hover:bg-white/20 rounded-l-md z-10 flex-shrink-0"
                                        onMouseDown={(e) => {
                                          e.stopPropagation(); e.preventDefault();
                                          resizingRef.current = { entryId: entry.id, side: "left", startX: e.clientX, origStartMs: new Date(entry.startDate).getTime(), origEndMs: new Date(entry.endDate).getTime() };
                                          setResizePreview({ id: entry.id, startMs: new Date(entry.startDate).getTime(), endMs: new Date(entry.endDate).getTime() });
                                          resizePreviewRef.current = { id: entry.id, startMs: new Date(entry.startDate).getTime(), endMs: new Date(entry.endDate).getTime() };
                                        }}
                                        onDragStart={(e) => e.preventDefault()}>
                                        <div className="w-0.5 h-3 bg-white/50 rounded-full" />
                                      </div>
                                    )}

                                    {/* Label + time + delete */}
                                    <div className="flex items-center gap-1.5 px-2.5 flex-1 min-w-0" style={{ paddingLeft: !entry.blockType ? "14px" : undefined, paddingRight: !entry.blockType ? "14px" : undefined }}>
                                      <span className="truncate leading-tight flex-1">{label}</span>
                                      {isResizingThis && (
                                        <span className="text-[10px] opacity-80 whitespace-nowrap font-normal">{timeLabel}</span>
                                      )}
                                      {hasConflict && <AlertTriangle className="h-3 w-3 text-yellow-200 flex-shrink-0 opacity-90" />}
                                      <button className="opacity-0 group-hover:opacity-100 hover:text-red-200 transition-opacity flex-shrink-0"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}>
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>

                                    {/* Right resize handle */}
                                    {!entry.blockType && (
                                      <div className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center hover:bg-white/20 rounded-r-md z-10 flex-shrink-0"
                                        onMouseDown={(e) => {
                                          e.stopPropagation(); e.preventDefault();
                                          resizingRef.current = { entryId: entry.id, side: "right", startX: e.clientX, origStartMs: new Date(entry.startDate).getTime(), origEndMs: new Date(entry.endDate).getTime() };
                                          setResizePreview({ id: entry.id, startMs: new Date(entry.startDate).getTime(), endMs: new Date(entry.endDate).getTime() });
                                          resizePreviewRef.current = { id: entry.id, startMs: new Date(entry.startDate).getTime(), endMs: new Date(entry.endDate).getTime() };
                                        }}
                                        onDragStart={(e) => e.preventDefault()}>
                                        <div className="w-0.5 h-3 bg-white/50 rounded-full" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
            </>
          ) : (
            /* ══ GANTT VIEW (woche / monat / timeline / 6wochen) ══════════════ */
            <>
              {/* Sticky day-header */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
                {/* KW row – only for timeline and 6wochen */}
                {(view === "timeline" || view === "6wochen") && (() => {
                  const weekStarts: { idx: number; day: Date }[] = [];
                  days.forEach((d, i) => { if (i === 0 || d.getDay() === 1) weekStarts.push({ idx: i, day: d }); });
                  return (
                    <div className="flex border-b border-gray-100">
                      <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-gray-50/60" />
                      <div className="flex" style={cellWidth ? { width: numDays * cellWidth } : { flex: 1 }}>
                        {weekStarts.map(({ idx, day: wDay }, wi) => {
                          const span = (weekStarts[wi + 1]?.idx ?? days.length) - idx;
                          return (
                            <div key={idx} className="text-center py-0.5 border-r border-gray-100 bg-gray-50/60"
                              style={cellWidth ? { width: span * cellWidth, flexShrink: 0 } : { flex: span }}>
                              <span className="text-[9px] font-semibold text-gray-400 tracking-wider">KW {format(wDay, "w", { locale: de })}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div className="flex">
                  <div className="w-52 flex-shrink-0 px-4 py-2.5 border-r border-gray-200 bg-gray-50/80 flex items-center">
                    <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Ressource</span>
                  </div>
                  <div className="flex flex-1" style={cellWidth ? { width: numDays * cellWidth } : {}}>
                    {days.map((day, idx) => {
                      const isToday = isSameDay(day, today);
                      const isOtherMonth = view === "monat" && !isSameMonth(day, rangeStart);
                      return (
                        <div key={idx}
                          className={`text-center py-2 border-r last:border-r-0 border-gray-100 ${isToday ? "bg-blue-50" : isOtherMonth ? "bg-gray-50/60" : ""}`}
                          style={dayCellStyle()}>
                          <p className={`text-[9px] font-bold tracking-widest uppercase leading-none mb-0.5 ${isToday ? "text-blue-500" : "text-gray-300"}`}>
                            {WEEKDAY_SHORT[(day.getDay() + 6) % 7]}
                          </p>
                          <p className={`text-xs font-bold leading-tight ${isToday ? "text-blue-700" : isOtherMonth ? "text-gray-300" : "text-gray-600"}`}>
                            {format(day, view === "monat" || view === "6wochen" ? "d" : "d", { locale: de })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Resource rows grouped by type */}
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
                      <div className="flex border-b border-gray-100">
                        <div className={`w-52 flex-shrink-0 px-4 py-1.5 border-r border-gray-200 ${TYPE_ROW_COLOR[type] ?? "bg-gray-50"}`}>
                          <span className={`text-[10px] font-bold tracking-widest uppercase ${
                            type === "FAHRER" ? "text-blue-500" : type === "MASCHINE" ? "text-orange-500" :
                            type === "FAHRZEUG" ? "text-emerald-500" : "text-gray-400"
                          }`}>{TYPE_SECTION_LABEL[type] ?? type}</span>
                        </div>
                        <div className={`flex-1 ${TYPE_ROW_COLOR[type] ?? "bg-gray-50"}`} style={cellWidth ? { width: numDays * cellWidth } : {}} />
                      </div>

                      {items.map((resource) => {
                        const resourceEntries = localEntries.filter(e => e.resourceId === resource.id);
                        return (
                          <div key={resource.id} className="flex border-b border-gray-100 hover:bg-gray-50/50 transition-colors" style={{ minHeight: 56 }}>
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
                              {(() => {
                                const util = getUtilization(resource.id);
                                if (util === 0) return null;
                                return (
                                  <div className="w-full bg-gray-100 rounded-full h-1 mt-1.5">
                                    <div className={`h-1 rounded-full transition-all ${util >= 0.8 ? "bg-green-400" : util >= 0.4 ? "bg-amber-400" : "bg-blue-300"}`}
                                      style={{ width: `${util * 100}%` }} />
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="flex-1 relative" style={{ minHeight: 56, ...(cellWidth ? { width: numDays * cellWidth } : {}) }}>
                              <div className="absolute inset-0 flex">
                                {days.map((day, idx) => {
                                  const isOver = dropTarget?.resourceId === resource.id && dropTarget?.dayIdx === idx;
                                  const isToday = isSameDay(day, today);
                                  return (
                                    <div key={idx}
                                      className={`border-r last:border-r-0 border-gray-100 transition-colors ${isOver ? "bg-blue-100/50" : isToday ? "bg-blue-50/60" : ""}`}
                                      style={dayCellStyle()}
                                      onDragOver={(e) => handleDragOver(e, resource.id, idx)}
                                      onDragLeave={handleDragLeave}
                                      onDrop={(e) => handleDrop(e, resource.id, day)}
                                    />
                                  );
                                })}
                              </div>

                              {/* Drag ghost */}
                              {dropTarget?.resourceId === resource.id && dragEntry.current && (() => {
                                const de = dragEntry.current!;
                                const ghostColor = de.blockType ? (BLOCK_TYPE_COLOR[de.blockType] ?? "bg-gray-400") : (de.baustelleId ? (baustelleColorMap[de.baustelleId] ?? "bg-violet-500") : "bg-gray-400");
                                const ghostLabel = de.blockType ? (BLOCK_TYPE_LABEL[de.blockType] ?? de.blockType) : (de.baustelle?.name ?? "Eintrag");
                                const targetIdx = dropTarget.dayIdx;
                                const spanDays = Math.max(1, differenceInCalendarDays(startOfDay(new Date(de.endDate)), startOfDay(new Date(de.startDate))) + 1);
                                const ghostStyle = cellWidth
                                  ? { left: `${targetIdx * cellWidth + 2}px`, width: `${spanDays * cellWidth - 4}px` }
                                  : { left: `${(targetIdx / numDays) * 100}%`, width: `calc(${(spanDays / numDays) * 100}% - 4px)` };
                                return (
                                  <div className={`absolute top-2 rounded-md px-2.5 flex items-center text-white text-[11px] font-medium pointer-events-none opacity-40 ${ghostColor}`}
                                    style={{ ...ghostStyle, height: 32, bottom: 8 }}>
                                    <span className="truncate">{ghostLabel}</span>
                                  </div>
                                );
                              })()}
                              {resourceEntries.map((entry) => {
                                const style = getEntryStyle(entry);
                                if (!style) return null;
                                const isHighlighted = !entry.blockType && (!selectedBaustelleId || selectedBaustelleId === entry.baustelleId);
                                const isDragging = draggingEntryId === entry.id;
                                const colorClass = entry.blockType
                                  ? (BLOCK_TYPE_COLOR[entry.blockType] ?? "bg-gray-400")
                                  : (entry.baustelleId ? (baustelleColorMap[entry.baustelleId] ?? "bg-violet-500") : "bg-gray-400");
                                const label = entry.blockType
                                  ? (BLOCK_TYPE_LABEL[entry.blockType] ?? entry.blockType)
                                  : (entry.baustelle?.name ?? "Eintrag");
                                const sublabel = entry.blockType ? null : (entry.baustelle?.contact?.companyName ?? entry.baustelle?.city ?? null);
                                const hasConflict = !entry.blockType && localEntries.some(other =>
                                  other.id !== entry.id &&
                                  other.resourceId === entry.resourceId &&
                                  !other.blockType &&
                                  new Date(other.startDate) < new Date(entry.endDate) &&
                                  new Date(other.endDate) > new Date(entry.startDate)
                                );
                                return (
                                  <div key={entry.id} draggable={!entry.blockType}
                                    onDragStart={(e) => !entry.blockType && handleEntryDragStart(e, entry)}
                                    onDragEnd={handleDragEnd}
                                    className={`absolute top-2 rounded-md px-2.5 flex items-center gap-1.5 text-white text-[11px] font-medium group cursor-grab active:cursor-grabbing transition-opacity shadow-sm ${colorClass} ${
                                      isDragging ? "opacity-30" : (entry.blockType || isHighlighted) ? "opacity-100" : "opacity-15"
                                    }`}
                                    style={{ left: style.left, width: style.width, height: 32, bottom: 8 }}
                                    title={`${label}${sublabel ? ` — ${sublabel}` : ""}${entry.baustelle?.city && entry.baustelle.city !== sublabel ? ` · ${entry.baustelle.city}` : ""}${entry.notes ? `\n${entry.notes}` : ""}${`\n${format(new Date(entry.startDate), "dd.MM.yy HH:mm")} – ${format(new Date(entry.endDate), "HH:mm")}`}`}
                                    onDoubleClick={() => handleOpenEditModal(entry)}>
                                    <span className="truncate flex-1 leading-tight">
                                      {label}
                                      {style.spanDays > 1 && <span className="opacity-60 ml-1">· {style.spanDays}T</span>}
                                    </span>
                                    {hasConflict && <AlertTriangle className="h-3 w-3 text-yellow-200 flex-shrink-0 opacity-90" />}
                                    <button className="opacity-0 group-hover:opacity-100 hover:text-red-200 transition-opacity flex-shrink-0 ml-0.5"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}>
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Baustelle *</label>
                <select className={INP} value={entryForm.baustelleId} onChange={(e) => setEntryForm(d => ({ ...d, baustelleId: e.target.value }))}>
                  <option value="">– Baustelle wählen –</option>
                  {baustellen.map(b => <option key={b.id} value={b.id}>{b.name}{b.contact ? ` — ${b.contact.companyName}` : ""}</option>)}
                </select>
              </div>
              {/* Ganztag toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={entryForm.allDay} onChange={(e) => setEntryForm(d => ({ ...d, allDay: e.target.checked }))}
                  className="w-4 h-4 rounded accent-blue-600" />
                <span className="text-xs text-gray-700 font-medium">Ganztag verplanen</span>
              </label>
              {entryForm.allDay ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Von (Tag)</label>
                    <input type="date" className={INP} value={entryForm.startDate.slice(0, 10)} onChange={(e) => setEntryForm(d => ({ ...d, startDate: e.target.value + "T00:00" }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bis (Tag)</label>
                    <input type="date" className={INP} value={entryForm.endDate.slice(0, 10)} onChange={(e) => setEntryForm(d => ({ ...d, endDate: e.target.value + "T23:59" }))} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Von</label>
                    <input type="datetime-local" className={INP} value={entryForm.startDate} onChange={(e) => setEntryForm(d => ({ ...d, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bis</label>
                    <input type="datetime-local" className={INP} value={entryForm.endDate} onChange={(e) => setEntryForm(d => ({ ...d, endDate: e.target.value }))} />
                  </div>
                </div>
              )}
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
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {editModal.baustelle?.name ?? "Eintrag"} → {editModal.resource.name}
                </p>
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
              <button className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded" title="Eintrag löschen" onClick={() => { setEditModal(null); handleDeleteEntry(editModal.id); }}>
                <Trash2 className="h-4 w-4" />
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
      {dropModal && (() => {
        const dropResource = resources.find(r => r.id === dropModal.resourceId);
        const conflicts = getConflicts(dropModal.resourceId, dropForm.startDate, dropForm.endDate);
        const stammfahrerConflicts = dropWithStammfahrer && dropResource?.assignedDriver
          ? getConflicts(dropResource.assignedDriver.id, dropForm.startDate, dropForm.endDate)
          : [];
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Zeitraum festlegen</h2>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {baustellen.find(b => b.id === dropModal.baustelleId)?.name} → {dropResource?.name ?? dropModal.resourceId}
                  </p>
                </div>
                <button onClick={() => setDropModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
              </div>
              <div className="px-6 py-4 space-y-3">
                {/* Conflict warning */}
                {(conflicts.length > 0 || stammfahrerConflicts.length > 0) && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 space-y-0.5">
                      {conflicts.length > 0 && <p><span className="font-semibold">{dropResource?.name}</span> hat bereits {conflicts.length} überlappende{conflicts.length === 1 ? "n" : ""} Eintrag</p>}
                      {stammfahrerConflicts.length > 0 && <p><span className="font-semibold">{dropResource?.assignedDriver?.name}</span> hat bereits {stammfahrerConflicts.length} überlappende{stammfahrerConflicts.length === 1 ? "n" : ""} Eintrag</p>}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start *</label>
                  <input type="datetime-local" className={INP} value={dropForm.startDate} onChange={(e) => setDropForm(d => ({ ...d, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ende *</label>
                  <input type="datetime-local" className={INP} value={dropForm.endDate} onChange={(e) => setDropForm(d => ({ ...d, endDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
                  <input type="text" className={INP} placeholder="Optional..." value={dropForm.notes} onChange={(e) => setDropForm(d => ({ ...d, notes: e.target.value }))} />
                </div>
                {/* Stammfahrer auto-suggest */}
                {dropResource?.assignedDriver && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={dropWithStammfahrer} onChange={(e) => setDropWithStammfahrer(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-xs text-gray-700">
                      Stammfahrer <span className="font-semibold">{dropResource.assignedDriver.name}</span> ebenfalls einplanen
                    </span>
                  </label>
                )}
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDropModal(null)}>Abbrechen</Button>
                <Button onClick={handleDropModalSubmit} disabled={dropSubmitting}>{dropSubmitting ? "Wird erstellt..." : "Eintrag erstellen"}</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal: Sperren (Verfügbarkeit) ─────────────────────────────────── */}
      {sperrModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Ressource sperren</h2>
              <button onClick={() => setSperrModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ressource *</label>
                <select className={INP} value={sperrModal.resourceId} onChange={(e) => setSperrModal(d => d ? { ...d, resourceId: e.target.value } : d)}>
                  <option value="">– Ressource wählen –</option>
                  {groupedResources.map(({ type, items }) => (
                    <optgroup key={type} label={TYPE_SECTION_LABEL[type] ?? type}>
                      {items.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Art der Sperre</label>
                <select className={INP} value={sperrForm.blockType} onChange={(e) => setSperrForm(d => ({ ...d, blockType: e.target.value as typeof sperrForm.blockType }))}>
                  <option value="URLAUB">Urlaub</option>
                  <option value="SERVICE">Service / Wartung</option>
                  <option value="KRANK">Krank</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Von *</label>
                <input type="datetime-local" className={INP} value={sperrForm.startDate} onChange={(e) => setSperrForm(d => ({ ...d, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bis *</label>
                <input type="datetime-local" className={INP} value={sperrForm.endDate} onChange={(e) => setSperrForm(d => ({ ...d, endDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notizen</label>
                <input type="text" className={INP} placeholder="Optional..." value={sperrForm.notes} onChange={(e) => setSperrForm(d => ({ ...d, notes: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSperrModal(null)}>Abbrechen</Button>
              <Button onClick={handleSperrSubmit} disabled={sperrSubmitting || !sperrModal.resourceId}>
                {sperrSubmitting ? "Wird gespeichert..." : "Speichern"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
