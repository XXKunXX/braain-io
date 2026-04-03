"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Trash2, Search, ChevronRight, ClipboardCheck, Plus,
  Files, Calendar, Zap, AlertCircle, Receipt, CheckCircle2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Contact, Order, Quote } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteOrder } from "@/actions/orders";
import { toast } from "sonner";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type OrderWithRelations = Order & { contact: Contact; quote: Quote | null };

const STATUS_TABS = [
  { key: "ALL", label: "Alle", icon: Files },
  { key: "PLANNED", label: "Geplant", icon: Calendar },
  { key: "ACTIVE", label: "Aktiv", icon: Zap },
  { key: "PENDING", label: "Ausstehend", icon: AlertCircle },
  { key: "INVOICED", label: "In Abrechnung", icon: Receipt },
  { key: "COMPLETED", label: "Abgeschlossen", icon: CheckCircle2 },
] as const;

export function OrderList({ orders }: { orders: OrderWithRelations[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [sortKey, setSortKey] = useState<string | null>("startDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    const base = orders.filter((o) => {
      const matchesStatus = activeTab === "ALL" || o.status === activeTab;
      const matchesText = matchesSearch(search, o.title, o.contact.companyName, o.quote?.siteAddress);
      return matchesStatus && matchesText;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "title") return item.title;
      if (key === "contact") return item.contact.companyName;
      if (key === "totalPrice") return item.quote ? Number(item.quote.totalPrice) : 0;
      if (key === "status") return item.status;
      if (key === "startDate") return new Date(item.startDate);
      return (item as Record<string, unknown>)[key];
    });
  }, [orders, search, activeTab, sortKey, sortDir]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await deleteOrder(deleteId);
    toast.success("Auftrag gelöscht");
    router.refresh();
  }

  return (
    <>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Auftrag löschen"
        description="Dieser Auftrag wird unwiderruflich gelöscht."
        onConfirm={confirmDelete}
      />
      <div className="space-y-5">
        {/* Status Chips — horizontal scrollable (native app style) */}
        <div className="-mx-4 sm:mx-0">
          <div className="flex items-center gap-2 overflow-x-auto px-4 sm:px-0 pb-0.5 scrollbar-hide">
            {STATUS_TABS.filter(({ key }) => key === "ALL" || (tabCounts[key] ?? 0) > 0).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border whitespace-nowrap flex-shrink-0 ${
                  activeTab === key
                    ? "bg-gray-900 border-gray-900 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
                {(tabCounts[key] ?? 0) > 0 && (
                  <span className={`text-xs ${activeTab === key ? "text-gray-300" : "text-gray-400"}`}>
                    {tabCounts[key]}
                  </span>
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
              placeholder="Projekt, Kontakt, Baustelle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Link href="/auftraege/neu">
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Neuer Auftrag
            </Button>
          </Link>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            headline="Keine Aufträge gefunden"
            subline="Passe die Suchfilter an oder lege einen neuen Auftrag an."
            ctaLabel="Neuen Auftrag anlegen"
            ctaHref="/auftraege/neu"
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filtered.map((order) => (
                <Link
                  key={order.id}
                  href={`/auftraege/${order.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{order.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 truncate">{order.contact.companyName}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {format(new Date(order.startDate), "dd.MM.yy", { locale: de })} – {format(new Date(order.endDate), "dd.MM.yy", { locale: de })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={order.status} />
                        {order.quote && (
                          <span className="text-xs text-gray-500 font-mono">
                            {Number(order.quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(e, order.id)}
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
                <SortHeader label="Projekt" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Kontakt" sortKey="contact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Zeitraum" sortKey="startDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Summe" sortKey="totalPrice" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
              </div>

              {filtered.map((order, i) => (
                <Link
                  key={order.id}
                  href={`/auftraege/${order.id}`}
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
                    i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900 truncate">{order.title}</span>
                  <span className="text-sm text-gray-500 truncate">{order.contact.companyName}</span>
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    {format(new Date(order.startDate), "dd.MM.yy", { locale: de })} – {format(new Date(order.endDate), "dd.MM.yy", { locale: de })}
                  </span>
                  <span className="text-sm text-gray-500 font-mono">
                    {order.quote
                      ? Number(order.quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                      : "–"}
                  </span>
                  <div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
                    <button
                      onClick={(e) => handleDelete(e, order.id)}
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
