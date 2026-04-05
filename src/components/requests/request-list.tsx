"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Trash2, Search, ChevronRight, ClipboardList, Plus,
  Files, Inbox, CalendarClock, Eye, FileText, Loader2, CheckCircle,
  Phone,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Contact, Request } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteRequest } from "@/actions/requests";
import { toast } from "sonner";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BlitzAnfrageSheet } from "./blitz-anfrage-sheet";
import { getContactName } from "@/lib/utils";

type RequestWithContact = Request & { contact: Contact };

const STATUS_TABS = [
  { key: "ALL", label: "Alle", icon: Files },
  { key: "NEU", label: "Neu", icon: Inbox },
  { key: "OPEN", label: "Offen", icon: Inbox },
  { key: "BESICHTIGUNG_GEPLANT", label: "Besichtigung", icon: CalendarClock },
  { key: "BESICHTIGUNG_DURCHGEFUEHRT", label: "Besichtigt", icon: Eye },
  { key: "ANGEBOT_ERSTELLT", label: "Angebot", icon: FileText },
  { key: "IN_PROGRESS", label: "In Bearbeitung", icon: Loader2 },
  { key: "DONE", label: "Erledigt", icon: CheckCircle },
] as const;

interface RequestListProps {
  requests: RequestWithContact[];
  initialStatus?: string;
  contacts?: Contact[];
}

export function RequestList({ requests, initialStatus, contacts = [] }: RequestListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(initialStatus ?? "ALL");
  const [sortKey, setSortKey] = useState<string | null>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [blitzOpen, setBlitzOpen] = useState(false);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: requests.length };
    for (const r of requests) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  }, [requests]);

  const filtered = useMemo(() => {
    const base = requests.filter((r) => {
      const matchesStatus = activeTab === "ALL" || r.status === activeTab;
      const matchesText = matchesSearch(search, r.title, getContactName(r.contact), r.description);
      return matchesStatus && matchesText;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "title") return item.title;
      if (key === "contact") return getContactName(item.contact);
      if (key === "status") return item.status;
      if (key === "owner") return item.assignedTo ?? "";
      if (key === "createdAt") return new Date(item.createdAt);
      return (item as Record<string, unknown>)[key];
    });
  }, [requests, search, activeTab, sortKey, sortDir]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await deleteRequest(deleteId);
    toast.success("Anfrage gelöscht");
    router.refresh();
  }

  return (
    <>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Anfrage löschen"
        description="Diese Anfrage wird unwiderruflich gelöscht."
        onConfirm={confirmDelete}
      />

      {/* Blitz-Anfrage Sheet — Mobile only */}
      <BlitzAnfrageSheet
        open={blitzOpen}
        onClose={() => setBlitzOpen(false)}
        contacts={contacts}
      />

      {/* FAB — Mobile only, floats above bottom nav */}
      <button
        onClick={() => setBlitzOpen(true)}
        className="md:hidden fixed z-30 right-5 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 active:scale-95 transition-transform"
        style={{
          bottom: "calc(80px + env(safe-area-inset-bottom))",
          height: "52px",
          paddingLeft: "20px",
          paddingRight: "20px",
        }}
      >
        <Plus className="h-5 w-5" />
        <span className="text-sm font-semibold">Anfrage</span>
      </button>

      <div className="space-y-5 relative">
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

        {/* Search + CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Titel, Kontakt, Beschreibung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          {/* Desktop CTA — hidden on mobile (FAB handles it) */}
          <Link href="/anfragen/neu" className="hidden sm:block">
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Neue Anfrage
            </Button>
          </Link>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            headline="Keine Anfragen gefunden"
            subline="Passe die Suchfilter an oder erfasse eine neue Anfrage."
            ctaLabel="Neue Anfrage erfassen"
            ctaHref="/anfragen/neu"
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-2.5">
              {filtered.map((req) => (
                <div key={req.id} className="relative">
                  <Link
                    href={`/anfragen/${req.id}`}
                    className="block bg-white border border-gray-200 rounded-2xl p-4 active:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{req.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{getContactName(req.contact)}</p>
                        <div className="flex items-center gap-2 mt-2.5">
                          <StatusBadge status={req.status} />
                          <span className="text-xs text-gray-400">
                            {format(new Date(req.createdAt), "dd.MM.yy", { locale: de })}
                          </span>
                          {req.assignedTo && (
                            <span className="text-xs text-gray-400 truncate">· {req.assignedTo}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 -mr-1">
                        {/* Phone button — tap to call contact */}
                        {req.contact.phone && (
                          <button
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.location.href = `tel:${req.contact.phone}`; }}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-green-50 text-green-600 active:bg-green-100 transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(e, req.id)}
                          className="w-9 h-9 flex items-center justify-center text-gray-300 active:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                <SortHeader label="Titel" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Kontakt" sortKey="contact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Owner" sortKey="owner" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Erstellt am" sortKey="createdAt" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
              </div>

              {filtered.map((req, i) => (
                <Link
                  key={req.id}
                  href={`/anfragen/${req.id}`}
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
                    i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900 truncate">{req.title}</span>
                  <span className="text-sm text-gray-500 truncate">{getContactName(req.contact)}</span>
                  <div>
                    <StatusBadge status={req.status} />
                  </div>
                  <span className="text-sm text-gray-500 truncate">{req.assignedTo ?? "–"}</span>
                  <span className="text-sm text-gray-500">
                    {format(new Date(req.createdAt), "dd.MM.yyyy", { locale: de })}
                  </span>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
                    <button
                      onClick={(e) => handleDelete(e, req.id)}
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
      </div>
    </>
  );
}
