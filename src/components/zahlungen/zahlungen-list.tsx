"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Search, ChevronRight, Plus, Files, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { RelativeDate } from "@/components/ui/relative-date";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sortItems } from "@/lib/sort";
import { SortHeader } from "@/components/ui/sort-header";

type OrderOption = { id: string; title: string; orderNumber: string };

type Milestone = {
  id: string;
  title: string;
  type: string;
  amount: number;
  dueDate: Date | null;
  status: string;
  assignedTo: string | null;
  notes: string | null;
  orderId: string;
  order: {
    id: string;
    title: string;
    orderNumber: string;
    contact: { companyName: string };
  };
};

const STATUS_TABS = [
  { key: "ALL", label: "Alle", icon: Files },
  { key: "OFFEN", label: "Offen", icon: Clock },
  { key: "OVERDUE", label: "Überfällig", icon: AlertTriangle },
  { key: "BEZAHLT", label: "Bezahlt", icon: CheckCircle },
] as const;

const typeLabels: Record<string, string> = {
  ANZAHLUNG: "Anzahlung",
  ZWISCHENRECHNUNG: "Zwischenrechnung",
  SCHLUSSRECHNUNG: "Schlussrechnung",
};

const typeColors: Record<string, string> = {
  ANZAHLUNG: "bg-blue-50 text-blue-700",
  ZWISCHENRECHNUNG: "bg-purple-50 text-purple-700",
  SCHLUSSRECHNUNG: "bg-gray-100 text-gray-600",
};

function isOverdue(m: Milestone) {
  return m.status === "OFFEN" && m.dueDate && new Date(m.dueDate) < new Date();
}

export function ZahlungenList({ milestones, orders }: { milestones: Milestone[], orders: OrderOption[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [showOrderSelect, setShowOrderSelect] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const overdueCount = useMemo(() => milestones.filter(isOverdue).length, [milestones]);
  const openAmount = useMemo(
    () => milestones.filter((m) => m.status === "OFFEN").reduce((s, m) => s + m.amount, 0),
    [milestones]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: milestones.length };
    for (const m of milestones) {
      if (isOverdue(m)) {
        counts["OVERDUE"] = (counts["OVERDUE"] ?? 0) + 1;
      } else {
        counts[m.status] = (counts[m.status] ?? 0) + 1;
      }
    }
    return counts;
  }, [milestones]);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const base = milestones.filter((m) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.order.contact.companyName.toLowerCase().includes(q) ||
        m.order.title.toLowerCase().includes(q) ||
        (m.assignedTo ?? "").toLowerCase().includes(q);

      if (activeTab === "ALL") return matchesSearch;
      if (activeTab === "BEZAHLT") return matchesSearch && m.status === "BEZAHLT";
      if (activeTab === "OVERDUE") return matchesSearch && isOverdue(m);
      if (activeTab === "OFFEN") return matchesSearch && m.status === "OFFEN" && !isOverdue(m);
      return matchesSearch;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "title") return item.title;
      if (key === "type") return item.type;
      if (key === "amount") return item.amount;
      if (key === "dueDate") return item.dueDate ? new Date(item.dueDate) : new Date("9999");
      if (key === "status") return item.status;
      if (key === "order") return item.order?.title ?? "";
      return (item as Record<string, unknown>)[key];
    });
  }, [milestones, search, activeTab, sortKey, sortDir]);

  return (
    <div className="space-y-5">
      {/* Status Tabs */}
      <div className="overflow-hidden">
        <div className="flex items-center gap-1">
          {STATUS_TABS.map(({ key, label, icon: Icon }) => (
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
                <span className={`text-xs ${key === "OVERDUE" && activeTab !== "OVERDUE" ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                  ({tabCounts[key]})
                </span>
              )}
            </button>
          ))}
          {openAmount > 0 && (
            <span className="ml-2 text-xs text-gray-400 hidden sm:block">
              {openAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })} ausstehend
            </span>
          )}
        </div>
      </div>

      {/* Search + CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Bezeichnung, Kontakt, Auftrag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        {showOrderSelect ? (
          <div className="flex items-center gap-2">
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger className="h-9 w-56 bg-white">
                <SelectValue placeholder="Auftrag wählen..." />
              </SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.orderNumber} – {o.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => { if (selectedOrderId) router.push(`/auftraege/${selectedOrderId}?tab=Zahlungen&neu=1`); }}
              disabled={!selectedOrderId}
              className="h-9 px-3.5"
            >
              Weiter
            </Button>
            <Button variant="outline" onClick={() => { setShowOrderSelect(false); setSelectedOrderId(""); }} className="h-9 px-3">
              Abbrechen
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowOrderSelect(true)}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Neue Zahlung
          </Button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Banknote}
          headline="Keine Zahlungen gefunden"
          subline="Passe die Suchfilter an. Zahlungsmeilensteine werden in Aufträgen angelegt."
        />
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filtered.map((m) => {
              const overdue = isOverdue(m);
              const paid = m.status === "BEZAHLT";
              return (
                <div
                  key={m.id}
                  onClick={() => router.push(`/auftraege/${m.order.id}?tab=Zahlungen`)}
                  className={`bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-colors ${
                    overdue ? "border-l-4 border-l-red-400" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 truncate">{m.order.contact.companyName}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeColors[m.type] ?? "bg-gray-100 text-gray-600"}`}>
                          {typeLabels[m.type] ?? m.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm font-semibold text-gray-900 font-mono">
                          {m.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                        </span>
                        {m.dueDate && (
                          <span className="text-xs">
                            <RelativeDate date={m.dueDate} overdue={overdue} />
                          </span>
                        )}
                        {paid && <span className="text-xs text-green-600 font-medium">Bezahlt</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0 mt-1" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <SortHeader label="Bezeichnung" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Typ" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Betrag" sortKey="amount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Fällig am" sortKey="dueDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Auftrag" sortKey="order" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</span>
            </div>

            {filtered.map((m, i) => {
              const overdue = isOverdue(m);
              const paid = m.status === "BEZAHLT";
              return (
                <div
                  key={m.id}
                  onClick={() => router.push(`/auftraege/${m.order.id}?tab=Zahlungen`)}
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_56px] gap-4 px-5 py-3.5 items-center cursor-pointer hover:bg-gray-50 transition-colors ${
                    i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                  } ${overdue ? "bg-red-50 border-l-4 border-l-red-400 !pl-3" : ""}`}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate block">{m.title}</span>
                    {m.notes && <span className="text-xs text-gray-400 truncate block italic">{m.notes}</span>}
                  </div>
                  <div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeColors[m.type] ?? "bg-gray-100 text-gray-600"}`}>
                      {typeLabels[m.type] ?? m.type}
                    </span>
                  </div>
                  <span className="text-sm text-gray-700 font-mono font-medium">
                    {m.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </span>
                  <div className="text-sm">
                    {m.dueDate ? (
                      <RelativeDate date={m.dueDate} overdue={overdue} />
                    ) : (
                      <span className="text-gray-300">–</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700 truncate block">{m.order.contact.companyName}</span>
                    <span className="text-xs text-gray-400 truncate block">{m.order.title}</span>
                  </div>
                  <div className="flex items-center justify-end">
                    {paid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : overdue ? (
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
