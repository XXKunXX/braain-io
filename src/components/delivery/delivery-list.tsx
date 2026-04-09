"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Search, Trash2, ChevronRight, FileBox, Plus } from "lucide-react";
import type { Contact, DeliveryNote } from "@prisma/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteDeliveryNote } from "@/actions/delivery-notes";
import { toast } from "sonner";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getContactName } from "@/lib/utils";

type DeliveryWithRelations = Omit<DeliveryNote, "quantity"> & {
  quantity: number;
  contact: Contact;
  invoice: { id: string; invoiceNumber: string; status: string } | null;
  signatureUrl: string | null;
};

function DeliveryStatusBadge({ dn }: { dn: DeliveryWithRelations }) {
  if (dn.invoice) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
        verrechnet
      </span>
    );
  }
  if (dn.signatureUrl) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
        unterschrieben
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200 whitespace-nowrap">
      offen
    </span>
  );
}

export function DeliveryList({ deliveryNotes }: { deliveryNotes: DeliveryWithRelations[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState("ALL");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>("deliveryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const contacts = useMemo(() => {
    const map = new Map<string, string>();
    for (const dn of deliveryNotes) map.set(dn.contact.id, getContactName(dn.contact));
    return Array.from(map.entries());
  }, [deliveryNotes]);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const base = deliveryNotes.filter((dn) => {
      const matchesContact = contactFilter === "ALL" || dn.contactId === contactFilter;
      const matchesText = matchesSearch(search, dn.deliveryNumber, getContactName(dn.contact), dn.material, dn.driver);
      const dnStatus = dn.invoice ? "verrechnet" : dn.signatureUrl ? "unterschrieben" : "offen";
      const matchesStatus = statusFilters.size === 0 || statusFilters.has(dnStatus);
      return matchesContact && matchesText && matchesStatus;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "number") return item.deliveryNumber;
      if (key === "deliveryDate") return new Date(item.date);
      if (key === "quantity") return item.quantity;
      return (item as Record<string, unknown>)[key];
    });
  }, [deliveryNotes, search, contactFilter, sortKey, sortDir]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const result = await deleteDeliveryNote(deleteId);
    if (!result.success) {
      toast.error(result.error ?? "Lieferschein konnte nicht gelöscht werden.");
      return;
    }
    toast.success("Lieferschein gelöscht");
    router.refresh();
  }

  return (
    <>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Lieferschein löschen"
        description="Dieser Lieferschein wird unwiderruflich gelöscht."
        onConfirm={confirmDelete}
      />
      <div className="max-w-5xl space-y-5">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {([
            { key: "offen",          label: "Offen" },
            { key: "unterschrieben", label: "Unterschrieben" },
            { key: "verrechnet",     label: "Verrechnet" },
          ] as const).map(({ key, label }) => {
            const active = statusFilters.has(key);
            return (
              <button
                key={key}
                onClick={() => setStatusFilters((prev) => {
                  const next = new Set(prev);
                  if (active) next.delete(key); else next.add(key);
                  return next;
                })}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  active
                    ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search + Filter + CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Nr., Kontakt, Material, Fahrer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          {contacts.length > 1 && (
            <Select value={contactFilter} onValueChange={(v) => v && setContactFilter(v)}>
              <SelectTrigger className="w-full sm:w-52 bg-white">
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
          )}
          <Link href="/lieferscheine/neu">
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Neuer Lieferschein
            </Button>
          </Link>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileBox}
            headline="Keine Lieferscheine gefunden"
            subline="Passe die Suche an oder erstelle einen neuen Lieferschein."
            ctaLabel="Neuer Lieferschein"
            ctaHref="/lieferscheine/neu"
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filtered.map((dn) => (
                <Link
                  key={dn.id}
                  href={`/lieferscheine/${dn.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{dn.deliveryNumber}</p>
                        <DeliveryStatusBadge dn={dn} />
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{getContactName(dn.contact)}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="text-xs text-gray-600 truncate">{dn.material}</span>
                        <span className="text-xs font-semibold text-gray-900">
                          {dn.quantity.toLocaleString("de-DE")} {dn.unit}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(dn.date), "dd.MM.yy", { locale: de })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {(() => {
                        const blocked = dn.invoice?.status === "VERSENDET" || dn.invoice?.status === "BEZAHLT";
                        return (
                          <button
                            onClick={(e) => { if (!blocked) handleDelete(e, dn.id); else { e.preventDefault(); e.stopPropagation(); } }}
                            className={`p-2 transition-colors ${blocked ? "text-gray-200 cursor-not-allowed" : "text-gray-300 hover:text-red-400"}`}
                            title={blocked ? "Rechnung bereits versendet oder bezahlt" : "Löschen"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        );
                      })()}
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_100px_100px_minmax(0,1fr)_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                <SortHeader label="Lieferschein" sortKey="number" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Material</span>
                <SortHeader label="Datum" sortKey="deliveryDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Menge" sortKey="quantity" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Fahrer</span>
                <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
              </div>

              {filtered.map((dn, i) => (
                <Link
                  key={dn.id}
                  href={`/lieferscheine/${dn.id}`}
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_100px_100px_minmax(0,1fr)_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
                    i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{dn.deliveryNumber}</p>
                      <DeliveryStatusBadge dn={dn} />
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{getContactName(dn.contact)}</p>
                  </div>
                  <span className="text-sm text-gray-600 truncate">{dn.material}</span>
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    {format(new Date(dn.date), "dd.MM.yy", { locale: de })}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {dn.quantity.toLocaleString("de-DE")} {dn.unit}
                  </span>
                  <span className="text-sm text-gray-500 truncate">{dn.driver ?? "–"}</span>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
                    {(() => {
                      const blocked = dn.invoice?.status === "VERSENDET" || dn.invoice?.status === "BEZAHLT";
                      return (
                        <button
                          onClick={(e) => { if (!blocked) handleDelete(e, dn.id); else { e.preventDefault(); e.stopPropagation(); } }}
                          className={`p-1.5 transition-colors ${blocked ? "text-gray-200 cursor-not-allowed" : "text-gray-300 hover:text-red-400"}`}
                          title={blocked ? "Rechnung bereits versendet oder bezahlt" : "Löschen"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      );
                    })()}
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
