"use client";

import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
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
  return (
    <div className="max-w-2xl space-y-5">
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/api/pdf/delivery/${dn.id}`, "_blank")}
          >
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
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

      {/* Signature placeholder */}
      {dn.signatureUrl ? (
        <div className="bg-white border rounded-lg p-5">
          <p className="text-xs text-zinc-500 mb-2">Unterschrift</p>
          <img
            src={dn.signatureUrl}
            alt="Unterschrift"
            className="max-h-24 border rounded"
          />
        </div>
      ) : (
        <div className="bg-zinc-50 border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-zinc-400">Noch nicht unterschrieben</p>
        </div>
      )}
    </div>
  );
}
