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

  function handleSearch(value: string) {
    setSearch(value);
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    router.push(`/kontakte?${params.toString()}`);
  }

  const filtered = useMemo(
    () => contacts.filter((c) => typeFilter === "ALL" || c.type === typeFilter),
    [contacts, typeFilter]
  );

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs w-full">
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
            <SelectValue placeholder="Alle Typen" />
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
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine Kontakte gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_20px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Kontakt
            </span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Kategorie
            </span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Typ
            </span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Owner
            </span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Ort
            </span>
            <span />
          </div>

          {/* Data rows */}
          {filtered.map((contact, i) => {
            const isCompany = contact.type !== "PRIVATE";
            return (
              <Link
                key={contact.id}
                href={`/kontakte/${contact.id}`}
                className={`grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_20px] gap-4 px-5 py-3 items-center hover:bg-gray-50 transition-colors ${
                  i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                {/* Name + person */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCompany ? "bg-blue-50" : "bg-purple-50"
                    }`}
                  >
                    {isCompany ? (
                      <Building2 className="h-4 w-4 text-blue-500" />
                    ) : (
                      <User className="h-4 w-4 text-purple-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {contact.companyName}
                    </p>
                    {contact.contactPerson && (
                      <p className="text-xs text-gray-400 truncate">
                        {contact.contactPerson}
                      </p>
                    )}
                  </div>
                </div>

                {/* Kategorie */}
                <span className="text-sm text-gray-500">
                  {isCompany ? "Firma" : "Person"}
                </span>

                {/* Typ badge */}
                <div>
                  <span
                    className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full ${typeBadgeColors[contact.type]}`}
                  >
                    {typeLabels[contact.type]}
                  </span>
                </div>

                {/* Owner */}
                <span className="text-sm text-gray-500 truncate">
                  {(contact as Contact & { owner?: string }).owner ?? "—"}
                </span>

                {/* Ort */}
                <span className="text-sm text-gray-500 truncate">
                  {contact.postalCode && contact.city
                    ? `${contact.postalCode} ${contact.city}`
                    : contact.city ?? "—"}
                </span>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
