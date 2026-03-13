"use client";

import { useState, useEffect, useCallback } from "react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { de } from "date-fns/locale";
import { BarChart3, ChevronRight } from "lucide-react";
import Link from "next/link";

type Period = "today" | "yesterday" | "week" | "month" | "custom";

interface OverviewData {
  requests: number;
  quotesCreated: number;
  quotesSent: number;
  quotesAccepted: number;
  ordersCompleted: number;
}

function getRangeForPeriod(period: Period, customFrom: string, customTo: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: format(now, "d. MMMM yyyy", { locale: de }) };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y), label: format(y, "d. MMMM yyyy", { locale: de }) };
    }
    case "week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
        label: `KW ${format(now, "w", { locale: de })} – ${format(now, "MMMM yyyy", { locale: de })}`,
      };
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy", { locale: de }) };
    case "custom": {
      const from = customFrom ? new Date(customFrom) : startOfDay(now);
      const to = customTo ? new Date(customTo + "T23:59:59") : endOfDay(now);
      return { from, to, label: `${format(from, "d. MMM", { locale: de })} – ${format(to, "d. MMM yyyy", { locale: de })}` };
    }
  }
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "yesterday", label: "Gestern" },
  { key: "week", label: "Diese Woche" },
  { key: "month", label: "Dieser Monat" },
  { key: "custom", label: "Benutzerdefiniert" },
];

function ProgressRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = Math.round((count / Math.max(max, 1)) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }} />
      </div>
    </div>
  );
}

export function OverviewWidget() {
  const [period, setPeriod] = useState<Period>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getRangeForPeriod(period, customFrom, customTo);
    try {
      const res = await fetch(`/api/dashboard/overview?from=${from.toISOString()}&to=${to.toISOString()}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { label } = getRangeForPeriod(period, customFrom, customTo);
  const max = data ? Math.max(data.requests, data.quotesCreated, data.quotesSent, data.quotesAccepted, data.ordersCompleted, 1) : 1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Übersicht</h3>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-1 mb-1">
        {PERIODS.map(({ key, label: pl }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              period === key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {pl}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="flex items-center gap-2 mt-2 mb-1">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      <p className="text-[11px] text-gray-400 mb-4 mt-1">{label}</p>

      {/* Rows */}
      <div className={`space-y-4 flex-1 transition-opacity duration-200 ${loading ? "opacity-40" : "opacity-100"}`}>
        <ProgressRow label="Neue Anfragen" count={data?.requests ?? 0} max={max} color="bg-blue-400" />
        <ProgressRow label="Angebote erstellt" count={data?.quotesCreated ?? 0} max={max} color="bg-purple-400" />
        <ProgressRow label="Angebote gesendet" count={data?.quotesSent ?? 0} max={max} color="bg-indigo-400" />
        <ProgressRow label="Angebote angenommen" count={data?.quotesAccepted ?? 0} max={max} color="bg-green-400" />
        <ProgressRow label="Aufträge abgeschlossen" count={data?.ordersCompleted ?? 0} max={max} color="bg-amber-400" />
      </div>

      <Link href="/anfragen" className="mt-5 flex items-center gap-1 text-xs text-blue-600 hover:underline">
        Alle Anfragen ansehen <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
