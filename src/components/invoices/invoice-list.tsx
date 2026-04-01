"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Search, ChevronRight, FileText, Trash2,
  Files, Send, CheckCircle, XCircle, Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { deleteInvoice } from "@/actions/invoices";
import { toast } from "sonner";
import { sortItems } from "@/lib/sort";
import { SortHeader } from "@/components/ui/sort-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceDate: Date | string;
  dueDate?: Date | string | null;
  totalAmount: number | { toNumber(): number };
  contact: { companyName: string };
  order?: { id: string; orderNumber: string; title: string } | null;
};

const STATUS_TABS = [
  { key: "ALL", label: "Alle", icon: Files },
  { key: "ENTWURF", label: "Entwurf", icon: FileText },
  { key: "VERSENDET", label: "Versendet", icon: Send },
  { key: "BEZAHLT", label: "Bezahlt", icon: CheckCircle },
  { key: "STORNIERT", label: "Storniert", icon: XCircle },
] as const;

function toNumber(v: number | { toNumber(): number }) {
  return typeof v === "number" ? v : v.toNumber();
}

export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [sortKey, setSortKey] = useState<string | null>("invoiceDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: invoices.length };
    for (const inv of invoices) {
      counts[inv.status] = (counts[inv.status] ?? 0) + 1;
    }
    return counts;
  }, [invoices]);

  const filtered = useMemo(() => {
    const base = invoices.filter((inv) => {
      const matchesStatus = activeTab === "ALL" || inv.status === activeTab;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.contact.companyName.toLowerCase().includes(q) ||
        (inv.order?.title ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "invoiceNumber") return item.invoiceNumber;
      if (key === "contact") return item.contact.companyName;
      if (key === "totalAmount") return toNumber(item.totalAmount);
      if (key === "status") return item.status;
      if (key === "invoiceDate") return new Date(item.invoiceDate);
      return (item as Record<string, unknown>)[key];
    });
  }, [invoices, search, activeTab, sortKey, sortDir]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await deleteInvoice(deleteId);
    toast.success("Rechnung gelöscht");
    router.refresh();
  }

  return (
    <>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Rechnung löschen"
        description="Diese Rechnung wird unwiderruflich gelöscht."
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

        {/* Search + New Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Nummer, Empfänger, Auftrag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Link
            href="/rechnungen/neu"
            className="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Neue Rechnung
          </Link>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            headline="Keine Rechnungen gefunden"
            subline="Passe die Suchfilter an oder erstelle eine neue Rechnung."
            ctaLabel="Neue Rechnung erstellen"
            ctaHref="/rechnungen/neu"
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filtered.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/rechnungen/${inv.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold text-gray-900">{inv.invoiceNumber}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{inv.contact.companyName}</p>
                      {inv.order && (
                        <p className="text-xs text-gray-400 truncate">{inv.order.orderNumber} – {inv.order.title}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={inv.status} />
                        <span className="text-xs font-semibold text-gray-900 font-mono">
                          {toNumber(inv.totalAmount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {inv.status === "ENTWURF" && (
                        <button
                          onClick={(e) => handleDelete(e, inv.id)}
                          className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                <SortHeader label="Nummer" sortKey="invoiceNumber" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Empfänger / Auftrag" sortKey="contact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Datum" sortKey="invoiceDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Betrag" sortKey="totalAmount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
              </div>

              {filtered.map((inv, i) => (
                <Link
                  key={inv.id}
                  href={`/rechnungen/${inv.id}`}
                  className={`grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
                    i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <span className="text-sm font-mono font-semibold text-gray-900 truncate">{inv.invoiceNumber}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{inv.contact.companyName}</p>
                    {inv.order && (
                      <p className="text-xs text-gray-400 truncate">{inv.order.orderNumber} – {inv.order.title}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">
                      {format(new Date(inv.invoiceDate), "dd.MM.yyyy", { locale: de })}
                    </p>
                    {inv.dueDate && (
                      <p className="text-xs text-gray-400">
                        Fällig: {format(new Date(inv.dueDate), "dd.MM.yyyy", { locale: de })}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">
                    {toNumber(inv.totalAmount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </span>
                  <div>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
                    {inv.status === "ENTWURF" && (
                      <button
                        onClick={(e) => handleDelete(e, inv.id)}
                        className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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
