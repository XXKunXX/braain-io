"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, Trash2, ChevronRight, CheckSquare, AlertCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTaskStatus, deleteTask } from "@/actions/tasks";
import { toast } from "sonner";
import type { Task, Contact, Request } from "@prisma/client";
import { TaskDetailDrawer } from "./task-detail-drawer";

type TaskWithContact = Task & { contact: Contact | null; request: Request | null };

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

function isOverdue(task: Task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
}

interface TaskListProps {
  tasks: TaskWithContact[];
  requests?: Request[];
}

export function TaskList({ tasks, requests = [] }: TaskListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [selectedTask, setSelectedTask] = useState<TaskWithContact | null>(null);
  const [, startTransition] = useTransition();

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCount = tasks.filter((t) => t.status === "OPEN").length;
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

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTask(id);
      toast.success("Aufgabe gelöscht");
    });
  }

  return (
    <>
    <TaskDetailDrawer
      task={selectedTask}
      fallbackRequest={selectedTask && !selectedTask.request && selectedTask.contactId
        ? requests.find((r) => r.contactId === selectedTask.contactId) ?? null
        : null}
      onClose={() => setSelectedTask(null)}
    />
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<CheckSquare className="h-5 w-5 text-blue-500" />}
          iconBg="bg-blue-50"
          value={openCount}
          label="Meine offenen Aufgaben"
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

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-40 bg-white">
            <SelectValue>{statusFilter === "ALL" ? "Alle Status" : statusLabels[statusFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Status</SelectItem>
            <SelectItem value="OPEN">Offen</SelectItem>
            <SelectItem value="IN_PROGRESS">In Bearbeitung</SelectItem>
            <SelectItem value="DONE">Erledigt</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => v && setPriorityFilter(v)}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue>{priorityFilter === "ALL" ? "Alle Prioritäten" : priorityLabels[priorityFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Prioritäten</SelectItem>
            <SelectItem value="LOW">Niedrig</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="HIGH">Hoch</SelectItem>
            <SelectItem value="URGENT">Dringend</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine Aufgaben gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_minmax(0,2fr)_1fr_1fr_1fr_1fr_60px] gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
            <span />
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Titel</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakt</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Zugewiesen an</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Fälligkeit</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Priorität</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</span>
          </div>

          {/* Rows */}
          {filtered.map((task, i) => {
            const overdue = isOverdue(task);
            const done = task.status === "DONE";
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`grid grid-cols-[40px_minmax(0,2fr)_1fr_1fr_1fr_1fr_60px] gap-3 px-4 py-3 items-center hover:bg-gray-50 transition-colors cursor-pointer ${
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

                {/* Contact */}
                <span className="text-sm text-gray-500 truncate">
                  {task.contact?.companyName ?? "—"}
                </span>

                {/* Assigned to */}
                <span className="text-sm text-gray-500 truncate">
                  {task.assignedTo ?? "—"}
                </span>

                {/* Due date */}
                <div className="flex items-center gap-1.5">
                  {task.dueDate ? (
                    <>
                      <span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                        {format(new Date(task.dueDate), "dd.MM.yyyy")}
                      </span>
                      {overdue && (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                          Überfällig
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                    {priorityLabels[task.priority]}
                  </span>
                </div>

                {/* Status + actions */}
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xs text-gray-500">{statusLabels[task.status]}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                    className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
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
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}
