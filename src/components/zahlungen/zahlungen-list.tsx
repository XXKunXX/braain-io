"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, CheckCircle, AlertTriangle, Clock,
  ChevronRight, FileText, Package, Plus, Receipt, Bell,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { getContactName } from "@/lib/utils";

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date | null;
  status: string;
  totalAmount: number;
  contact: { id: string; companyName: string | null; firstName?: string | null; lastName?: string | null; paymentReminderDays?: number | null };
  order: { id: string; orderNumber: string; title: string } | null;
};

type DeliveryNote = {
  id: string;
  deliveryNumber: string;
  date: Date;
  material: string;
  quantity: number;
  unit: string;
  contact: { id: string; companyName: string | null; firstName?: string | null; lastName?: string | null };
  order: { id: string; orderNumber: string; title: string } | null;
};

type DeliveryNoteGroup = {
  contactId: string;
  companyName: string;
  orderId: string | null;
  orderTitle: string | null;
  orderNumber: string | null;
  notes: DeliveryNote[];
};

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function isOverdue(inv: Invoice) {
  return inv.status === "VERSENDET" && inv.dueDate && new Date(inv.dueDate) < new Date();
}

function needsReminder(inv: Invoice): boolean {
  if (!isOverdue(inv) || !inv.dueDate || !inv.contact.paymentReminderDays) return false;
  return differenceInDays(new Date(), new Date(inv.dueDate)) >= inv.contact.paymentReminderDays;
}

type UrgencyLevel = 0 | 1 | 2 | 3;

function getUrgency(inv: Invoice): UrgencyLevel {
  if (isOverdue(inv)) return 0;
  if (inv.status === "ENTWURF") return 1;
  if (inv.status === "VERSENDET") return 2;
  return 3;
}

const URGENCY_CONFIG = {
  0: { label: "Überfällig",    border: "border-l-red-500",    bg: "bg-red-50/40",    badge: "bg-red-100 text-red-700",    icon: AlertTriangle, btnClass: "bg-red-500 hover:bg-red-600 text-white" },
  1: { label: "Entwurf",       border: "border-l-orange-400", bg: "bg-orange-50/30", badge: "bg-orange-100 text-orange-700", icon: FileText,      btnClass: "bg-blue-600 hover:bg-blue-700 text-white" },
  2: { label: "Versendet",     border: "border-l-blue-400",   bg: "",                badge: "bg-blue-100 text-blue-700",  icon: Clock,         btnClass: "bg-green-600 hover:bg-green-700 text-white" },
  3: { label: "",              border: "",                     bg: "",                badge: "",                           icon: Receipt,       btnClass: "" },
} as const;

const TABS = [
  { key: "offen",         label: "Offen",            icon: Clock },
  { key: "ueberfaellig",  label: "Überfällig",        icon: AlertTriangle },
  { key: "lieferscheine", label: "Nicht verrechnet",  icon: Package },
] as const;

type TabKey = typeof TABS[number]["key"];

