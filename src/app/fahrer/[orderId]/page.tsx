import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getOrderForDriverApp } from "@/actions/driver";
import { NavButton } from "@/components/fahrer/nav-button";

export default async function FahrerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderForDriverApp(orderId);
  if (!order) notFound();

  const address = order.quote?.siteAddress
    ? order.quote.siteAddress
    : [order.contact.address, order.contact.postalCode, order.contact.city]
        .filter(Boolean)
        .join(" ");

  const items = order.quote?.items.map((i) => ({
    description: i.description,
    quantity: Number(i.quantity),
    unit: i.unit,
  })) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Mobile (< md) ── */}
      <div className="md:hidden max-w-lg mx-auto px-4 py-6">
        <BackLink />
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{order.contact.companyName}</h1>
          <p className="text-gray-400 mt-0.5">{order.title}</p>
        </div>
        <div className="space-y-3 mb-6">
          <InfoCard icon={<MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />} label="Baustelle" value={address || "—"} />
          <InfoCard icon={<Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />} label="Lieferdatum" value={format(new Date(order.startDate), "EEEE, dd. MMMM yyyy", { locale: de })} />
        </div>
        {items.length > 0 && <MaterialsCard items={items} />}
        {order.notes && <NotesCard notes={order.notes} />}
        <div className="space-y-3 mt-4">
          <NavButton address={address} rounded="2xl" />
          <LieferscheinButton orderId={orderId} rounded="2xl" />
        </div>
      </div>

      {/* ── Tablet / Desktop (≥ md) ── */}
      <div className="hidden md:block max-w-5xl mx-auto px-6 lg:px-10 py-8">
        <BackLink />
        <div className="grid grid-cols-[1fr_360px] lg:grid-cols-[1fr_400px] gap-8 mt-6">

          {/* Left */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{order.contact.companyName}</h1>
              <p className="text-gray-400 mt-0.5">{order.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InfoCard icon={<MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />} label="Baustelle" value={address || "—"} />
              <InfoCard icon={<Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />} label="Lieferdatum" value={format(new Date(order.startDate), "EEEE, dd. MMMM yyyy", { locale: de })} />
            </div>
            {items.length > 0 && <MaterialsCard items={items} />}
            {order.notes && <NotesCard notes={order.notes} />}
          </div>

          {/* Right — sticky actions */}
          <div className="sticky top-[73px] self-start">
            <div className="bg-white rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Aktionen</p>
              <NavButton address={address} rounded="xl" />
              <LieferscheinButton orderId={orderId} rounded="xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/fahrer" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
      <ArrowLeft className="h-4 w-4" />
      Aufträge
    </Link>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 flex items-start gap-3">
      {icon}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function MaterialsCard({ items }: { items: { description: string; quantity: number; unit: string }[] }) {
  return (
    <div className="bg-white rounded-2xl p-4">
      <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Materialien</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-gray-900">{item.description}</span>
            <span className="text-sm font-bold text-gray-900">{item.quantity.toLocaleString("de-DE")} {item.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesCard({ notes }: { notes: string }) {
  return (
    <div className="bg-white rounded-2xl p-4">
      <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Notizen</p>
      <p className="text-sm text-gray-700">{notes}</p>
    </div>
  );
}


function LieferscheinButton({
  orderId,
  rounded,
}: {
  orderId: string;
  rounded: string;
}) {
  const docIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  return (
    <Link
      href={`/fahrer/${orderId}/lieferschein`}
      className={`flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 rounded-${rounded} py-4 text-sm font-semibold text-white transition-colors`}
    >
      {docIcon}
      Lieferschein erstellen
    </Link>
  );
}
