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
  Clock,
} from "lucide-react";

async function getDashboardData() {
  const today = new Date();
  const todayStart = new Date(today.setHours(0, 0, 0, 0));
  const todayEnd = new Date(today.setHours(23, 59, 59, 999));

  const [
    openRequests,
    newRequestsToday,
    openQuotes,
    activeOrders,
    todayOrders,
    recentRequests,
    quoteDraft,
    quoteSent,
    quoteAccepted,
  ] = await Promise.all([
    prisma.request.count({ where: { status: "OPEN" } }),
    prisma.request.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.quote.count({ where: { status: { in: ["DRAFT", "SENT"] } } }),
    prisma.order.count({ where: { status: "ACTIVE" } }),
    prisma.order.findMany({
      where: { status: "ACTIVE", startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
      include: { contact: true },
      take: 5,
    }),
    prisma.request.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { contact: true },
    }),
    prisma.quote.count({ where: { status: "DRAFT" } }),
    prisma.quote.count({ where: { status: "SENT" } }),
    prisma.quote.count({ where: { status: "ACCEPTED" } }),
  ]);

  return {
    openRequests,
    newRequestsToday,
    openQuotes,
    activeOrders,
    todayOrders,
    recentRequests,
    quoteDraft,
    quoteSent,
    quoteAccepted,
  };
}

export default async function DashboardPage() {
  const [user, data] = await Promise.all([currentUser(), getDashboardData()]);
  const firstName = user?.firstName ?? "Nutzer";

  const dateStr = format(new Date(), "EEEE, d. MMMM yyyy", { locale: de });

  const totalQuotes = data.quoteDraft + data.quoteSent + data.quoteAccepted || 1;

  const statCards = [
    {
      label: "Offene Anfragen",
      value: data.openRequests,
      href: "/anfragen",
      numColor: "text-purple-600",
      iconBg: "bg-purple-100",
      icon: <MessageSquare className="h-5 w-5 text-purple-500" />,
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
            className={`bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow flex flex-col gap-3 ${border || "border-gray-200"}`}
          >
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
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
        {/* Heute zu erledigen */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Heute zu erledigen</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {format(new Date(), "d. MMMM", { locale: de })}
          </p>
          {data.todayOrders.length === 0 ? (
            <p className="text-sm text-gray-400">Keine aktiven Aufträge heute</p>
          ) : (
            <div className="space-y-3">
              {data.todayOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/auftraege/${order.id}`}
                  className="flex items-start gap-3 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.title}</p>
                    <p className="text-xs text-gray-400">{order.contact.companyName}</p>
                  </div>
                </Link>
              ))}
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
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    req.status === "OPEN" ? "bg-amber-400" : "bg-gray-300"
                  }`} />
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

        {/* Vertriebsübersicht */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Vertriebsübersicht</h3>
          </div>
          <div className="space-y-4">
            <ProgressRow
              label="Neue Anfragen"
              count={data.openRequests}
              max={Math.max(data.openRequests, 10)}
              color="bg-blue-400"
            />
            <ProgressRow
              label="Angebote erstellt"
              count={data.quoteDraft}
              max={Math.max(totalQuotes, 10)}
              color="bg-purple-400"
            />
            <ProgressRow
              label="Angebote gesendet"
              count={data.quoteSent}
              max={Math.max(totalQuotes, 10)}
              color="bg-green-400"
            />
            <ProgressRow
              label="Angebote angenommen"
              count={data.quoteAccepted}
              max={Math.max(totalQuotes, 10)}
              color="bg-amber-400"
            />
          </div>
          <Link
            href="/anfragen"
            className="mt-5 flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Alle Anfragen ansehen <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = Math.round((count / max) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-900">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}
