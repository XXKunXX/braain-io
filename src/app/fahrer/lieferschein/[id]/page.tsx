import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle } from "lucide-react";
import { ShareLieferscheinButton } from "@/components/fahrer/share-lieferschein-button";
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
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="max-w-lg mx-auto px-4 py-4">
        <Link
          href="/fahrer"
          className="inline-flex items-center gap-0.5 text-indigo-600 font-semibold text-[15px] mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Zurück
        </Link>

        {/* Success header */}
        <div className="flex items-center gap-4 mb-5 bg-white rounded-2xl p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div className="w-12 h-12 flex-shrink-0 bg-emerald-100 rounded-2xl flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-gray-900 tracking-tight">Lieferschein erstellt</h1>
            <p className="text-[13px] text-gray-400 font-mono mt-0.5">{dn.deliveryNumber}</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Date & Customer */}
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Datum</p>
                <p className="text-[14px] font-semibold text-gray-900">
                  {format(new Date(dn.date), "dd. MMMM yyyy", { locale: de })}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Empfänger</p>
                <p className="text-[14px] font-semibold text-gray-900">{dn.contact.companyName}</p>
              </div>
            </div>
          </div>

          {/* Materials */}
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-3">Materialien</p>
            <div className="space-y-2.5">
              {displayItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-[14px] text-gray-800">{item.material}</span>
                  <span className="text-[14px] font-bold text-gray-900 flex-shrink-0">
                    {Number(item.quantity).toLocaleString("de-DE")} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Signature */}
          {dn.signatureUrl && (
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase mb-3">
                Unterschrift Empfänger
              </p>
              <img
                src={dn.signatureUrl}
                alt="Unterschrift"
                className="w-full max-h-36 object-contain rounded-xl bg-gray-50 border border-gray-100"
              />
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <a
              href={`/api/pdf/delivery/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full bg-indigo-600 hover:bg-indigo-700 rounded-2xl py-4 text-[15px] font-bold text-white transition-colors active:scale-[0.99]"
            >
              <FileText className="h-5 w-5" />
              PDF anzeigen
            </a>
            <ShareLieferscheinButton
              deliveryNumber={dn.deliveryNumber}
              pdfUrl={`/api/pdf/delivery/${id}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
