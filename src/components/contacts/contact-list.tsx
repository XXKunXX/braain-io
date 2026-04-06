"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Contact } from "@prisma/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, User, Package2, ChevronRight, Search, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { sortItems } from "@/lib/sort";
import { matchesSearch } from "@/lib/phonetic";
import { SortHeader } from "@/components/ui/sort-header";
import { deleteContact } from "@/actions/contacts";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const TYPE_FILTERS = [
  { key: "COMPANY", label: "Firma", icon: Building2 },
  { key: "PRIVATE", label: "Privatkunde", icon: User },
  { key: "SUPPLIER", label: "Lieferant", icon: Package2 },
] as const;

const ACTIVE_DEFAULT = ["COMPANY", "PRIVATE", "SUPPLIER"];

const typeLabels: Record<string, string> = {
  COMPANY: "Firma",
  PRIVATE: "Privatkunde",
  SUPPLIER: "Lieferant",
};

const typeBadgeColors: Record<string, string> = {
  COMPANY: "bg-blue-50 text-blue-700",
  PRIVATE: "bg-purple-50 text-purple-700",
  SUPPLIER: "bg-orange-50 text-orange-700",
};

interface ContactListProps {
  contacts: Contact[];
}

export function ContactList({ contacts }: ContactListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>(ACTIVE_DEFAULT);
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const ownerNames = useMemo(() => {
    const names = contacts.map((c) => c.owner).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [contacts]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contacts) {
      counts[c.type] = (counts[c.type] ?? 0) + 1;
    }
    return counts;
  }, [contacts]);

  function handleSearch(value: string) {
    setSearch(value);
  }

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

  const filtered = useMemo(() => {
    const base = contacts.filter((c) => {
      if (!activeFilters.includes(c.type)) return false;
      if (ownerFilter !== "ALL" && c.owner !== ownerFilter) return false;
      if (!matchesSearch(search, c.companyName, c.firstName, c.lastName, c.city)) return false;
      return true;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "name") return item.type === "PRIVATE"
        ? `${item.lastName ?? ""} ${item.firstName ?? ""}`.trim()
        : item.companyName ?? "";
      if (key === "type") return item.type;
      if (key === "city") return item.city;
      if (key === "owner") return (item as Contact & { owner?: string }).owner ?? "";
      return (item as Record<string, unknown>)[key];
    });
  }, [contacts, search, activeFilters, ownerFilter, sortKey, sortDir]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteId(id);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await deleteContact(deleteId);
    toast.success("Kontakt gelöscht");
    router.refresh();
  }

  return (
    <>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Kontakt löschen"
        description="Dieser Kontakt wird unwiderruflich gelöscht."
        onConfirm={confirmDelete}
      />
      <div className="max-w-5xl space-y-5">
        {/* Type Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(({ key, label, icon: Icon }) => {
            const active = activeFilters.includes(key);
            const count = typeCounts[key] ?? 0;
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

        {/* Search + Owner filter + CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Name, Firma oder Ort suchen..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 bg-white"
              autoFocus
            />
          </div>
          {ownerNames.length > 0 && (
            <Select value={ownerFilter} onValueChange={(v) => v && setOwnerFilter(v)}>
              <SelectTrigger className="w-44 bg-white">
                <SelectValue>{ownerFilter === "ALL" ? "Alle Owner" : ownerFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Owner</SelectItem>
                {ownerNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Link href="/kontakte/neu">
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Neuer Kontakt
            </Button>
          </Link>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            headline="Keine Kontakte gefunden"
            subline="Passe die Suche an oder lege einen neuen Kontakt an."
            ctaLabel="Neuer Kontakt"
            ctaHref="/kontakte/neu"
          />
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3">
              {filtered.map((contact) => {
                const isCompany = contact.type !== "PRIVATE";
                return (
                  <Link
                    key={contact.id}
                    href={`/kontakte/${contact.id}`}
                    className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {contact.type === "PRIVATE"
                            ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"
                            : contact.companyName}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeBadgeColors[contact.type]}`}>
                            {typeLabels[contact.type]}
                          </span>
                          {contact.city && <span className="text-xs text-gray-400">{contact.city}</span>}
                          {(contact as Contact & { owner?: string }).owner && (
                            <span className="text-xs text-gray-400">{(contact as Contact & { owner?: string }).owner}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => handleDelete(e, contact.id)}
                          className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[minmax(0,2fr)_100px_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                <SortHeader label="Kontakt" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Typ" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Owner" sortKey="owner" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <SortHeader label="Ort" sortKey="city" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
                <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
              </div>

              {filtered.map((contact, i) => {
                const isCompany = contact.type !== "PRIVATE";
                return (
                  <Link
                    key={contact.id}
                    href={`/kontakte/${contact.id}`}
                    className={`grid grid-cols-[minmax(0,2fr)_100px_minmax(0,1fr)_minmax(0,1fr)_56px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
                      i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {contact.type === "PRIVATE"
                          ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—"
                          : contact.companyName}
                      </span>
                      {isCompany && (contact.firstName || contact.lastName) && (
                        <span className="text-xs text-gray-400 truncate hidden lg:inline">
                          · {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeBadgeColors[contact.type]}`}>
                        {typeLabels[contact.type]}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 truncate">
                      {(contact as Contact & { owner?: string }).owner ?? "—"}
                    </span>
                    <span className="text-sm text-gray-500 truncate">
                      {contact.postalCode && contact.city
                        ? `${contact.postalCode} ${contact.city}`
                        : contact.city ?? "—"}
                    </span>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
                      <button
                        onClick={(e) => handleDelete(e, contact.id)}
                        className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
