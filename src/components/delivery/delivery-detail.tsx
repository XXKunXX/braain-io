import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Pencil, PenLine } from "lucide-react";
import type { Baustelle, Contact, DeliveryNote, Order } from "@prisma/client";

type DeliveryWithRelations = DeliveryNote & {
  contact: Contact;
  order: Order | null;
  baustelle: (Baustelle & { order: Order | null }) | null;
};

export function DeliveryDetail({
  deliveryNote: dn,
  contactId,
  baustelleId,
  baustelleName,
  invoiceId,
}: {
  deliveryNote: DeliveryWithRelations;
  contactId?: string;
  baustelleId?: string;
  baustelleName?: string;
  invoiceId?: string;
}) {
  const linkedOrder = dn.order ?? dn.baustelle?.order ?? null;
  const backHref = invoiceId
    ? `/rechnungen/${invoiceId}`
    : baustelleId
    ? `/baustellen/${baustelleId}?tab=lieferscheine`
    : contactId
    ? `/kontakte/${contactId}?tab=lieferscheine`
    : linkedOrder
    ? `/auftraege/${linkedOrder.id}`
    : "/lieferscheine";
  const backLabel = invoiceId
    ? "Zurück zur Rechnung"
    : baustelleId
    ? `Zurück zu ${baustelleName ?? "Baustelle"}`
    : contactId
    ? `Zurück zu ${dn.contact.companyName || [dn.contact.firstName, dn.contact.lastName].filter(Boolean).join(" ")}`
    : linkedOrder
    ? `Zurück zu ${linkedOrder.orderNumber} – ${linkedOrder.title}`
    : "Zurück zu Lieferscheine";

  return (
    <div className="max-w-2xl space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>
      <div className="bg-white border rounded-lg p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono text-zinc-400">{dn.deliveryNumber}</p>
              {dn.signatureUrl ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Unterschrieben</span>
              ) : (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Offen</span>
              )}
            </div>
            <h2 className="text-xl font-semibold mt-1">
              {dn.material} — {Number(dn.quantity).toLocaleString("de-DE")} {dn.unit}
            </h2>
            <Link
              href={`/kontakte/${dn.contact.id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {dn.contact.companyName || [dn.contact.firstName, dn.contact.lastName].filter(Boolean).join(" ")}
            </Link>
          </div>
          <Link href={`/lieferscheine/${dn.id}/bearbeiten`}>
            <button className="text-gray-300 hover:text-gray-600 transition-colors" title="Bearbeiten">
              <Pencil className="h-4 w-4" />
            </button>
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mt-5 pt-5 border-t text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Datum</dt>
            <dd className="font-medium">
              {format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}
            </dd>
          </div>
          {dn.driver && (
            <div>
              <dt className="text-xs text-zinc-500">Fahrer</dt>
              <dd className="font-medium">{dn.driver}</dd>
            </div>
          )}
          {dn.vehicle && (
            <div>
              <dt className="text-xs text-zinc-500">Fahrzeug</dt>
              <dd className="font-medium">{dn.vehicle}</dd>
            </div>
          )}
        </dl>

        {dn.notes && (
          <p className="text-sm text-zinc-600 mt-4 pt-4 border-t">{dn.notes}</p>
        )}
      </div>

      {/* Extra fields */}
      {((dn as DeliveryNote & { vehicleType?: string; licensePlate?: string; regieStart1?: string; regieEnd1?: string }).vehicleType ||
        (dn as DeliveryNote & { licensePlate?: string }).licensePlate ||
        (dn as DeliveryNote & { regieStart1?: string }).regieStart1) && (
        <div className="bg-white border rounded-lg p-5">
          <p className="text-xs text-zinc-500 mb-3 font-semibold uppercase tracking-wider">Details</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {(dn as DeliveryNote & { vehicleType?: string }).vehicleType && (
              <div><dt className="text-xs text-zinc-500">Fahrzeugtyp</dt><dd className="font-medium">{(dn as DeliveryNote & { vehicleType?: string }).vehicleType}</dd></div>
            )}
            {(dn as DeliveryNote & { licensePlate?: string }).licensePlate && (
              <div><dt className="text-xs text-zinc-500">Kennzeichen</dt><dd className="font-medium">{(dn as DeliveryNote & { licensePlate?: string }).licensePlate}</dd></div>
            )}
            {(dn as DeliveryNote & { regieStart1?: string; regieEnd1?: string }).regieStart1 && (
              <div><dt className="text-xs text-zinc-500">Regiezeit</dt><dd className="font-medium">{(dn as DeliveryNote & { regieStart1?: string }).regieStart1} – {(dn as DeliveryNote & { regieEnd1?: string }).regieEnd1}</dd></div>
            )}
          </dl>
        </div>
      )}

      {/* Signature */}
      {dn.signatureUrl ? (
        <div className="bg-white border rounded-lg p-5">
          <p className="text-xs text-zinc-500 mb-2 font-semibold uppercase tracking-wider">Unterschrift des Kunden</p>
          <img
            src={dn.signatureUrl}
            alt="Unterschrift"
            className="w-full max-h-36 object-contain border rounded-lg bg-gray-50"
          />
        </div>
      ) : (
        <Link href={`/lieferscheine/${dn.id}/ausfuellen`} className="block">
          <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:bg-blue-100 hover:border-blue-400 transition-colors">
            <PenLine className="h-8 w-8 mx-auto mb-3 text-blue-400" />
            <p className="text-sm font-semibold text-blue-700">Noch nicht ausgefüllt</p>
            <p className="text-xs text-blue-500 mt-1">Jetzt unterschreiben</p>
          </div>
        </Link>
      )}
    </div>
  );
}
