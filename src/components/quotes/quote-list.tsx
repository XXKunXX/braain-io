"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

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

  const filtered = quotes.filter((q) => {
    const matchesSearch =
      !search ||
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.contact.companyName.toLowerCase().includes(search.toLowerCase()) ||
      q.quoteNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Angebot wirklich löschen?")) return;
    await deleteQuote(id);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    toast.success("Angebot gelöscht");
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Angebote</h1>
          <p className="text-sm text-gray-500 mt-0.5">{quotes.length} Angebote</p>
        </div>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
          onClick={() => router.push("/angebote/neu")}
        >
          <Plus className="h-4 w-4 mr-1" />
          Neues Angebot
        </Button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9 h-9 rounded-lg border-gray-200 text-sm"
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v != null && setStatusFilter(v)}>
          <SelectTrigger className="h-9 w-44 rounded-lg border-gray-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Status</SelectItem>
            <SelectItem value="DRAFT">Entwurf</SelectItem>
            <SelectItem value="SENT">Gesendet</SelectItem>
            <SelectItem value="ACCEPTED">Angenommen</SelectItem>
            <SelectItem value="REJECTED">Abgelehnt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 px-6 py-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">Keine Angebote</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[11px] font-semibold tracking-wider text-gray-400 uppercase px-5 py-3">Angebotsnr.</th>
                  <th className="text-left text-[11px] font-semibold tracking-wider text-gray-400 uppercase px-5 py-3">Kontakt</th>
                  <th className="text-left text-[11px] font-semibold tracking-wider text-gray-400 uppercase px-5 py-3">Betrag</th>
                  <th className="text-left text-[11px] font-semibold tracking-wider text-gray-400 uppercase px-5 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold tracking-wider text-gray-400 uppercase px-5 py-3">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/angebote/${quote.id}`)}
                  >
                    <td className="px-5 py-3.5 text-sm font-mono text-gray-700">{quote.quoteNumber}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-700">
                      {quote.contact?.companyName ?? <span className="text-gray-400">–</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                      {Number(quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[quote.status]}`}>
                        {statusLabels[quote.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={(e) => handleDelete(e, quote.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
