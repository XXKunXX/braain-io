"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { X, ExternalLink, Calendar, User, Flag, Building2, CheckCircle2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateTaskStatus } from "@/actions/tasks";
import { toast } from "sonner";
import type { Task, Contact, Request, DeliveryNote } from "@prisma/client";

type TaskWithRelations = Task & { contact: Contact | null; request: Request | null; deliveryNote: DeliveryNote | null };

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

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border border-blue-200",
  IN_PROGRESS: "bg-purple-50 text-purple-700 border border-purple-200",
  DONE: "bg-green-50 text-green-700 border border-green-200",
};

interface TaskDetailDrawerProps {
  task: TaskWithRelations | null;
  fallbackRequest?: Request | null;
  onClose: () => void;
}

export function TaskDetailDrawer({ task, fallbackRequest, onClose }: TaskDetailDrawerProps) {
  const [, startTransition] = useTransition();
  const [doneOverride, setDoneOverride] = useState<boolean | null>(null);

  if (!task) return null;

  const isDone = doneOverride !== null ? doneOverride : task.status === "DONE";

  function handleToggleDone() {
    const newDone = !isDone;
    setDoneOverride(newDone);
    startTransition(async () => {
      await updateTaskStatus(task!.id, newDone ? "DONE" : "OPEN");
      toast.success(newDone ? "Aufgabe erledigt" : "Aufgabe wieder geöffnet");
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Aufgabe</p>
            <h2 className={`text-base font-semibold ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}>
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status + Priorität */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDone ? statusColors["DONE"] : statusColors[task.status]}`}>
              {isDone ? "Erledigt" : statusLabels[task.status]}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${priorityColors[task.priority]}`}>
              {priorityLabels[task.priority]}
            </span>
          </div>

          {/* Details */}
          <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
            {/* Kontakt */}
            {task.contact && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Kontakt</p>
                  <p className="text-sm text-gray-900 mt-0.5">{task.contact.companyName}</p>
                </div>
              </div>
            )}

            {/* Zugewiesen an */}
            {task.assignedTo && (
              <div className="flex items-center gap-3 px-4 py-3">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Zugewiesen an</p>
                  <p className="text-sm text-gray-900 mt-0.5">{task.assignedTo}</p>
                </div>
              </div>
            )}

            {/* Fälligkeit */}
            {task.dueDate && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Fälligkeit</p>
                  <p className="text-sm text-gray-900 mt-0.5">
                    {format(new Date(task.dueDate), "dd. MMMM yyyy", { locale: de })}
                  </p>
                </div>
              </div>
            )}

            {/* Priorität */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Flag className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Priorität</p>
                <p className="text-sm text-gray-900 mt-0.5">{priorityLabels[task.priority]}</p>
              </div>
            </div>
          </div>

          {/* Beschreibung */}
          {task.description && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Beschreibung</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Verknüpfter Lieferschein */}
          {task.deliveryNote && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Verknüpfter Lieferschein</p>
              <a
                href={`/api/pdf/delivery/${task.deliveryNote.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3 hover:bg-green-100 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-green-900 truncate">{task.deliveryNote.deliveryNumber}</p>
                  {task.contact && (
                    <p className="text-xs text-green-600 mt-0.5">{task.contact.companyName}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-green-400 group-hover:text-green-600 flex-shrink-0 ml-3" />
              </a>
            </div>
          )}

          {/* Verknüpfte Anfrage */}
          {!task.deliveryNote && (task.request ?? fallbackRequest) && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Verknüpfte Anfrage</p>
              <Link
                href={`/anfragen/${(task.request ?? fallbackRequest)!.id}`}
                onClick={onClose}
                className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-900 truncate">{(task.request ?? fallbackRequest)!.title}</p>
                  {task.contact && (
                    <p className="text-xs text-blue-600 mt-0.5">{task.contact.companyName}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-blue-400 group-hover:text-blue-600 flex-shrink-0 ml-3" />
              </Link>
            </div>
          )}

          {/* Erstellt am */}
          <p className="text-xs text-gray-300">
            Erstellt am {format(new Date(task.createdAt), "dd.MM.yyyy", { locale: de })}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <Button
            onClick={handleToggleDone}
            className={`flex-1 rounded-lg gap-2 ${isDone ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-green-600 hover:bg-green-700 text-white"}`}
            variant="ghost"
          >
            {isDone ? (
              <><RotateCcw className="h-4 w-4" />Wieder öffnen</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" />Als erledigt markieren</>
            )}
          </Button>
          <Button variant="outline" className="rounded-lg px-4" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>
    </>
  );
}
