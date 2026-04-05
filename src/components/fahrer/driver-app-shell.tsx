"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO, addDays, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MapPin, Clock, HardHat, Route, Building2 } from "lucide-react";
import { MapsPickerSheet } from "@/components/fahrer/nav-button";

type BaustelleItem = {
  id: string;
  name: string;
  status: "OPEN" | "DISPONIERT" | "IN_LIEFERUNG" | "VERRECHNET" | "ABGESCHLOSSEN";
  startDate: string;
  endDate: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  contactName: string | null;
  orderId: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Offen",
  DISPONIERT: "Disponiert",
  IN_LIEFERUNG: "In Lieferung",
  VERRECHNET: "Verrechnet",
  ABGESCHLOSSEN: "Abgeschlossen",
};

const STATUS_BADGE: Record<string, string> = {
  PLANNED: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-blue-100 text-blue-700",
  PENDING: "bg-rose-100 text-rose-700",
  INVOICED: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

const STATUS_ACCENT: Record<string, string> = {
  PLANNED: "bg-amber-400",
  ACTIVE: "bg-blue-500",
  PENDING: "bg-rose-500",
  INVOICED: "bg-orange-400",
  COMPLETED: "bg-emerald-500",
};

// Desktop only (keep border style)
const STATUS_STYLE: Record<string, string> = {
  PLANNED: "border border-amber-300 text-amber-600 bg-amber-50",
  ACTIVE: "border border-blue-300 text-blue-600 bg-blue-50",
  PENDING: "border border-rose-300 text-rose-600 bg-rose-50",
  INVOICED: "border border-orange-300 text-orange-600 bg-orange-50",
  COMPLETED: "border border-emerald-300 text-emerald-600 bg-emerald-50",
};

type Tab = "active" | "completed" | "all";

function getGreeting(name: string): string {
  const h = new Date().getHours();
  if (h < 10) return `Guten Morgen, ${name}`;
  if (h < 13) return `Guten Morgen, ${name}`;
  if (h < 18) return `Guten Tag, ${name}`;
  return `Guten Abend, ${name}`;
}

export function DriverAppShell({
  baustellen,
  userName,
  selectedDate,
  companyAddress,
}: {
  baustellen: BaustelleItem[];
  userName: string;
  selectedDate: string;
  companyAddress?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(interval);
  }, [router]);

  const date = parseISO(selectedDate);

  function navigate(delta: number) {
    const newDate = addDays(date, delta);
    router.push(`/fahrer?date=${format(newDate, "yyyy-MM-dd")}`);
  }

  const filtered = baustellen.filter((b) => {
    if (tab === "active") return b.status === "OPEN" || b.status === "DISPONIERT" || b.status === "IN_LIEFERUNG";
    if (tab === "completed") return b.status === "ABGESCHLOSSEN";
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "active", label: "Aktiv" },
    { key: "completed", label: "Fertig" },
    { key: "all", label: "Alle" },
  ];

  const dateLabel = isToday(date)
    ? "Heute"
    : format(date, "EEEE", { locale: de });

  return (
    <>
      {/* ── Mobile (< md) ── */}
      <div className="md:hidden">
        {/* Greeting hero */}
        <div className="bg-white px-5 pt-5 pb-4 border-b border-gray-100">
          <p className="text-[13px] font-medium text-gray-400">{dateLabel} · {format(date, "dd. MMMM yyyy", { locale: de })}</p>
          <h1 className="text-[26px] font-black text-gray-900 tracking-tight leading-tight mt-0.5">
            {getGreeting(userName)}
          </h1>
        </div>

        {/* Date nav */}
        <div className="bg-white border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-[14px] font-bold text-gray-900">
              {format(date, "dd. MMMM yyyy", { locale: de })}
            </span>
            <button
              onClick={() => navigate(1)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Tabs + list */}
        <div className="px-4 pt-4 pb-2">
          {/* Tab pills */}
          <div className="flex gap-2 mb-4">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all ${
                  tab === t.key
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-white text-gray-500 shadow-sm"
                }`}
              >
                {t.label}
                {t.key !== "all" && (
                  <span className={`ml-1.5 text-[11px] font-bold ${tab === t.key ? "text-white/70" : "text-gray-400"}`}>
                    {t.key === "active"
                      ? baustellen.filter((b) => b.status === "OPEN" || b.status === "DISPONIERT" || b.status === "IN_LIEFERUNG").length
                      : baustellen.filter((b) => b.status === "ABGESCHLOSSEN").length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <RouteOptimizeButton baustellen={filtered} companyAddress={companyAddress} />

          {/* Baustellen cards */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-gray-300" />
              </div>
              <p className="text-[14px] font-medium text-gray-400">Keine Baustellen für diesen Tag</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => {
                const address = [b.address, b.postalCode, b.city].filter(Boolean).join(" ");
                return (
                  <Link
                    key={b.id}
                    href={`/fahrer/baustelle/${b.id}?date=${selectedDate}`}
                    className="block bg-white rounded-2xl overflow-hidden active:scale-[0.99] transition-transform"
                    style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}
                  >
                    <div className="flex items-stretch">
                      {/* Status accent bar */}
                      <div className={`w-[4px] flex-shrink-0 ${STATUS_ACCENT[b.status]}`} />
                      <div className="flex-1 px-4 py-4 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">{b.name}</p>
                            {b.contactName && (
                              <p className="text-[12px] text-gray-400 mt-0.5 truncate">{b.contactName}</p>
                            )}
                          </div>
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_BADGE[b.status]}`}>
                            {STATUS_LABEL[b.status]}
                          </span>
                        </div>
                        {address && (
                          <p className="text-[12px] text-gray-500 mt-2.5 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                            <span className="truncate">{address}</span>
                          </p>
                        )}
                        <p className="text-[12px] text-gray-500 mt-1 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                          {format(parseISO(b.startDate), "HH:mm", { locale: de })} – {format(parseISO(b.endDate), "HH:mm", { locale: de })} Uhr
                        </p>
                      </div>
                      <div className="flex items-center pr-4">
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
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

              {/* Desktop date nav */}
              <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3">
                <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-semibold text-gray-700">
                  {format(date, "dd. MMMM yyyy", { locale: de })}
                </span>
                <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-100">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                      tab === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t.key === "active" ? "Aktive Baustellen" : t.key === "completed" ? "Abgeschlossen" : "Alle"}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <HardHat className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
                  <p className="text-xs text-gray-400">
                    {filtered.length === 1 ? "Baustelle" : "Baustellen"} heute
                  </p>
                </div>
              </div>
            </div>

            {/* Right: baustellen list */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500">
                  {format(date, "EEEE, dd. MMMM yyyy", { locale: de })}
                </h2>
                <RouteOptimizeButton baustellen={filtered} companyAddress={companyAddress} />
              </div>
              {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl">
                  <p className="text-gray-400 text-sm">Keine Baustellen für diesen Tag</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((b) => {
                    const address = [b.address, b.postalCode, b.city].filter(Boolean).join(" ");
                    return (
                      <Link
                        key={b.id}
                        href={`/fahrer/baustelle/${b.id}?date=${selectedDate}`}
                        className="flex items-center bg-white rounded-2xl px-5 py-4 hover:shadow-sm transition-all group border border-transparent hover:border-gray-200"
                      >
                        <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_auto] gap-4 items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                            {b.contactName && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{b.contactName}</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                            {address ? (
                              <><MapPin className="h-3 w-3 flex-shrink-0 text-gray-400" />{address}</>
                            ) : "—"}
                          </p>
                          <div className="flex items-center gap-3">
                            <p className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(b.startDate), "HH:mm", { locale: de })} – {format(parseISO(b.endDate), "HH:mm", { locale: de })}
                            </p>
                            <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[b.status]}`}>
                              {STATUS_LABEL[b.status]}
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

function RouteOptimizeButton({ baustellen, companyAddress }: { baustellen: BaustelleItem[]; companyAddress?: string }) {
  const [open, setOpen] = useState(false);

  const addresses = baustellen
    .map((b) => [b.address, b.postalCode, b.city].filter(Boolean).join(" "))
    .filter(Boolean);

  const stops = [...(companyAddress ? [companyAddress] : []), ...addresses];

  if (addresses.length < 2) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold transition-colors mb-3 md:mb-0 active:scale-[0.97]"
      >
        <Route className="h-3.5 w-3.5" />
        Route optimieren ({addresses.length} Stopps)
      </button>
      {open && <MapsPickerSheet stops={stops} onClose={() => setOpen(false)} />}
    </>
  );
}
