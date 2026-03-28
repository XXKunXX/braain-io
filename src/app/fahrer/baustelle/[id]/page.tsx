import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Building2, Clock, AlertCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getBaustelleForDriverApp, getBaustelleEntryForDate } from "@/actions/driver";
import { getSettings } from "@/actions/settings";
import { NavButton } from "@/components/fahrer/nav-button";
import { NavAddressCard } from "@/components/fahrer/nav-address-card";
import { WeatherWidget } from "@/components/fahrer/weather-widget";

export default async function FahrerBaustelleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateStr } = await searchParams;

  const [baustelle, entry, settings] = await Promise.all([
    getBaustelleForDriverApp(id),
    dateStr ? getBaustelleEntryForDate(id, dateStr) : Promise.resolve(null),
    getSettings(),
  ]);
  if (!baustelle) notFound();

  const address = [baustelle.address, baustelle.postalCode, baustelle.city].filter(Boolean).join(" ");
  const companyAddress = [settings.street, settings.postalCode, settings.city].filter(Boolean).join(" ") || undefined;
  const items = baustelle.order?.quote?.items.map((i) => ({
    description: i.description,
    quantity: Number(i.quantity),
    unit: i.unit,
  })) ?? [];
  const notes = baustelle.notes ?? baustelle.order?.notes ?? null;
  const deliveryNotes = baustelle.deliveryNotes ?? [];
  const orderId = baustelle.order?.id ?? null;

  const zeitraumValue = entry
    ? `${format(new Date(entry.startDate), "dd. MMM yyyy", { locale: de })} · ${format(new Date(entry.startDate), "HH:mm", { locale: de })} – ${format(new Date(entry.endDate), "HH:mm", { locale: de })} Uhr`
    : null;

  return (
    <div className="min-h-screen bg-[#F2F2F7]">

      {/* ── Mobile (< md) ── */}
      <div className="md:hidden">
        {/* Page header */}
        <div className="bg-white px-4 pt-3 pb-5 border-b border-gray-100">
          <Link href="/fahrer" className="inline-flex items-center gap-0.5 text-indigo-600 font-semibold text-[15px] mb-3">
            <ChevronLeft className="h-5 w-5" />
            Baustellen
          </Link>
          <h1 className="text-[22px] font-black text-gray-900 tracking-tight leading-tight">{baustelle.name}</h1>
          {baustelle.contact?.companyName && (
            <p className="text-[14px] text-gray-400 mt-0.5 font-medium">{baustelle.contact.companyName}</p>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pt-4 space-y-3 pb-4">
          {address && <NavAddressCard address={address} origin={companyAddress} />}
          {zeitraumValue ? (
            <InfoCard
              icon={<Clock className="h-5 w-5 text-indigo-400 flex-shrink-0" />}
              label="Einsatz geplant"
              value={zeitraumValue}
            />
          ) : (
            <NoEntryCard />
          )}
          {baustelle.order?.title && (
            <InfoCard
              icon={<Building2 className="h-5 w-5 text-indigo-400 flex-shrink-0" />}
              label="Auftrag"
              value={baustelle.order.title}
            />
          )}
          {address && <WeatherWidget address={address} />}
          {items.length > 0 && <MaterialsCard items={items} />}
          {notes && <NotesCard notes={notes} />}

          {/* Action buttons */}
          <div className="space-y-2.5 pt-1">
            {address && <NavButton address={address} origin={companyAddress} rounded="2xl" />}
            {orderId && <LieferscheinButton orderId={orderId} deliveryNotes={deliveryNotes} rounded="2xl" />}
          </div>
        </div>
      </div>

      {/* ── Tablet / Desktop (≥ md) ── */}
      <div className="hidden md:block max-w-5xl mx-auto px-6 lg:px-10 py-8">
        <Link href="/fahrer" className="inline-flex items-center gap-1 text-indigo-600 font-medium text-sm mb-6 hover:text-indigo-700">
          <ChevronLeft className="h-4 w-4" />
          Baustellen
        </Link>
        <div className="grid grid-cols-[1fr_360px] lg:grid-cols-[1fr_400px] gap-8 mt-2">

          {/* Left */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{baustelle.name}</h1>
              {baustelle.contact?.companyName && (
                <p className="text-gray-400 mt-0.5">{baustelle.contact.companyName}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {address && <NavAddressCard address={address} origin={companyAddress} />}
              {zeitraumValue ? (
                <InfoCard
                  icon={<Clock className="h-5 w-5 text-indigo-400 flex-shrink-0" />}
                  label="Einsatz geplant"
                  value={zeitraumValue}
                />
              ) : (
                <NoEntryCard />
              )}
              {baustelle.order?.title && (
                <InfoCard
                  icon={<Building2 className="h-5 w-5 text-indigo-400 flex-shrink-0" />}
                  label="Auftrag"
                  value={baustelle.order.title}
                />
              )}
            </div>
            {address && <WeatherWidget address={address} />}
            {items.length > 0 && <MaterialsCard items={items} />}
            {notes && <NotesCard notes={notes} />}
          </div>

          {/* Right — sticky actions */}
          <div className="sticky top-[73px] self-start">
            <div className="bg-white rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Aktionen</p>
              {address && <NavButton address={address} origin={companyAddress} rounded="xl" />}
              {orderId && <LieferscheinButton orderId={orderId} deliveryNotes={deliveryNotes} rounded="xl" />}
              {!orderId && (
                <p className="text-xs text-gray-400 text-center py-2">Kein Auftrag verknüpft</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 flex items-start gap-3" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      {icon}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-[14px] font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function MaterialsCard({ items }: { items: { description: string; quantity: number; unit: string }[] }) {
  return (
    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-3">Materialien / Leistungen</p>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-gray-800 leading-snug">{item.description}</span>
            <span className="text-[14px] font-bold text-gray-900 flex-shrink-0">{item.quantity.toLocaleString("de-DE")} {item.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoEntryCard() {
  return (
    <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[12px] font-bold text-amber-700 mb-0.5">Kein Einsatzplan</p>
        <p className="text-[13px] text-amber-600">Für diesen Tag ist kein konkreter Einsatz geplant.</p>
      </div>
    </div>
  );
}

function NotesCard({ notes }: { notes: string }) {
  return (
    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-2">Notizen</p>
      <p className="text-[14px] text-gray-700 leading-relaxed">{notes}</p>
    </div>
  );
}

function LieferscheinButton({
  orderId,
  deliveryNotes,
  rounded,
}: {
  orderId: string;
  deliveryNotes: { id: string; deliveryNumber: string }[];
  rounded: string;
}) {
  if (deliveryNotes.length > 0) {
    const latest = deliveryNotes[0];
    return (
      <Link
        href={`/fahrer/lieferschein/${latest.id}`}
        className={`flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 rounded-${rounded} py-4 text-[15px] font-bold text-white transition-colors active:scale-[0.99]`}
      >
        <FileText className="h-5 w-5" />
        Lieferschein ansehen ({latest.deliveryNumber})
      </Link>
    );
  }

  return (
    <Link
      href={`/fahrer/${orderId}/lieferschein`}
      className={`flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 rounded-${rounded} py-4 text-[15px] font-bold text-white transition-colors active:scale-[0.99]`}
    >
      <FileText className="h-5 w-5" />
      Lieferschein erstellen
    </Link>
  );
}
