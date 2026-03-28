import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getDeliveryNoteForFahrerApp } from "@/actions/driver";

export default async function FahrerLieferscheinDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dn = await getDeliveryNoteForFahrerApp(id);
  if (!dn) notFound();

  const deliveredItems = dn.deliveredItems as { material: string; quantity: number; unit: string }[] | null;
  const displayItems = deliveredItems && deliveredItems.length > 0
    ? deliveredItems
    : [{ material: dn.material, quantity: Number(dn.quantity), unit: dn.unit }];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link
          href="/fahrer"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>

        {/* Success header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-shrink-0 bg-green-100 rounded-full p-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Lieferschein erstellt</h1>
            <p className="text-sm text-gray-400 font-mono">{dn.deliveryNumber}</p>
          </div>
        </div>

        {/* Date & Customer */}
        <div className="bg-white rounded-2xl p-4 mb-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-400 mb-0.5">Datum</p>
              <p className="text-sm font-semibold text-gray-900">
                {format(new Date(dn.date), "dd. MMMM yyyy", { locale: de })}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 mb-0.5">Empfänger</p>
              <p className="text-sm font-semibold text-gray-900">{dn.contact.companyName}</p>
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="bg-white rounded-2xl p-4 mb-3">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Materialien</p>
          <div className="space-y-2">
            {displayItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-900">{item.material}</span>
                <span className="text-sm font-bold text-gray-900">
                  {Number(item.quantity).toLocaleString("de-DE")} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Signature */}
        {dn.signatureUrl && (
          <div className="bg-white rounded-2xl p-4 mb-3">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
              Unterschrift Empfänger
            </p>
            <img
              src={dn.signatureUrl}
              alt="Unterschrift"
              className="w-full max-h-36 object-contain rounded-xl bg-gray-50 border border-gray-100"
            />
          </div>
        )}

        {/* PDF Button */}
        <a
          href={`/api/pdf/delivery/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 rounded-2xl py-4 text-sm font-semibold text-white transition-colors mt-4"
        >
          <FileText className="h-4 w-4" />
          PDF anzeigen
        </a>
      </div>
    </div>
  );
}
