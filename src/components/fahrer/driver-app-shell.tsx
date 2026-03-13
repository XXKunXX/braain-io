"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MapPin, Calendar, ClipboardList } from "lucide-react";

type OrderItem = {
  id: string;
  title: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  startDate: string;
  endDate: string;
  contact: {
    companyName: string;
    address: string;
    postalCode: string;
    city: string;
  };
  siteAddress: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
};

const STATUS_STYLE: Record<string, string> = {
  PLANNED: "border border-amber-300 text-amber-600 bg-amber-50",
  ACTIVE: "border border-blue-300 text-blue-600 bg-blue-50",
  COMPLETED: "border border-green-300 text-green-600 bg-green-50",
};

type Tab = "active" | "completed" | "all";

export function DriverAppShell({
  orders,
  userName,
  selectedDate,
}: {
  orders: OrderItem[];
  userName: string;
  selectedDate: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");

  const date = parseISO(selectedDate);

  function navigate(delta: number) {
    const newDate = addDays(date, delta);
    router.push(`/fahrer?date=${format(newDate, "yyyy-MM-dd")}`);
  }

  const filtered = orders.filter((o) => {
    if (tab === "active") return o.status === "PLANNED" || o.status === "ACTIVE";
    if (tab === "completed") return o.status === "COMPLETED";
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "active", label: "Aktive Aufträge" },
    { key: "completed", label: "Abgeschlossen" },
    { key: "all", label: "Alle" },
  ];

  return (
    <>
      {/* ── Mobile (< md) ── */}
      <div className="md:hidden px-4 py-6 max-w-lg mx-auto">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Fahrer-App</p>
          <h1 className="text-2xl font-bold text-gray-900">Willkommen, {userName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {format(date, "EEEE, dd. MMMM yyyy", { locale: de })}
          </p>
        </div>
        <DateNav date={date} onNavigate={navigate} />
        <div className="flex gap-2 mb-5 mt-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab === t.key ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <MobileOrderList orders={filtered} />
      </div>

      {/* ── Tablet / Desktop (≥ md) ── */}
      <div className="hidden md:block">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
          <div className="grid grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr] gap-8">

            {/* Left sticky sidebar */}
            <div className="sticky top-[73px] self-start space-y-4">
              <div>
                <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Fahrer-App</p>
                <h1 className="text-2xl font-bold text-gray-900">Willkommen,</h1>
                <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
                <p className="text-sm text-gray-400 mt-1">
                  {format(date, "EEEE, dd. MMMM yyyy", { locale: de })}
                </p>
              </div>

              <DateNav date={date} onNavigate={navigate} />

              {/* Vertical tab list */}
              <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-100">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                      tab === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Count card */}
              <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
                  <p className="text-xs text-gray-400">
                    {filtered.length === 1 ? "Auftrag" : "Aufträge"} heute
                  </p>
                </div>
              </div>
            </div>

            {/* Right: order list */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-4">
                {format(date, "EEEE, dd. MMMM yyyy", { locale: de })}
              </h2>
              {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl">
                  <p className="text-gray-400 text-sm">Keine Aufträge für diesen Tag</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((order) => {
                    const address = order.siteAddress
                      ?? [order.contact.address, order.contact.postalCode, order.contact.city].filter(Boolean).join(" ");
                    return (
                      <Link
                        key={order.id}
                        href={`/fahrer/${order.id}`}
                        className="flex items-center bg-white rounded-2xl px-5 py-4 hover:shadow-sm transition-all group border border-transparent hover:border-gray-200"
                      >
                        <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_auto] gap-4 items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{order.contact.companyName}</p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{order.title}</p>
                          </div>
                          <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                            {address ? (
                              <><MapPin className="h-3 w-3 flex-shrink-0 text-gray-400" />{address}</>
                            ) : "—"}
                          </p>
                          <div className="flex items-center gap-3">
                            <p className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(order.startDate), "dd. MMM", { locale: de })}
                            </p>
                            <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[order.status]}`}>
                              {STATUS_LABEL[order.status]}
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DateNav({ date, onNavigate }: { date: Date; onNavigate: (d: number) => void }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3">
      <button onClick={() => onNavigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold text-gray-700">
        {format(date, "dd. MMMM yyyy", { locale: de })}
      </span>
      <button onClick={() => onNavigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function MobileOrderList({ orders }: { orders: OrderItem[] }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm">Keine Aufträge für diesen Tag</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-100">
      {orders.map((order) => {
        const address = order.siteAddress
          ?? [order.contact.address, order.contact.postalCode, order.contact.city].filter(Boolean).join(" ");
        return (
          <Link
            key={order.id}
            href={`/fahrer/${order.id}`}
            className="flex items-center px-4 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{order.contact.companyName}</p>
              {address && (
                <p className="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3 flex-shrink-0" />{address}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                {format(parseISO(order.startDate), "dd. MMM yyyy", { locale: de })}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_STYLE[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
