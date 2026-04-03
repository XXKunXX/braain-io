import { Archive } from "lucide-react";
import { getInvoices } from "@/actions/invoices";
import { InvoiceArchive } from "@/components/invoices/invoice-list";

export default async function RechnungsArchivPage() {
  const invoices = await getInvoices();
  const archived = invoices.filter((i) => i.status === "BEZAHLT" || i.status === "STORNIERT");

  const totalPaid = archived
    .filter((i) => i.status === "BEZAHLT")
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Rechnungs-Archiv</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {archived.length} abgeschlossene Rechnung{archived.length !== 1 ? "en" : ""} · {totalPaid.toLocaleString("de-DE", { style: "currency", currency: "EUR" })} bezahlt
        </p>
      </div>

      {archived.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
          <Archive className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Noch keine abgeschlossenen Rechnungen</p>
          <p className="text-xs text-gray-400 mt-1">Bezahlte und stornierte Rechnungen erscheinen hier</p>
        </div>
      ) : (
        <InvoiceArchive invoices={archived} />
      )}
    </div>
  );
}
