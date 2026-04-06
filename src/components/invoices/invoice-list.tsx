"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, ChevronRight, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";
import { getContactName } from "@/lib/utils";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceDate: Date | string;
  dueDate?: Date | string | null;
  totalAmount: number | { toNumber(): number };
  contact: { companyName: string | null; firstName?: string | null; lastName?: string | null };
  order?: { id: string; orderNumber: string; title: string } | null;
};

const STATUS_FILTERS = [
  { key: "BEZAHLT",   label: "Bezahlt",   icon: CheckCircle },
  { key: "STORNIERT", label: "Storniert", icon: XCircle },
] as const;

const ACTIVE_DEFAULT = ["BEZAHLT", "STORNIERT"];

function toNumber(v: number | { toNumber(): number }) {
  return typeof v === "number" ? v : v.toNumber();
}

export function InvoiceArchive({ invoices }: { invoices: InvoiceRow[] }) {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>(ACTIVE_DEFAULT);
  const [sortKey, setSortKey] = useState<string | null>("invoiceDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function toggleFilter(key: string) {
    setActiveFilters(prev =>
      prev.includes(key)
        ? prev.length === 1 ? prev : prev.filter(k => k !== key)
        : [...prev, key]
    );
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inv of invoices) {
      counts[inv.status] = (counts[inv.status] ?? 0) + 1;
    }
    return counts;
  }, [invoices]);

  const filtered = useMemo(() => {
    const base = invoices.filter((inv) => {
      const matchesStatus = activeFilters.includes(inv.status);
      const matchesText = matchesSearch(search, inv.invoiceNumber, getContactName(inv.contact), inv.order?.title);
      return matchesStatus && matchesText;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "invoiceNumber") return item.invoiceNumber;
      if (key === "contact") return getContactName(item.contact);
      if (key === "totalAmount") return toNumber(item.totalAmount);
      if (key === "status") return item.status;
      if (key === "invoiceDate") return new Date(item.invoiceDate);
      return (item as Record<string, unknown>)[key];
    });
  }, [invoices, search, activeFilters, sortKey, sortDir]);

  return (
    <div className="max-w-5xl space-y-4">
      {/* Status Filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(({ key, label, icon: Icon }) => {
          const active = activeFilters.includes(key);
          const count = statusCounts[key] ?? 0;
          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border whitespace-nowrap ${
                active
                  ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {count > 0 && (
                <span className={`text-xs ${active ? "text-gray-500" : "text-gray-400"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Nummer, Empfänger, Auftrag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Mobile */}
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
                <p className="text-xs text-gray-500 truncate mt-0.5">{getContactName(inv.contact)}</p>
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
              <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0 mt-1" />
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[100px_minmax(0,2fr)_110px_110px_minmax(100px,1fr)_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
          <SortHeader label="Nummer" sortKey="invoiceNumber" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
          <SortHeader label="Empfänger / Auftrag" sortKey="contact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
          <SortHeader label="Datum" sortKey="invoiceDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
          <SortHeader label="Betrag" sortKey="totalAmount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
          <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
          <span />
        </div>

        {filtered.map((inv, i) => (
          <Link
            key={inv.id}
            href={`/rechnungen/${inv.id}`}
            className={`grid grid-cols-[100px_minmax(0,2fr)_110px_110px_minmax(100px,1fr)_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${
              i !== filtered.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span className="text-sm font-mono font-semibold text-gray-900 truncate">{inv.invoiceNumber}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{getContactName(inv.contact)}</p>
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
            <StatusBadge status={inv.status} />
            <div className="flex items-center justify-end gap-1">
              <span className="p-1"><Trash2 className="h-3.5 w-3.5 text-gray-200" /></span>
              <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
