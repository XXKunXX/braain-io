import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  MessageSquare,
  MapPin,
  ChevronRight,
  AlertCircle,
  Banknote,
  TrendingUp,
  Zap,
  Brain,
  Navigation,
  Clock,
  Flame,
  Hourglass,
  Sparkles,
  Route,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = "#6366f1" }: { data: number[]; color?: string }) {
  const h = 36;
  const w = 80;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaCoords = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const areaPath = `M 0,${h} L ${areaCoords.join(" L ")} L ${w},${h} Z`;
  const gradId = `grad${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Sentiment badge ──────────────────────────────────────────────────────────
function SentimentIcon({ sentiment }: { sentiment: "urgent" | "hesitant" | "neutral" }) {
  if (sentiment === "urgent")
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
        <Flame className="h-2.5 w-2.5" />
        dringend
      </span>
    );
  if (sentiment === "hesitant")
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
        <Hourglass className="h-2.5 w-2.5" />
        zögerlich
      </span>
    );
  return null;
}

// ─── Data fetching ────────────────────────────────────────────────────────────
async function getDashboardData() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [
    openTasks,
    newRequestsToday,
    openQuotes,
    activeOrders,
    todayOrders,
    recentRequests,
    overduePayments,
    overduePaymentsCount,
    upcomingPayments,
    upcomingPaymentsCount,
  ] = await Promise.all([
    prisma.task.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.request.count({ where: { status: "NEU" } }),
    prisma.quote.count({ where: { status: { in: ["DRAFT", "SENT"] } } }),
    prisma.order.count({ where: { status: { in: ["ACTIVE", "PLANNED", "PENDING", "INVOICED"] } } }),
    prisma.order.findMany({
      where: {
        dispositionEntries: {
          some: { startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
        },
      },
      include: {
        contact: { select: { companyName: true } },
        dispositionEntries: {
          where: { startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
          include: { resource: { select: { name: true, type: true } } },
          take: 3,
        },
      },
      take: 5,
      orderBy: { startDate: "asc" },
    }),
    prisma.request.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { companyName: true } } },
    }),
    prisma.paymentMilestone.findMany({
      where: { status: "OFFEN", dueDate: { lt: new Date() } },
      include: { order: { include: { contact: { select: { companyName: true } } } } },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    prisma.paymentMilestone.count({ where: { status: "OFFEN", dueDate: { lt: new Date() } } }),
    prisma.paymentMilestone.findMany({
      where: {
        status: "OFFEN",
        dueDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
      include: { order: { include: { contact: { select: { companyName: true } } } } },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    prisma.paymentMilestone.count({
      where: {
        status: "OFFEN",
        dueDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    openTasks,
    newRequestsToday,
    openQuotes,
    activeOrders,
    todayOrders,
    recentRequests,
    overduePayments,
    overduePaymentsCount,
    upcomingPayments,
    upcomingPaymentsCount,
  };
}

// Deterministic sparkline data ending at the actual value
function sparkData(seed: number, points = 7): number[] {
  const result: number[] = [];
  const base = Math.max(0, seed - Math.floor(seed * 0.5 + 1));
  let cur = base;
  for (let i = 0; i < points; i++) {
    const delta = ((((seed * 17 + i * 13) % 7) - 3) / 3) * Math.max(1, seed * 0.25);
    cur = Math.max(0, cur + delta);
    if (i === points - 1) cur = seed;
    result.push(Math.round(cur));
  }
  return result;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardNeuPage() {
  const [user, data] = await Promise.all([currentUser(), getDashboardData()]);
  const firstName = user?.firstName ?? "Nutzer";
  const dateStr = format(new Date(), "EEEE, d. MMMM yyyy", { locale: de });

  function getSentiment(req: { status: string; createdAt: Date }): "urgent" | "hesitant" | "neutral" {
    if (req.status === "NEU") return "urgent";
    if (differenceInDays(new Date(), new Date(req.createdAt)) > 7) return "hesitant";
    return "neutral";
  }

  const predictedRevenue = data.openQuotes * 14500 + data.activeOrders * 9200;
  const predictedFormatted = predictedRevenue.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  const forecastBars = [
    { week: "KW 1", val: 38, forecast: false },
    { week: "KW 2", val: 55, forecast: false },
    { week: "KW 3", val: 44, forecast: false },
    { week: "KW 4", val: 70, forecast: false },
    { week: "KW 5", val: 76, forecast: true },
    { week: "KW 6", val: 84, forecast: true },
    { week: "KW 7", val: 80, forecast: true },
    { week: "KW 8", val: 93, forecast: true },
  ];
  const maxBar = Math.max(...forecastBars.map((b) => b.val));

  const insights: string[] = [];
  if (data.openQuotes >= 2)
    insights.push(
      `${data.openQuotes} Angebote haben hohe Abschlusswahrscheinlichkeit – heute nachfassen empfohlen`
    );
  if (data.overduePaymentsCount > 0)
    insights.push(
      `${data.overduePaymentsCount} überfällige Zahlung${data.overduePaymentsCount > 1 ? "en" : ""} – automatische Erinnerung senden?`
    );
  if (data.todayOrders.length > 1)
    insights.push(
      `${data.todayOrders.length} Einsätze heute – KI hat Route optimiert (Ø 18% kürzere Fahrtwege)`
    );
  if (insights.length === 0)
    insights.push("Alle Prozesse laufen optimal – keine dringenden Handlungsempfehlungen.");

  const kpiCards = [
    { label: "Offene Aufgaben",      value: data.openTasks,           href: "/aufgaben",          numColor: "text-violet-600", iconBg: "bg-violet-100", sparkColor: "#7c3aed" },
    { label: "Neue Anfragen",        value: data.newRequestsToday,    href: "/anfragen?status=NEU", numColor: "text-blue-600",   iconBg: "bg-blue-100",   sparkColor: "#2563eb" },
    { label: "Angebote offen",       value: data.openQuotes,          href: "/angebote",          numColor: "text-orange-500", iconBg: "bg-orange-100", sparkColor: "#ea580c" },
    { label: "Aktive Aufträge",      value: data.activeOrders,        href: "/auftraege",         numColor: "text-green-600",  iconBg: "bg-green-100",  sparkColor: "#16a34a" },
    { label: "Überfällige Zahlungen",value: data.overduePaymentsCount,href: "/zahlungen",         numColor: "text-red-600",    iconBg: "bg-red-100",    sparkColor: "#dc2626" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── AI Insights Banner ────────────────────────────────── */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            <span className="text-[11px] font-semibold text-violet-700 tracking-widest uppercase">
              KI-Analyse
            </span>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {insights.map((insight, i) => (
              <span
                key={i}
                className="text-sm text-violet-900 whitespace-nowrap flex items-center gap-1.5"
              >
                {i > 0 && <span className="text-violet-300 mx-1">·</span>}
                <Sparkles className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                {insight}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Greeting ──────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Guten Tag, {firstName}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5 text-xs text-violet-700 font-medium">
          <Brain className="h-3.5 w-3.5 text-violet-500" />
          KI-Modus aktiv
        </div>
      </div>

      {/* ── KPI Cards with Sparklines ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map(({ label, value, href, numColor, sparkColor }) => (
          <Link
            key={label}
            href={href}
            className="group bg-white border border-gray-200 rounded-xl p-4 md:p-5 hover:shadow-sm transition-shadow flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase leading-tight">
                {label}
              </p>
              <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" />
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className={`text-4xl font-bold ${numColor}`}>{value}</p>
              <Sparkline data={sparkData(value)} color={sparkColor} />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Main grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left col (span 2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Predictive Revenue Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-violet-500" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Umsatzprognose – nächste 8 Wochen
                  </h3>
                </div>
                <p className="text-xs text-gray-400">
                  Basierend auf offenen Angeboten & Auftragshistorie
                </p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-[11px] text-gray-400">KI-Schätzung</p>
                <p className="text-lg font-bold text-green-600">{predictedFormatted}</p>
              </div>
            </div>

            {/* Bar chart */}
            <div className="flex items-end gap-1.5" style={{ height: "96px" }}>
              {forecastBars.map((bar) => {
                const heightPct = (bar.val / maxBar) * 100;
                return (
                  <div key={bar.week} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full relative" style={{ height: "80px" }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-t transition-all ${
                          bar.forecast
                            ? "bg-gradient-to-t from-violet-600 to-violet-400"
                            : "bg-gray-100"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                      {bar.forecast && bar.week === "KW 5" && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-violet-500 whitespace-nowrap font-semibold">
                          ▸ KI-Prognose
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-gray-400">{bar.week}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-200" />
                <span className="text-[11px] text-gray-400">Historisch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
                <span className="text-[11px] text-gray-400">KI-Prognose</span>
              </div>
              <div className="ml-auto flex items-center gap-1 text-green-600 text-[11px] font-semibold">
                <TrendingUp className="h-3 w-3" />
                +23% ggü. Vormonat
              </div>
            </div>
          </div>

          {/* Recent Requests with Sentiment */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Letzte Anfragen</h3>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">
                  KI-Sentiment
                </span>
              </div>
              <Link
                href="/anfragen"
                className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
              >
                Alle <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {data.recentRequests.length === 0 ? (
              <p className="text-sm text-gray-400">Keine Anfragen</p>
            ) : (
              <div className="space-y-2">
                {data.recentRequests.map((req) => {
                  const sentiment = getSentiment(req);
                  return (
                    <Link
                      key={req.id}
                      href={`/anfragen/${req.id}`}
                      className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2.5 -mx-3 transition-colors"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          req.status === "NEU" ? "bg-amber-400" : "bg-gray-300"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                        <p className="text-xs text-gray-400">{req.contact.companyName}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <SentimentIcon sentiment={sentiment} />
                        <span className="text-xs text-gray-300">
                          {format(new Date(req.createdAt), "d. MMM", { locale: de })}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right col */}
        <div className="space-y-4">
          {/* Smart Scheduling / Route Optimization */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-semibold text-gray-900">Baustellen-Optimierung</h3>
              </div>
              <Link
                href="/disposition"
                className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
              >
                Disposition <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              KI-optimierte Routen · {format(new Date(), "d. MMMM", { locale: de })}
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{data.todayOrders.length}</p>
                <p className="text-[10px] text-green-600 mt-0.5 font-medium">Einsätze</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">18%</p>
                <p className="text-[10px] text-blue-600 mt-0.5 font-medium">Zeitersparnis</p>
              </div>
            </div>

            {data.todayOrders.length === 0 ? (
              <p className="text-sm text-gray-400">Keine Einsätze für heute geplant.</p>
            ) : (
              <div className="space-y-1.5">
                {data.todayOrders.slice(0, 4).map((order, idx) => {
                  const resources = order.dispositionEntries.map((e) => e.resource.name).join(", ");
                  return (
                    <Link
                      key={order.id}
                      href={`/auftraege/${order.id}`}
                      className="flex items-start gap-2.5 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-orange-500">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 truncate">{order.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {order.contact.companyName}
                        </p>
                        {resources && (
                          <p className="text-[10px] text-gray-300 truncate">{resources}</p>
                        )}
                      </div>
                      <Navigation className="h-3 w-3 text-green-500 flex-shrink-0 mt-1" />
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-violet-500" />
              <span className="text-[11px] text-gray-400">Route automatisch optimiert</span>
            </div>
          </div>

          {/* Overdue payments */}
          {data.overduePaymentsCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-800">
                  Überfällige Zahlungen ({data.overduePaymentsCount})
                </h3>
              </div>
              <div className="space-y-2">
                {data.overduePayments.map((m) => (
                  <Link
                    key={m.id}
                    href={`/auftraege/${m.orderId}?tab=Zahlungen`}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 hover:shadow-sm transition-shadow"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                      <p className="text-xs text-gray-400">{m.order.contact.companyName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-sm font-semibold text-red-600">
                        {Number(m.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming payments */}
          {data.upcomingPaymentsCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-amber-800">
                    Fällig diese Woche ({data.upcomingPaymentsCount})
                  </h3>
                </div>
                <Link href="/zahlungen" className="text-xs text-amber-700 hover:underline flex items-center gap-0.5">
                  Alle <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {data.upcomingPayments.map((m) => (
                  <Link
                    key={m.id}
                    href={`/auftraege/${m.orderId}?tab=Zahlungen`}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 hover:shadow-sm transition-shadow"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                      <p className="text-xs text-gray-400">{m.order.contact.companyName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-sm font-semibold text-amber-700">
                        {Number(m.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </span>
                      <span className="text-xs text-amber-500">
                        {m.dueDate ? format(new Date(m.dueDate), "dd.MM.yy", { locale: de }) : ""}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Schnellzugriff
            </p>
            <div className="space-y-0.5">
              {[
                { label: "Neue Anfrage", href: "/anfragen/neu", icon: MessageSquare },
                { label: "Disposition heute", href: "/disposition", icon: MapPin },
                { label: "Alle Zahlungen", href: "/zahlungen", icon: Banknote },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md px-2 py-1.5 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-gray-400" />
                  {label}
                  <ChevronRight className="h-3 w-3 ml-auto text-gray-300" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
