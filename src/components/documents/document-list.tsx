"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  FileText,
  Truck,
  Paperclip,
  Download,
  ExternalLink,
  Search,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface UnifiedDocument {
  id: string;
  type: "ANGEBOT" | "LIEFERSCHEIN" | "ANHANG";
  title: string;
  number?: string;
  status: string | null;
  contactId?: string;
  contactName?: string;
  linkedTo?: { label: string; href: string };
  url: string;
  meta?: string;
  mimeType?: string;
  createdAt: Date;
}

const TYPE_CONFIG = {
  ANGEBOT: {
    label: "Angebot",
    icon: FileText,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    badge: "bg-blue-50 text-blue-700",
  },
  LIEFERSCHEIN: {
    label: "Lieferschein",
    icon: Truck,
    iconBg: "bg-green-50",
    iconColor: "text-green-500",
    badge: "bg-green-50 text-green-700",
  },
  ANHANG: {
    label: "Anhang",
    icon: Paperclip,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
    badge: "bg-gray-100 text-gray-600",
  },
};

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Entwurf", color: "bg-gray-100 text-gray-500" },
  SENT: { label: "Gesendet", color: "bg-blue-50 text-blue-700" },
  ACCEPTED: { label: "Angenommen", color: "bg-green-50 text-green-700" },
  REJECTED: { label: "Abgelehnt", color: "bg-red-50 text-red-600" },
};

interface DocumentListProps {
  documents: UnifiedDocument[];
  contacts: { id: string; name: string }[];
}

export function DocumentList({ documents, contacts }: DocumentListProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [contactFilter, setContactFilter] = useState("ALL");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return documents.filter((d) => {
      if (typeFilter !== "ALL" && d.type !== typeFilter) return false;
      if (contactFilter !== "ALL" && d.contactId !== contactFilter) return false;
      if (q) {
        const haystack = [d.title, d.number, d.contactName, d.meta].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [documents, search, typeFilter, contactFilter]);

  const isPdf = (doc: UnifiedDocument) =>
    doc.type === "ANGEBOT" || doc.type === "LIEFERSCHEIN" || doc.mimeType === "application/pdf";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Dokument suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue>{typeFilter === "ALL" ? "Alle Typen" : TYPE_CONFIG[typeFilter as keyof typeof TYPE_CONFIG]?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Alle Typen</SelectItem>
            <SelectItem value="ANGEBOT">Angebote</SelectItem>
            <SelectItem value="LIEFERSCHEIN">Lieferscheine</SelectItem>
            <SelectItem value="ANHANG">Anhänge</SelectItem>
          </SelectContent>
        </Select>

        {contacts.length > 0 && (
          <Select value={contactFilter} onValueChange={(v) => v && setContactFilter(v)}>
            <SelectTrigger className="w-48 bg-white">
              <SelectValue>
                {contactFilter === "ALL" ? "Alle Kontakte" : contacts.find((c) => c.id === contactFilter)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Kontakte</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {filtered.length !== documents.length && (
          <span className="text-xs text-gray-400">{filtered.length} von {documents.length}</span>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine Dokumente gefunden</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[auto_minmax(0,2fr)_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
            {["", "Dokument", "Kontakt", "Verknüpft mit", "Datum", ""].map((h, i) => (
              <span key={i} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
            ))}
          </div>

          {filtered.map((doc, i) => {
            const cfg = TYPE_CONFIG[doc.type];
            const Icon = cfg.icon;
            const statusInfo = doc.status ? QUOTE_STATUS[doc.status] : null;

            return (
              <div
                key={`${doc.type}-${doc.id}`}
                className={`flex md:grid md:grid-cols-[auto_minmax(0,2fr)_1fr_1fr_1fr_auto] gap-3 md:gap-4 px-4 md:px-5 py-3.5 items-center ${
                  i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                  <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
                </div>

                {/* Title */}
                <div className="min-w-0 flex-1 md:flex-none">
                  <div className="flex items-center gap-2 flex-wrap">
                    {doc.number && (
                      <span className="text-xs font-mono font-medium text-gray-500 flex-shrink-0">{doc.number}</span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    {statusInfo && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{doc.title}</p>
                  {doc.meta && <p className="text-xs text-gray-400 mt-0.5">{doc.meta}</p>}
                </div>

                {/* Contact */}
                <div className="hidden md:flex items-center gap-1.5 min-w-0">
                  {doc.contactName ? (
                    doc.contactId ? (
                      <Link
                        href={`/kontakte/${doc.contactId}`}
                        className="flex items-center gap-1.5 hover:text-blue-600 transition-colors min-w-0"
                      >
                        <Building2 className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                        <span className="text-sm text-gray-600 truncate">{doc.contactName}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-500 truncate">{doc.contactName}</span>
                    )
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>

                {/* Linked to */}
                <div className="hidden md:block min-w-0">
                  {doc.linkedTo ? (
                    <Link
                      href={doc.linkedTo.href}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline truncate"
                    >
                      <span className="truncate">{doc.linkedTo.label}</span>
                      <ChevronRight className="h-3 w-3 flex-shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </div>

                {/* Date */}
                <div className="hidden md:block">
                  <p className="text-sm text-gray-500">{format(new Date(doc.createdAt), "dd.MM.yyyy", { locale: de })}</p>
                  <p className="text-xs text-gray-300">{format(new Date(doc.createdAt), "HH:mm", { locale: de })}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={isPdf(doc) ? "PDF öffnen" : "Herunterladen"}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {isPdf(doc) ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
