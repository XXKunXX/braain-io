"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2, Search, ChevronRight, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteQuote } from "@/actions/quotes";
import { toast } from "sonner";
import type { Contact, Quote, QuoteItem } from "@prisma/client";

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

const statusLabels: Record<string, string> = {
  DRAFT: "Entwurf",
  SENT: "Gesendet",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-50 text-red-700",
};

const allStatuses = Object.entries(statusLabels);

export function QuoteList({
  quotes: initialQuotes,
  currentStatus,
}: {
  quotes: QuoteWithRelations[];
  currentStatus?: string;
}) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(currentStatus ?? "ALL");

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      const matchesSearch =
        !search ||
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.contact.companyName.toLowerCase().includes(search.toLowerCase()) ||
        q.quoteNumber.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotes, search, statusFilter]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Angebot wirklich löschen?")) return;
    await deleteQuote(id);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    toast.success("Angebot gelöscht");
  }

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Titel, Kontakt, Nummer..."
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
          <p className="text-sm">Keine Angebote gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/80">
            {["", "Titel", "Kontakt", "Betrag", "Status", "Erstellt am", ""].map((h, i) => (
              <span key={i} className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((quote, i) => (
            <Link
              key={quote.id}
              href={`/angebote/${quote.id}`}
              className={`flex md:grid md:grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 items-center hover:bg-gray-50/60 transition-colors group ${
                i !== filtered.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Icon */}
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-amber-50">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
              </div>

              {/* Titel + Nummer */}
              <div className="min-w-0 flex-1 md:flex-none flex items-center gap-2 overflow-hidden">
                <span className="text-sm font-medium text-gray-900 truncate">{quote.title}</span>
                <span className="text-xs text-gray-400 flex-shrink-0 hidden lg:inline">{quote.quoteNumber}</span>
              </div>

              {/* Kontakt */}
              <span className="hidden md:block text-xs text-gray-500 truncate">{quote.contact.companyName}</span>

              {/* Betrag */}
              <span className="hidden md:block text-xs text-gray-500 font-mono">
                {Number(quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </span>

              {/* Status badge */}
              <div className="hidden md:block">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[quote.status]}`}>
                  {statusLabels[quote.status]}
                </span>
              </div>

              {/* Erstellt am */}
              <span className="hidden md:block text-xs text-gray-500">
                {format(new Date(quote.createdAt), "dd.MM.yyyy", { locale: de })}
              </span>

              {/* Right: chevron + delete on hover */}
              <div className="flex items-center justify-end">
                <button
                  onClick={(e) => handleDelete(e, quote.id)}
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
