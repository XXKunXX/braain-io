"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, SlidersHorizontal, Trash2 } from "lucide-react";
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
  PLANNED: "border border-blue-200 text-blue-700 bg-blue-50",
  ACTIVE: "border border-green-300 text-green-700 bg-green-50",
  COMPLETED: "border border-gray-200 text-gray-500 bg-gray-50",
};

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
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Projekt, Kontakt, Baustelle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-48 bg-white gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <SelectValue>{statusFilter === "ALL" ? "Alle Status" : statusLabels[statusFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Status</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Keine Aufträge gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[minmax(0,2.5fr)_1.5fr_1fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Projekt</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Baustelle</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Zeitraum</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Summe</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</span>
            <span />
          </div>

          {/* Rows */}
          {filtered.map((order, i) => (
            <Link
              key={order.id}
              href={`/auftraege/${order.id}`}
              className={`grid grid-cols-[minmax(0,2.5fr)_1.5fr_1fr_1fr_1fr_32px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${
                i !== filtered.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Projekt */}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{order.title}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{order.contact.companyName}</p>
              </div>

              {/* Baustelle */}
              <span className="text-sm text-gray-600 truncate">
                {order.quote?.siteAddress ?? "–"}
              </span>

              {/* Zeitraum */}
              <span className="text-sm text-gray-600 whitespace-nowrap">
                {format(new Date(order.startDate), "dd.MM.yy", { locale: de })} –{" "}
                {format(new Date(order.endDate), "dd.MM.yy", { locale: de })}
              </span>

              {/* Summe */}
              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                {order.quote
                  ? Number(order.quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                  : "–"}
              </span>

              {/* Status */}
              <div>
                <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
              </div>

              {/* Delete */}
              <button
                onClick={(e) => handleDelete(e, order.id)}
                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
