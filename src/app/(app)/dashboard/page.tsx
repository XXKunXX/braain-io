import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  MessageSquare,
  FileText,
  ClipboardList,
  MapPin,
  ChevronRight,
  CheckSquare,
} from "lucide-react";
import { OverviewWidget } from "@/components/dashboard/overview-widget";

async function getDashboardData() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const [
    openTasks,
    newRequestsToday,
    openQuotes,
    activeOrders,
    todayOrders,
    recentRequests,
  ] = await Promise.all([
    // Offene Aufgaben (OPEN + IN_PROGRESS)
    prisma.task.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    // Neue Anfragen heute
    prisma.request.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    // Offene Angebote
    prisma.quote.count({ where: { status: { in: ["DRAFT", "SENT"] } } }),
    // Aktive Aufträge
    prisma.order.count({ where: { status: { in: ["ACTIVE", "ASSIGNED"] } } }),
    // Heutige Aufträge aus Disposition
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
      take: 8,
      orderBy: { startDate: "asc" },
    }),
    // Letzte Anfragen
    prisma.request.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { companyName: true } } },
    }),
  ]);

  return { openTasks, newRequestsToday, openQuotes, activeOrders, todayOrders, recentRequests };
}

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Geplant",
  ASSIGNED: "Zugeteilt",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
};

const STATUS_COLOR: Record<string, string> = {
  PLANNED: "bg-gray-100 text-gray-600",
  ASSIGNED: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  COMPLETED: "bg-gray-50 text-gray-400",
};

export default async function DashboardPage() {
  const [user, data] = await Promise.all([currentUser(), getDashboardData()]);
  const firstName = user?.firstName ?? "Nutzer";
  const dateStr = format(new Date(), "EEEE, d. MMMM yyyy", { locale: de });

  const statCards = [
    {
      label: "Offene Aufgaben",
      value: data.openTasks,
      href: "/aufgaben",
      numColor: "text-violet-600",
      iconBg: "bg-violet-100",
      icon: <CheckSquare className="h-5 w-5 text-violet-500" />,
      border: "",
    },
    {
      label: "Neue Anfragen",
      value: data.newRequestsToday,
      href: "/anfragen",
      numColor: "text-blue-600",
      iconBg: "bg-blue-100",
      icon: <MessageSquare className="h-5 w-5 text-blue-500" />,
      border: "",
    },
    {
      label: "Angebote offen",
      value: data.openQuotes,
      href: "/angebote",
      numColor: "text-orange-500",
      iconBg: "bg-orange-100",
      icon: <FileText className="h-5 w-5 text-orange-400" />,
      border: "border-amber-200 bg-amber-50/40",
    },
    {
      label: "Aktive Aufträge",
      value: data.activeOrders,
      href: "/auftraege",
      numColor: "text-green-600",
      iconBg: "bg-green-100",
      icon: <ClipboardList className="h-5 w-5 text-green-500" />,
      border: "",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Guten Tag, {firstName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{dateStr}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, href, numColor, iconBg, icon, border }) => (
          <Link
            key={label}
            href={href}
            className={`bg-white border rounded-xl p-4 md:p-5 hover:shadow-sm transition-shadow flex flex-col gap-3 ${border || "border-gray-200"}`}
          >
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase leading-tight">
                {label}
              </p>
              <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                {icon}
              </div>
            </div>
            <p className={`text-4xl font-bold ${numColor}`}>{value}</p>
          </Link>
        ))}
      </div>

      {/* Bottom 3-col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Heute zu erledigen — from Disposition */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Heute im Einsatz</h3>
            </div>
            <Link href="/disposition" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Disposition <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs text-gray-400 mb-4">{format(new Date(), "d. MMMM", { locale: de })}</p>

          {data.todayOrders.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Einsätze heute geplant</p>
          ) : (
            <div className="space-y-3">
              {data.todayOrders.map((order) => {
                const resources = order.dispositionEntries.map((e) => e.resource.name).join(", ");
                return (
                  <Link
                    key={order.id}
                    href={`/auftraege/${order.id}`}
                    className="flex items-start gap-3 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-orange-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{order.title}</p>
                        <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[order.status]}`}>
                          {STATUS_LABEL[order.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{order.contact.companyName}</p>
                      {resources && (
                        <p className="text-[11px] text-gray-300 truncate mt-0.5">{resources}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Letzte Anfragen */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Letzte Anfragen</h3>
            </div>
            <Link href="/anfragen" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Alle <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentRequests.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Anfragen</p>
          ) : (
            <div className="space-y-3">
              {data.recentRequests.map((req) => (
                <Link
                  key={req.id}
                  href={`/anfragen/${req.id}`}
                  className="flex items-start gap-2.5 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${req.status === "OPEN" || req.status === "NEU" ? "bg-amber-400" : "bg-gray-300"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                    <p className="text-xs text-gray-400">{req.contact.companyName}</p>
                  </div>
                  <span className="text-xs text-gray-300 flex-shrink-0 ml-auto">
                    {format(new Date(req.createdAt), "d. MMM", { locale: de })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Übersicht (dynamic period) */}
        <OverviewWidget />
      </div>
    </div>
  );
}
