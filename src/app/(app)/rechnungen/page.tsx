import Link from "next/link";
import { Plus, FileText, Euro, Clock, CheckCircle, XCircle } from "lucide-react";
import { getInvoices } from "@/actions/invoices";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ENTWURF:    { label: "Entwurf",   color: "border border-gray-200 text-gray-500 bg-gray-50",    icon: FileText },
  VERSENDET:  { label: "Versendet", color: "border border-blue-200 text-blue-700 bg-blue-50",     icon: Clock },
  BEZAHLT:    { label: "Bezahlt",   color: "border border-green-200 text-green-700 bg-green-50",  icon: CheckCircle },
  STORNIERT:  { label: "Storniert", color: "border border-red-200 text-red-600 bg-red-50",        icon: XCircle },
};

function fmt(n: number | { toNumber(): number }) {
  return Number(typeof n === "number" ? n : n.toNumber()).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

export default async function RechnungenPage() {
  const invoices = await getInvoices();

  const totalOpen = invoices
    .filter((i) => i.status !== "BEZAHLT" && i.status !== "STORNIERT")
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);

  const totalPaid = invoices
    .filter((i) => i.status === "BEZAHLT")
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Rechnungen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{invoices.length} Rechnung{invoices.length !== 1 ? "en" : ""}</p>
        </div>
        <Link href="/rechnungen/neu" className="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm gap-1.5">
          <Plus className="h-4 w-4" />
          Neue Rechnung
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Gesamt</p>
          <p className="text-lg font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Offen (Betrag)</p>
          <p className="text-lg font-bold text-orange-600">{fmt(totalOpen)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Bezahlt</p>
          <p className="text-lg font-bold text-green-600">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Entwürfe</p>
          <p className="text-lg font-bold text-gray-600">{invoices.filter((i) => i.status === "ENTWURF").length}</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {invoices.length === 0 ? (
          <div className="py-16 text-center">
            <Euro className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">Noch keine Rechnungen</p>
            <p className="text-xs text-gray-400 mt-1">Erstellen Sie Ihre erste Rechnung</p>
            <Link href="/rechnungen/neu" className="inline-flex items-center justify-center rounded-md font-medium transition-colors mt-4 bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm gap-1.5">
              <Plus className="h-4 w-4" />
              Neue Rechnung
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Table header */}
            <div className="grid grid-cols-[180px_1fr_140px_120px_100px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200">
              {["Nummer", "Empfänger / Auftrag", "Datum", "Betrag", "Status"].map((h) => (
                <span key={h} className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
              ))}
            </div>
            {invoices.map((invoice) => {
              const cfg = statusConfig[invoice.status] ?? statusConfig.ENTWURF;
              const StatusIcon = cfg.icon;
              return (
                <Link
                  key={invoice.id}
                  href={`/rechnungen/${invoice.id}`}
                  className="grid grid-cols-[180px_1fr_140px_120px_100px] gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-center"
                >
                  <span className="text-sm font-mono font-semibold text-gray-900">{invoice.invoiceNumber}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{invoice.contact.companyName}</p>
                    {invoice.order && (
                      <p className="text-xs text-gray-400 truncate">{invoice.order.orderNumber} – {invoice.order.title}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">{format(new Date(invoice.invoiceDate), "dd.MM.yyyy", { locale: de })}</p>
                    {invoice.dueDate && (
                      <p className="text-xs text-gray-400">Fällig: {format(new Date(invoice.dueDate), "dd.MM.yyyy", { locale: de })}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt(invoice.totalAmount)}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full w-fit ${cfg.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
