"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2, Search, ChevronRight, ClipboardCheck } from "lucide-react";
import type { Contact, Order, Quote } from "@prisma/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteOrder } from "@/actions/orders";
import { toast } from "sonner";

type OrderWithRelations = Order & { contact: Contact; quote: Quote | null };

const statusLabels: Record<string, string> = {
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
};

const statusColors: Record<string, string> = {
  PLANNED: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETED: "bg-gray-100 text-gray-500",
};

const allStatuses = Object.entries(statusLabels);

export function OrderList({ orders }: { orders: OrderWithRelations[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        o.title.toLowerCase().includes(q) ||
        o.contact.companyName.toLowerCase().includes(q) ||
        (o.quote?.siteAddress ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Auftrag wirklich löschen?")) return;
    await deleteOrder(id);
    toast.success("Auftrag gelöscht");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Projekt, Kontakt, Baustelle..."
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Keine Aufträge gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/80">
            {["", "Projekt", "Kontakt", "Zeitraum", "Summe", "Status", ""].map((h, i) => (
              <span key={i} className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((order, i) => (
            <Link
              key={order.id}
              href={`/auftraege/${order.id}`}
              className={`flex md:grid md:grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 items-center hover:bg-gray-50/60 transition-colors group ${
                i !== filtered.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Icon */}
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-50">
                <ClipboardCheck className="h-3.5 w-3.5 text-blue-500" />
              </div>

              {/* Projekt */}
              <div className="min-w-0 flex-1 md:flex-none flex items-center gap-2 overflow-hidden">
                <span className="text-sm font-medium text-gray-900 truncate">{order.title}</span>
              </div>

              {/* Kontakt */}
              <span className="hidden md:block text-xs text-gray-500 truncate">{order.contact.companyName}</span>

              {/* Zeitraum */}
              <span className="hidden md:block text-xs text-gray-500 whitespace-nowrap">
                {format(new Date(order.startDate), "dd.MM.yy", { locale: de })} – {format(new Date(order.endDate), "dd.MM.yy", { locale: de })}
              </span>

              {/* Summe */}
              <span className="hidden md:block text-xs text-gray-500 font-mono">
                {order.quote
                  ? Number(order.quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                  : "–"}
              </span>

              {/* Status badge */}
              <div className="hidden md:block">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
              </div>

              {/* Right: chevron + delete on hover */}
              <div className="flex items-center justify-end">
                <button
                  onClick={(e) => handleDelete(e, order.id)}
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
