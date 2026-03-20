"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, ChevronRight, Banknote } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const statusLabels: Record<string, string> = {
  ALL: "Alle Status",
  OFFEN: "Offen",
  OVERDUE: "Überfällig",
  BEZAHLT: "Bezahlt",
};

function isOverdue(m: Milestone) {
  return m.status === "OFFEN" && m.dueDate && new Date(m.dueDate) < new Date();
}

export function ZahlungenList({ milestones, orders }: { milestones: Milestone[], orders: OrderOption[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showOrderSelect, setShowOrderSelect] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const overdueCount = useMemo(() => milestones.filter(isOverdue).length, [milestones]);
  const openAmount = useMemo(
    () => milestones.filter((m) => m.status === "OFFEN").reduce((s, m) => s + m.amount, 0),
    [milestones]
  );

  const filtered = useMemo(() => {
    return milestones.filter((m) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.order.contact.companyName.toLowerCase().includes(q) ||
        m.order.title.toLowerCase().includes(q) ||
        (m.assignedTo ?? "").toLowerCase().includes(q);

      if (statusFilter === "ALL") return matchesSearch;
      if (statusFilter === "BEZAHLT") return matchesSearch && m.status === "BEZAHLT";
      if (statusFilter === "OVERDUE") return matchesSearch && isOverdue(m);
      if (statusFilter === "OFFEN") return matchesSearch && m.status === "OFFEN" && !isOverdue(m);
      return matchesSearch;
    });
  }, [milestones, search, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Bezeichnung, Kontakt, Auftrag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue>{statusLabels[statusFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Status</SelectItem>
            <SelectItem value="OFFEN">Offen</SelectItem>
            <SelectItem value="OVERDUE">Überfällig</SelectItem>
            <SelectItem value="BEZAHLT">Bezahlt</SelectItem>
          </SelectContent>
        </Select>
        {overdueCount > 0 && (
          <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
            {overdueCount} überfällig
          </span>
        )}
        <span className="text-xs text-gray-400 hidden sm:block">
          {openAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })} ausstehend
        </span>
        <div className="ml-auto flex items-center gap-2">
          {showOrderSelect ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="h-9 rounded-lg border border-gray-200 text-sm px-2.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Auftrag wählen...</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.orderNumber} – {o.title}</option>
                ))}
              </select>
              <button
                onClick={() => { if (selectedOrderId) router.push(`/auftraege/${selectedOrderId}?tab=Zahlungen&neu=1`); }}
                disabled={!selectedOrderId}
                className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Weiter
              </button>
              <button onClick={() => { setShowOrderSelect(false); setSelectedOrderId(""); }} className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Abbrechen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowOrderSelect(true)}
              className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
            >
              + Neu
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Keine Zahlungen gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_16px] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/80">
            {["", "Bezeichnung", "Typ", "Betrag", "Fällig am", "Auftrag", ""].map((h, i) => (
              <span key={i} className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((m, i) => {
            const overdue = isOverdue(m);
            const paid = m.status === "BEZAHLT";
            return (
              <div
                key={m.id}
                onClick={() => router.push(`/auftraege/${m.order.id}?tab=Zahlungen`)}
                className={`flex md:grid md:grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_16px] gap-3 px-4 py-2 items-center cursor-pointer hover:bg-gray-50/60 transition-colors group ${
                  i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                } ${overdue ? "bg-red-50/30" : ""}`}
              >
                {/* Icon */}
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                  paid ? "bg-green-50" : overdue ? "bg-red-50" : "bg-amber-50"
                }`}>
                  <Banknote className={`h-3.5 w-3.5 ${
                    paid ? "text-green-500" : overdue ? "text-red-500" : "text-amber-500"
                  }`} />
                </div>

                {/* Bezeichnung */}
                <div className="min-w-0 flex-1 md:flex-none overflow-hidden">
                  <span className="text-sm font-medium text-gray-900 truncate block">{m.title}</span>
                  {m.notes && <span className="text-xs text-gray-400 truncate block italic">{m.notes}</span>}
                </div>

                {/* Typ */}
                <div className="hidden md:block">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeColors[m.type] ?? "bg-gray-100 text-gray-600"}`}>
                    {typeLabels[m.type] ?? m.type}
                  </span>
                </div>

                {/* Betrag */}
                <span className="hidden md:block text-xs text-gray-700 font-mono font-medium">
                  {m.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>

                {/* Fällig am */}
                <span className={`hidden md:block text-xs ${overdue ? "text-red-600 font-medium" : paid ? "text-gray-400" : "text-gray-500"}`}>
                  {m.dueDate ? format(new Date(m.dueDate), "dd.MM.yyyy", { locale: de }) : "–"}
                </span>

                {/* Auftrag */}
                <div className="hidden md:block min-w-0">
                  <span className="text-xs text-gray-700 truncate block">{m.order.contact.companyName}</span>
                  <span className="text-xs text-gray-400 truncate block">{m.order.title}</span>
                </div>

                {/* Chevron */}
                <div className="flex items-center justify-end">
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
