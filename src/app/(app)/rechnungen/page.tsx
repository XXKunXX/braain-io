import { Euro } from "lucide-react";
import { getInvoices } from "@/actions/invoices";
import { InvoiceList } from "@/components/invoices/invoice-list";

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
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Rechnungen</h1>
        <p className="text-sm text-gray-400 mt-0.5">{invoices.length} Rechnung{invoices.length !== 1 ? "en" : ""}</p>
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

      {invoices.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
          <Euro className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Noch keine Rechnungen</p>
          <p className="text-xs text-gray-400 mt-1">Erstellen Sie Ihre erste Rechnung</p>
        </div>
      ) : (
        <InvoiceList invoices={invoices} />
      )}
    </div>
  );
}
