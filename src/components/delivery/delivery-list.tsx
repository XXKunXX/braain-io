"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, SlidersHorizontal, Trash2 } from "lucide-react";
import type { Contact, DeliveryNote, Order } from "@prisma/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteDeliveryNote } from "@/actions/delivery-notes";
import { toast } from "sonner";
import { sortItems } from "@/lib/sort";
import { SortHeader } from "@/components/ui/sort-header";

type DeliveryWithRelations = Omit<DeliveryNote, "quantity"> & {
  quantity: number;
  contact: Contact;
  order: Order | null;
};

export function DeliveryList({ deliveryNotes }: { deliveryNotes: DeliveryWithRelations[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<string | null>("deliveryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Unique contacts for filter
  const contacts = useMemo(() => {
    const map = new Map<string, string>();
    for (const dn of deliveryNotes) map.set(dn.contact.id, dn.contact.companyName);
    return Array.from(map.entries());
  }, [deliveryNotes]);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const base = deliveryNotes.filter((dn) => {
      const matchesContact = contactFilter === "ALL" || dn.contactId === contactFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        dn.deliveryNumber.toLowerCase().includes(q) ||
        dn.contact.companyName.toLowerCase().includes(q) ||
        dn.material.toLowerCase().includes(q) ||
        (dn.driver ?? "").toLowerCase().includes(q);
      return matchesContact && matchesSearch;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "number") return item.deliveryNumber;
      if (key === "deliveryDate") return new Date(item.date);
      if (key === "quantity") return item.quantity;
      return (item as Record<string, unknown>)[key];
    });
  }, [deliveryNotes, search, contactFilter, sortKey, sortDir]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Lieferschein wirklich löschen?")) return;
    await deleteDeliveryNote(id);
    toast.success("Lieferschein gelöscht");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Nr., Kontakt, Material, Fahrer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={contactFilter} onValueChange={(v) => v && setContactFilter(v)}>
          <SelectTrigger className="w-52 bg-white gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <SelectValue>
              {contactFilter === "ALL"
                ? "Alle Kontakte"
                : contacts.find(([id]) => id === contactFilter)?.[1] ?? "Alle Kontakte"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Kontakte</SelectItem>
            {contacts.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Keine Lieferscheine gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[minmax(0,2fr)_1.5fr_1fr_1fr_1fr_32px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
            <SortHeader label="Lieferschein" sortKey="number" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Material</span>
            <SortHeader label="Datum" sortKey="deliveryDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Menge" sortKey="quantity" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Fahrer</span>
            <span />
          </div>

          {/* Rows */}
          {filtered.map((dn, i) => (
            <Link
              key={dn.id}
              href={`/lieferscheine/${dn.id}`}
              className={`grid grid-cols-[minmax(0,2fr)_1.5fr_1fr_1fr_1fr_32px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${
                i !== filtered.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* Lieferschein Nr. + Kontakt */}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{dn.deliveryNumber}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{dn.contact.companyName}</p>
              </div>

              {/* Material */}
              <span className="text-sm text-gray-600 truncate">{dn.material}</span>

              {/* Datum */}
              <span className="text-sm text-gray-600 whitespace-nowrap">
                {format(new Date(dn.date), "dd.MM.yy", { locale: de })}
              </span>

              {/* Menge */}
              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                {dn.quantity.toLocaleString("de-DE")} {dn.unit}
              </span>

              {/* Fahrer */}
              <span className="text-sm text-gray-500 truncate">{dn.driver ?? "–"}</span>

              {/* Delete */}
              <button
                onClick={(e) => handleDelete(e, dn.id)}
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
