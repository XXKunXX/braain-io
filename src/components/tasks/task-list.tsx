"use client";

import { useState, useMemo, useTransition } from "react";
import { RelativeDate } from "@/components/ui/relative-date";
import { Search, Trash2, ChevronRight, CheckSquare, AlertCircle, Clock, Circle, CheckCircle2, LayoutList } from "lucide-react";
import { getContactName } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { updateTaskStatus, deleteTask } from "@/actions/tasks";
import { toast } from "sonner";
import type { Task, Contact, Request, DeliveryNote, Invoice } from "@prisma/client";
import { TaskDetailDrawer } from "./task-detail-drawer";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateTaskDialog } from "./create-task-dialog";

type TaskWithContact = Task & {
  contact: Contact | null;
  request: Request | null;
  deliveryNote: (Omit<DeliveryNote, "quantity"> & { quantity: number }) | null;
  invoice: (Omit<Invoice, "subtotal" | "vatAmount" | "totalAmount"> & { subtotal: number; vatAmount: number; totalAmount: number }) | null;
};

const priorityLabels: Record<string, string> = {
  LOW: "Niedrig",
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  DONE: "Erledigt",
};

const STATUS_TABS = [
  { key: "OPEN_AND_IN_PROGRESS", label: "Offen", icon: Circle },
  { key: "DONE", label: "Erledigt", icon: CheckCircle2 },
  { key: "ALL", label: "Alle", icon: LayoutList },
] as const;

const PRIORITY_TABS = [
  { key: "ALL", label: "Alle" },
  { key: "URGENT", label: "Dringend" },
  { key: "HIGH", label: "Hoch" },
  { key: "NORMAL", label: "Normal" },
  { key: "LOW", label: "Niedrig" },
] as const;

function isOverdue(task: Task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
}

interface TaskListProps {
  tasks: TaskWithContact[];
  requests?: Request[];
  currentUserName?: string;
}

