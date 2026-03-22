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
import { Building2, User, ChevronRight, Search } from "lucide-react";
import { sortItems } from "@/lib/sort";
import { SortHeader } from "@/components/ui/sort-header";

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
  search?: string;
}

export function ContactList({ contacts, search: initialSearch }: ContactListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch ?? "");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const ownerNames = useMemo(() => {
    const names = contacts.map((c) => c.owner).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [contacts]);

  function handleSearch(value: string) {
    setSearch(value);
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    router.push(`/kontakte?${params.toString()}`);
  }

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const base = contacts.filter((c) =>
      (typeFilter === "ALL" || c.type === typeFilter) &&
      (ownerFilter === "ALL" || c.owner === ownerFilter)
    );
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "name") return item.companyName ?? `${item.lastName ?? ""} ${item.firstName ?? ""}`.trim();
      if (key === "type") return item.type;
      if (key === "city") return item.city;
      if (key === "owner") return (item as Contact & { owner?: string }).owner ?? "";
      return (item as Record<string, unknown>)[key];
    });
  }, [contacts, typeFilter, ownerFilter, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Name, Firma oder Ort suchen..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue>{typeFilter === "ALL" ? "Alle Typen" : typeLabels[typeFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Typen</SelectItem>
            {Object.entries(typeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine Kontakte gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Desktop header row — hidden on mobile */}
          <div className="hidden md:grid grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/80">
            <span />
            <SortHeader label="Kontakt" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Typ" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Owner" sortKey="owner" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <SortHeader label="Ort" sortKey="city" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[10px] font-semibold tracking-wider uppercase" />
            <span />
          </div>

          {filtered.map((contact, i) => {
            const isCompany = contact.type !== "PRIVATE";
            return (
              <Link
                key={contact.id}
                href={`/kontakte/${contact.id}`}
                className={`flex md:grid md:grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_16px] gap-3 px-4 py-2 items-center hover:bg-gray-50/60 transition-colors ${
                  i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                {/* Icon */}
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${isCompany ? "bg-blue-50" : "bg-purple-50"}`}>
                  {isCompany ? <Building2 className="h-3.5 w-3.5 text-blue-500" /> : <User className="h-3.5 w-3.5 text-purple-500" />}
                </div>

                {/* Name + person — single line */}
                <div className="min-w-0 flex-1 md:flex-none flex items-center gap-2 overflow-hidden">
                  <span className="text-sm font-medium text-gray-900 truncate">{contact.companyName}</span>
                  {(contact.firstName || contact.lastName) && (
                    <span className="text-xs text-gray-400 truncate hidden lg:inline">· {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}</span>
                  )}
                  <span className={`md:hidden text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeBadgeColors[contact.type]}`}>
                    {typeLabels[contact.type]}
                  </span>
                </div>

                {/* Typ badge */}
                <div className="hidden md:block">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeBadgeColors[contact.type]}`}>
                    {typeLabels[contact.type]}
                  </span>
                </div>

                {/* Owner */}
                <span className="hidden md:block text-xs text-gray-500 truncate">
                  {(contact as Contact & { owner?: string }).owner ?? "—"}
                </span>

                {/* Ort */}
                <span className="hidden md:block text-xs text-gray-500 truncate">
                  {contact.postalCode && contact.city ? `${contact.postalCode} ${contact.city}` : contact.city ?? "—"}
                </span>

                <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
