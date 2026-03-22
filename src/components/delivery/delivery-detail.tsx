"use client";

import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, PenLine } from "lucide-react";
import type { Contact, DeliveryNote, Order } from "@prisma/client";

type DeliveryWithRelations = DeliveryNote & {
  contact: Contact;
  order: Order | null;
};

export function DeliveryDetail({
  deliveryNote: dn,
}: {
  deliveryNote: DeliveryWithRelations;
}) {
  const backHref = dn.order ? `/auftraege/${dn.order.id}?tab=Lieferscheine` : "/lieferscheine";
  const backLabel = dn.order ? `Zurück zu ${dn.order.orderNumber}` : "Zurück zu Lieferscheine";

  return (
    <div className="max-w-2xl space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>
      <div className="bg-white border rounded-lg p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-zinc-400">{dn.deliveryNumber}</p>
            <h2 className="text-xl font-semibold mt-1">
              {dn.material} — {Number(dn.quantity).toLocaleString("de-DE")} {dn.unit}
            </h2>
            <Link
              href={`/kontakte/${dn.contact.id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {dn.contact.companyName}
            </Link>
          </div>
          <div className="flex gap-2">
            <Link href={`/lieferscheine/${dn.id}/ausfuellen`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <PenLine className="h-4 w-4 mr-1" />
                Ausfüllen
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/pdf/delivery/${dn.id}`, "_blank")}
            >
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>
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
          {dn.order && (
            <div>
              <dt className="text-xs text-zinc-500">Auftrag</dt>
              <dd>
                <Link
                  href={`/auftraege/${dn.order.id}`}
                  className="font-medium text-blue-600 hover:underline font-mono"
                >
                  {dn.order.orderNumber}
                </Link>
              </dd>
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
          <div className="bg-zinc-50 border border-dashed rounded-lg p-6 text-center hover:bg-blue-50 hover:border-blue-200 transition-colors">
            <PenLine className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
            <p className="text-sm text-zinc-400">Noch nicht ausgefüllt — Jetzt ausfüllen</p>
          </div>
        </Link>
      )}
    </div>
  );
}
