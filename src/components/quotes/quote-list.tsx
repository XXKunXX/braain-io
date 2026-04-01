"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2, Search, ChevronRight, FileText, Plus, Clock, Send, CheckCircle, XCircle, Files } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteQuote } from "@/actions/quotes";
import { toast } from "sonner";
import type { Contact, Quote, QuoteItem } from "@prisma/client";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type QuoteWithRelations = Omit<Quote, "totalPrice" | "validUntil" | "createdAt" | "updatedAt"> & {
  totalPrice: number;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  items: (Omit<QuoteItem, "unitPrice" | "total"> & {
    unitPrice: number;
    total: number;
  })[];
};

const STATUS_TABS = [
  { key: "ALL", label: "Alle", icon: Files },
  { key: "DRAFT", label: "Entwurf", icon: Clock },
  { key: "SENT", label: "Gesendet", icon: Send },
  { key: "ACCEPTED", label: "Angenommen", icon: CheckCircle },
  { key: "REJECTED", label: "Abgelehnt", icon: XCircle },
] as const;

const statusLabels: Record<string, string> = {
  DRAFT: "Entwurf",
  SENT: "Gesendet",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
};

export function QuoteList({
  quotes: initialQuotes,
  currentStatus,
}: {
  quotes: QuoteWithRelations[];
  currentStatus?: string;
}) {
  const router = useRouter();
  const [quotes] = useState(initialQuotes);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(currentStatus ?? "ALL");
  const [sortKey, setSortKey] = useState<string | null>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: quotes.length };
    for (const q of quotes) {
      counts[q.status] = (counts[q.status] ?? 0) + 1;
    }
    return counts;
  }, [quotes]);

  const filtered = useMemo(() => {
    const base = quotes.filter((q) => {
      const matchesText = matchesSearch(search, q.title, q.contact.companyName, q.quoteNumber);
      const matchesStatus = activeTab === "ALL" || q.status === activeTab;
      return matchesText && matchesStatus;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "title") return item.title;
      if (key === "contact") return item.contact.companyName;
      if (key === "totalPrice") return Number(item.totalPrice);
      if (key === "status") return item.status;
      if (key === "createdAt") return new Date(item.createdAt);
      return (item as Record<string, unknown>)[key];
    });
  }, [quotes, search, activeTab, sortKey, sortDir]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await deleteQuote(deleteId);
    toast.success("Angebot gelöscht");
    router.refresh();
  }

  return (
    <>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Angebot löschen"
        description="Dieses Angebot wird unwiderruflich gelöscht."
        onConfirm={confirmDelete}
      />
      <div className="space-y-5">
        {/* Status Tabs */}
        <div className="overflow-hidden">
          <div className="flex items-center gap-1">
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
              placeholder="Titel, Kontakt, Nummer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Link href="/angebote/neu">
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Neues Angebot
            </Button>
          </Link>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            headline="Keine Angebote gefunden"
            subline="Passe die Suchfilter an oder erstelle ein neues Angebot."
            ctaLabel="Neues Angebot erstellen"
            ctaHref="/angebote/neu"
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filtered.map((quote) => (
                <Link
                  key={quote.id}
                  href={`/angebote/${quote.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{quote.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 truncate">{quote.contact.companyName}</span>
                        <span className="text-xs text-gray-400">{quote.quoteNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={quote.status} />
                        <span className="text-xs text-gray-500 font-mono">
                          {Number(quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(e, quote.id)}
                        className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                <SortHeader label="Titel" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Kontakt" sortKey="contact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Betrag" sortKey="totalPrice" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Erstellt am" sortKey="createdAt" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
              </div>

              {filtered.map((quote, i) => (
                <Link
                  key={quote.id}
                  href={`/angebote/${quote.id}`}
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
                    i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{quote.title}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 hidden lg:inline">{quote.quoteNumber}</span>
                  </div>
                  <span className="text-sm text-gray-500 truncate">{quote.contact.companyName}</span>
                  <span className="text-sm text-gray-500 font-mono">
                    {Number(quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </span>
                  <div>
                    <StatusBadge status={quote.status} />
                  </div>
                  <span className="text-sm text-gray-500">
                    {format(new Date(quote.createdAt), "dd.MM.yyyy", { locale: de })}
                  </span>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
                    <button
                      onClick={(e) => handleDelete(e, quote.id)}
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