export function OffenePostenList({
  invoices,
  deliveryNotes,
}: {
  invoices: Invoice[];
  deliveryNotes: DeliveryNote[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam === "lieferscheine" ? "lieferscheine" : tabParam === "ueberfaellig" ? "ueberfaellig" : "offen"
  );

  useEffect(() => {
    setActiveTab(tabParam === "lieferscheine" ? "lieferscheine" : tabParam === "ueberfaellig" ? "ueberfaellig" : "offen");
  }, [tabParam]);
  // Group delivery notes by contact + order
  const deliveryNoteGroups = useMemo<DeliveryNoteGroup[]>(() => {
    const map = new Map<string, DeliveryNoteGroup>();
    for (const dn of deliveryNotes) {
      const key = `${dn.contact.id}__${dn.order?.id ?? "none"}`;
      if (!map.has(key)) {
        map.set(key, {
          contactId: dn.contact.id,
          companyName: getContactName(dn.contact),
          orderId: dn.order?.id ?? null,
          orderTitle: dn.order?.title ?? null,
          orderNumber: dn.order?.orderNumber ?? null,
          notes: [],
        });
      }
      map.get(key)!.notes.push(dn);
    }
    return Array.from(map.values());
  }, [deliveryNotes]);

  const filteredInvoices = useMemo(() => {
    const q = search.toLowerCase();
    const base = invoices.filter((inv) => {
      const matchesTab =
        activeTab === "offen" ? (inv.status === "ENTWURF" || inv.status === "VERSENDET") :
        activeTab === "ueberfaellig" ? isOverdue(inv) :
        false;
      const matchesSearch = !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        getContactName(inv.contact).toLowerCase().includes(q) ||
        (inv.order?.title ?? "").toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
    return [...base].sort((a, b) => getUrgency(a) - getUrgency(b) || (a.dueDate ? new Date(a.dueDate).getTime() : 9e15) - (b.dueDate ? new Date(b.dueDate).getTime() : 9e15));
  }, [invoices, search, activeTab]);

  const filteredGroups = useMemo(() => {
    if (activeTab !== "lieferscheine") return [] as typeof deliveryNoteGroups;
    const q = search.toLowerCase();
    if (!q) return deliveryNoteGroups;
    return deliveryNoteGroups.filter(
      (g) => g.companyName.toLowerCase().includes(q) || (g.orderTitle ?? "").toLowerCase().includes(q)
    );
  }, [deliveryNoteGroups, search, activeTab]);

  const tabCounts = useMemo(() => ({
    offen: invoices.filter((i) => i.status === "ENTWURF" || i.status === "VERSENDET").length,
    ueberfaellig: invoices.filter(isOverdue).length,
    lieferscheine: deliveryNoteGroups.length,
  }), [invoices, deliveryNoteGroups]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              activeTab === key
                ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
            {tabCounts[key] > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold ${
                activeTab === key ? "bg-gray-100 text-gray-600" :
                key === "ueberfaellig" ? "bg-red-500 text-white" :
                "text-gray-400"
              }`}>
                {tabCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder={activeTab === "lieferscheine" ? "Kontakt, Auftrag..." : "Rechnungsnummer, Kontakt, Auftrag..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* ── Offene Rechnungen (Tab: offen + alle) ── */}
      {activeTab !== "lieferscheine" && (
        filteredInvoices.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">Alle Rechnungen bezahlt</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_110px_110px_130px_1fr_56px] gap-3 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              {["Kontakt", "Auftrag / Nummer", "Datum", "Fällig", "Status", "Betrag", ""].map((h) => (
                <span key={h} className={`text-[11px] font-semibold tracking-wider text-gray-400 uppercase ${h === "Betrag" ? "text-right" : ""}`}>{h}</span>
              ))}
            </div>

            <div className="divide-y divide-gray-100">
              {filteredInvoices.map((inv) => {
                const overdue = isOverdue(inv);
                const urgency = getUrgency(inv);
                const cfg = URGENCY_CONFIG[urgency];
                const StatusIcon = cfg.icon;
                const daysOverdue = overdue && inv.dueDate ? differenceInDays(new Date(), new Date(inv.dueDate)) : 0;
                const reminderDue = needsReminder(inv);

                return (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/rechnungen/${inv.id}?from=zahlungen`)}
                    className={`cursor-pointer hover:bg-gray-50/70 transition-colors border-l-4 ${cfg.border} ${cfg.bg}`}
                  >
                    {/* Mobile */}
                    <div className="md:hidden flex items-start gap-3 px-4 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">{getContactName(inv.contact)}</p>
                          {cfg.label && (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                              <StatusIcon className="h-3 w-3" />
                              {overdue ? `${daysOverdue}T überfällig` : cfg.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{inv.invoiceNumber}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{fmt(inv.totalAmount)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 self-center" />
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_110px_110px_130px_1fr_56px] gap-3 px-5 py-3.5 items-center">
                      <p className="text-sm font-medium text-gray-900 truncate">{getContactName(inv.contact)}</p>
                      <div className="min-w-0">
                        {inv.order && <p className="text-xs text-gray-400 truncate">{inv.order.orderNumber} – {inv.order.title}</p>}
                        <p className="text-xs font-mono text-gray-500">{inv.invoiceNumber}</p>
                      </div>
                      <span className="text-sm text-gray-500">
                        {format(new Date(inv.invoiceDate), "dd.MM.yyyy", { locale: de })}
                      </span>
                      <span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                        {inv.dueDate ? (
                          overdue
                            ? <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{daysOverdue}T</span>
                            : format(new Date(inv.dueDate), "dd.MM.yyyy", { locale: de })
                        ) : <span className="text-gray-300">–</span>}
                      </span>
                      <div className="flex flex-col gap-1">
                        {cfg.label && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${cfg.badge}`}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        )}
                        {reminderDue && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit bg-purple-100 text-purple-700">
                            <Bell className="h-3 w-3" />
                            Mahnung fällig
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums text-right">{fmt(inv.totalAmount)}</span>
                      <div className="flex items-center justify-end">
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ── Nicht verrechnete Lieferscheine (Tab: lieferscheine) ── */}
      {activeTab === "lieferscheine" && (
        filteredGroups.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
            <Package className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">Alle Lieferscheine sind verrechnet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <div key={`${group.contactId}__${group.orderId}`} className="bg-white border border-gray-200 rounded-xl overflow-hidden border-l-4 border-l-blue-400">
                {/* Group header */}
                <div className="flex items-center justify-between px-5 py-3 bg-blue-50/40 border-b border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{group.companyName}</p>
                    {group.orderTitle && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {group.orderNumber} – {group.orderTitle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-gray-500">
                      {group.notes.length} Lieferschein{group.notes.length !== 1 ? "e" : ""}
                    </span>
                    <Link
                      href="/rechnungen/neu"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Rechnung erstellen
                    </Link>
                  </div>
                </div>

                {/* Delivery notes */}
                <div className="divide-y divide-gray-100">
                  {group.notes.map((dn) => (
                    <div key={dn.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Package className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{dn.deliveryNumber}</span>
                        <span className="text-sm text-gray-700 truncate">{dn.material}</span>
                        <span className="text-xs text-gray-400">
                          {Number(dn.quantity).toLocaleString("de-DE")} {dn.unit}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