export function TaskList({ tasks, requests = [], currentUserName }: TaskListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("OPEN_AND_IN_PROGRESS");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [selectedTask, setSelectedTask] = useState<TaskWithContact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [, startTransition] = useTransition();

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const base = tasks.filter((t) => {
      if (statusFilter === "OPEN_AND_IN_PROGRESS" && t.status === "DONE") return false;
      if (statusFilter !== "ALL" && statusFilter !== "OPEN_AND_IN_PROGRESS" && t.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      if (!matchesSearch(search, t.title)) return false;
      return true;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "title") return item.title;
      if (key === "contact") return getContactName(item.contact, "");
      if (key === "dueDate") return item.dueDate ? new Date(item.dueDate) : new Date("9999");
      if (key === "priority") return ({ HIGH: 0, MEDIUM: 1, LOW: 2 } as Record<string, number>)[item.priority] ?? 3;
      if (key === "status") return item.status;
      if (key === "assignedTo") return item.assignedTo ?? "";
      return (item as Record<string, unknown>)[key];
    });
  }, [tasks, search, statusFilter, priorityFilter, sortKey, sortDir]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: tasks.length };
    for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
    counts["OPEN_AND_IN_PROGRESS"] = (counts["OPEN"] ?? 0) + (counts["IN_PROGRESS"] ?? 0);
    return counts;
  }, [tasks]);

  const priorityCounts = useMemo(() => {
    const statusFiltered = tasks.filter((t) => {
      if (statusFilter === "OPEN_AND_IN_PROGRESS") return t.status === "OPEN" || t.status === "IN_PROGRESS";
      if (statusFilter !== "ALL") return t.status === statusFilter;
      return true;
    });
    const counts: Record<string, number> = { ALL: statusFiltered.length };
    for (const t of statusFiltered) counts[t.priority] = (counts[t.priority] ?? 0) + 1;
    return counts;
  }, [tasks, statusFilter]);

  const openCount = currentUserName
    ? tasks.filter((t) => t.status !== "DONE" && t.assignedTo === currentUserName).length
    : tasks.filter((t) => t.status !== "DONE").length;
  const overdueCount = tasks.filter((t) => isOverdue(t)).length;
  const todayCount = tasks.filter((t) => {
    if (!t.dueDate || t.status === "DONE") return false;
    const due = new Date(t.dueDate);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  }).length;

  function handleToggleDone(task: TaskWithContact) {
    const newStatus = task.status === "DONE" ? "OPEN" : "DONE";
    startTransition(async () => {
      await updateTaskStatus(task.id, newStatus);
      toast.success(newStatus === "DONE" ? "Aufgabe erledigt" : "Aufgabe wieder geöffnet");
    });
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await deleteTask(deleteId);
    toast.success("Aufgabe gelöscht");
  }

  return (
    <>
    <ConfirmDialog
      open={!!deleteId}
      onOpenChange={(open) => { if (!open) setDeleteId(null); }}
      title="Aufgabe löschen"
      description="Diese Aufgabe wird unwiderruflich gelöscht."
      onConfirm={confirmDelete}
    />
    <TaskDetailDrawer
      task={selectedTask}
      fallbackRequest={selectedTask && !selectedTask.request && selectedTask.contactId
        ? requests.find((r) => r.contactId === selectedTask.contactId) ?? null
        : null}
      onClose={() => setSelectedTask(null)}
    />
    <div className="max-w-5xl space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<CheckSquare className="h-5 w-5 text-blue-500" />}
          iconBg="bg-blue-50"
          value={openCount}
          label={currentUserName ? "Meine offenen Aufgaben" : "Offene Aufgaben"}
        />
        <StatCard
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
          value={overdueCount}
          label="Überfällige Aufgaben"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          iconBg="bg-amber-50"
          value={todayCount}
          label="Heute fällig"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              statusFilter === key
                ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
            {(statusCounts[key] ?? 0) > 0 && (
              <span className="text-xs text-gray-400">({statusCounts[key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Priority filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {PRIORITY_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPriorityFilter(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              priorityFilter === key
                ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            {label}
            {(priorityCounts[key] ?? 0) > 0 && (
              <span className="text-xs text-gray-400">({priorityCounts[key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + CTA */}
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
        <CreateTaskDialog />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          headline="Keine Aufgaben gefunden"
          subline="Passe die Filter an oder lege eine neue Aufgabe an."
        />
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filtered.map((task) => {
              const overdue = isOverdue(task);
              const done = task.status === "DONE";
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleDone(task); }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                        done ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      {done && <span className="text-white text-xs">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium mb-1 ${done ? "line-through text-gray-400" : "text-gray-900"}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-gray-400 mb-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </span>
                        {task.dueDate && (
                          <RelativeDate
                            date={task.dueDate}
                            overdue={overdue ?? undefined}
                            className="text-xs"
                          />
                        )}
                        {task.contact && (task.contact.companyName || task.contact.firstName || task.contact.lastName) && (
                          <span className="text-xs text-gray-400">{task.contact.companyName || [task.contact.firstName, task.contact.lastName].filter(Boolean).join(" ")}</span>
                        )}
                        {task.assignedTo && (
                          <span className="text-xs text-gray-400">→ {task.assignedTo}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(e, task.id)}
                        className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_100px_90px_80px_56px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <span />
              <SortHeader label="Titel" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Zugewiesen an" sortKey="assignedTo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Fälligkeit" sortKey="dueDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Priorität" sortKey="priority" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span />
            </div>

            {/* Rows */}
            {filtered.map((task, i) => {
              const overdue = isOverdue(task);
              const done = task.status === "DONE";
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`grid grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_100px_90px_80px_56px] gap-3 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors cursor-pointer ${
                    i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleDone(task); }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      done
                        ? "bg-green-500 border-green-500"
                        : "border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {done && <span className="text-white text-xs">✓</span>}
                  </button>

                  {/* Title */}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${done ? "line-through text-gray-400" : "text-gray-900"}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-400 truncate">{task.description}</p>
                    )}
                  </div>

                  {/* Assigned to */}
                  <span className="text-sm text-gray-500 truncate">
                    {task.assignedTo ?? "—"}
                  </span>

                  {/* Due date */}
                  <div className="flex items-center gap-1.5">
                    <RelativeDate
                      date={task.dueDate}
                      overdue={overdue ?? undefined}
                      className="text-sm"
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                      {priorityLabels[task.priority]}
                    </span>
                  </div>

                  {/* Status */}
                  <span className="text-xs text-gray-500">{statusLabels[task.status]}</span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => handleDelete(e, task.id)}
                      className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
    </>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4 text-center sm:text-left">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-[11px] sm:text-xs text-gray-400 leading-tight">{label}</p>
      </div>
    </div>
  );
}
