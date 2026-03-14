"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2, Search, SlidersHorizontal } from "lucide-react";
import type { Contact, Request } from "@prisma/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteRequest } from "@/actions/requests";
import { toast } from "sonner";

type RequestWithContact = Request & { contact: Contact };

const statusLabels: Record<string, string> = {
  OPEN: "Offen",
  NEU: "Neu",
  BESICHTIGUNG_GEPLANT: "Besichtigung geplant",
  BESICHTIGUNG_DURCHGEFUEHRT: "Besichtigt",
  ANGEBOT_ERSTELLT: "Angebot erstellt",
  IN_PROGRESS: "In Bearbeitung",
  DONE: "Erledigt",
};

const statusColors: Record<string, string> = {
  OPEN: "border border-blue-300 text-blue-700 bg-blue-50",
  NEU: "border border-blue-300 text-blue-700 bg-blue-50",
  BESICHTIGUNG_GEPLANT: "border border-amber-400 text-amber-700 bg-amber-50",
  BESICHTIGUNG_DURCHGEFUEHRT: "border border-teal-400 text-teal-700 bg-teal-50",
  ANGEBOT_ERSTELLT: "border border-amber-400 text-amber-700 bg-amber-50",
  IN_PROGRESS: "border border-purple-300 text-purple-700 bg-purple-50",
  DONE: "border border-green-500 text-green-800 bg-green-100",
};

const allStatuses = Object.entries(statusLabels);

interface RequestListProps {
  requests: RequestWithContact[];
}

export function RequestList({ requests }: RequestListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.contact.companyName.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [requests, search, statusFilter]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Anfrage wirklich löschen?")) return;
    await deleteRequest(id);
    toast.success("Anfrage gelöscht");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Titel, Kontakt, Beschreibung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-48 bg-white gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <SelectValue>{statusFilter === "ALL" ? "Alle Status" : statusLabels[statusFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Status</SelectItem>
            {allStatuses.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Keine Anfragen gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/80">
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Titel / Beschreibung</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakt</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Owner</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Erstellt am</span>
            <span />
          </div>

          {/* Rows */}
          {filtered.map((req, i) => (
            <Link
              key={req.id}
              href={`/anfragen/${req.id}`}
              className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 items-center hover:bg-gray-50/60 transition-colors group ${
                i !== filtered.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Titel + Beschreibung */}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{req.title}</p>
                {req.description && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{req.description}</p>
                )}
              </div>

              {/* Kontakt */}
              <span className="text-sm text-gray-600 truncate">{req.contact.companyName}</span>

              {/* Status badge */}
              <div>
                <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[req.status]}`}>
                  {statusLabels[req.status] ?? req.status}
                </span>
              </div>

              {/* Owner */}
              <span className="text-sm text-gray-600 truncate">
                {req.assignedTo ?? "–"}
              </span>

              {/* Erstellt am */}
              <span className="text-sm text-gray-500">
                {format(new Date(req.createdAt), "dd.MM.yyyy", { locale: de })}
              </span>

              {/* Delete */}
              <button
                onClick={(e) => handleDelete(e, req.id)}
                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
