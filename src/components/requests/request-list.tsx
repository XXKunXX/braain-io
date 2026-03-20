"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2, Search, ChevronRight, ClipboardList } from "lucide-react";
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
import { sortItems } from "@/lib/sort";
import { SortHeader } from "@/components/ui/sort-header";

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
  OPEN: "bg-blue-50 text-blue-700",
  NEU: "bg-blue-50 text-blue-700",
  BESICHTIGUNG_GEPLANT: "bg-amber-50 text-amber-700",
  BESICHTIGUNG_DURCHGEFUEHRT: "bg-teal-50 text-teal-700",
  ANGEBOT_ERSTELLT: "bg-amber-50 text-amber-700",
  IN_PROGRESS: "bg-purple-50 text-purple-700",
  DONE: "bg-green-100 text-green-800",
};

const allStatuses = Object.entries(statusLabels);

interface RequestListProps {
  requests: RequestWithContact[];
  initialStatus?: string;
}

export function RequestList({ requests, initialStatus }: RequestListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus ?? "ALL");
  const [sortKey, setSortKey] = useState<string | null>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const base = requests.filter((r) => {
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.contact.companyName.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "title") return item.title;
      if (key === "contact") return item.contact.companyName;
      if (key === "status") return item.status;
      if (key === "owner") return item.assignedTo ?? "";
      if (key === "createdAt") return new Date(item.createdAt);
      return (item as Record<string, unknown>)[key];
    });
  }, [requests, search, statusFilter, sortKey, sortDir]);

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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Titel, Kontakt, Beschreibung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-44 bg-white">
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
          <div className="hidden md:grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/80">
            <span />
            <SortHeader label="Titel" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Kontakt" sortKey="contact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Owner" sortKey="owner" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Erstellt am" sortKey="createdAt" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <span />
          </div>

          {/* Rows */}
          {filtered.map((req, i) => (
            <Link
              key={req.id}
              href={`/anfragen/${req.id}`}
              className={`flex md:grid md:grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 items-center hover:bg-gray-50/60 transition-colors group ${
                i !== filtered.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Icon */}
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-orange-50">
                <ClipboardList className="h-3.5 w-3.5 text-orange-500" />
              </div>

              {/* Titel */}
              <div className="min-w-0 flex-1 md:flex-none flex items-center gap-2 overflow-hidden">
                <span className="text-sm font-medium text-gray-900 truncate">{req.title}</span>
              </div>

              {/* Kontakt */}
              <span className="hidden md:block text-xs text-gray-500 truncate">{req.contact.companyName}</span>

              {/* Status badge */}
              <div className="hidden md:block">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[req.status]}`}>
                  {statusLabels[req.status] ?? req.status}
                </span>
              </div>

              {/* Owner */}
              <span className="hidden md:block text-xs text-gray-500 truncate">
                {req.assignedTo ?? "–"}
              </span>

              {/* Erstellt am */}
              <span className="hidden md:block text-xs text-gray-500">
                {format(new Date(req.createdAt), "dd.MM.yyyy", { locale: de })}
              </span>

              {/* Right: chevron + delete on hover */}
              <div className="flex items-center justify-end">
                <button
                  onClick={(e) => handleDelete(e, req.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 absolute"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:opacity-0 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
