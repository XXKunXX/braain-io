"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, ChevronRight, CheckCircle, XCircle, Files } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";

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
  { key: "ALL",      label: "Alle",      icon: Files },
  { key: "BEZAHLT",  label: "Bezahlt",   icon: CheckCircle },
  { key: "STORNIERT",label: "Storniert", icon: XCircle },
] as const;

function toNumber(v: number | { toNumber(): number }) {
  return typeof v === "number" ? v : v.toNumber();
}

export function InvoiceArchive({ invoices }: { invoices: InvoiceRow[] }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [sortKey, setSortKey] = useState<string | null>("invoiceDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
      const matchesText = matchesSearch(search, inv.invoiceNumber, inv.contact.companyName, inv.order?.title);
      return matchesStatus && matchesText;
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

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1">
        {STATUS_TABS.filter(({ key }) => key === "ALL" || (tabCounts[key] ?? 0) > 0).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
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
              <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0 mt-1" />
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
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
            className={`grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
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
            <StatusBadge status={inv.status} />
            <ChevronRight className="h-4 w-4 text-gray-200" />
          </Link>
        ))}
      </div>
    </div>
  );
}
