import { prisma } from "@/lib/prisma";
import { OffenePostenList } from "@/components/zahlungen/zahlungen-list";

export default async function OffenePostenPage() {
  const now = new Date();

  const [invoices, deliveryNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: ["ENTWURF", "VERSENDET"] } },
      orderBy: { dueDate: "asc" },
      include: {
        contact: { select: { id: true, companyName: true } },
        order: { select: { id: true, orderNumber: true, title: true } },
      },
    }),
    prisma.deliveryNote.findMany({
      where: { invoiceId: null },
      orderBy: { date: "desc" },
      include: {
        contact: { select: { id: true, companyName: true } },
        order: { select: { id: true, orderNumber: true, title: true } },
      },
    }),
  ]);

  const serializedInvoices = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    status: inv.status,
    totalAmount: Number(inv.totalAmount),
    contact: inv.contact,
    order: inv.order,
  }));

  const serializedDeliveryNotes = deliveryNotes.map((dn) => ({
    id: dn.id,
    deliveryNumber: dn.deliveryNumber,
    date: dn.date,
    material: dn.material,
    quantity: Number(dn.quantity),
    unit: dn.unit,
    contact: dn.contact,
    order: dn.order,
  }));

  const totalOutstanding = serializedInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalOverdue = serializedInvoices
    .filter((i) => i.status === "VERSENDET" && i.dueDate && new Date(i.dueDate) < now)
    .reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Offene Posten</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {invoices.length} offene Rechnungen · {deliveryNotes.length} nicht verrechnet
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Ausstehend gesamt</p>
          <p className="text-lg font-bold text-gray-900">
            {totalOutstanding.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Davon überfällig</p>
          <p className={`text-lg font-bold ${totalOverdue > 0 ? "text-red-600" : "text-gray-400"}`}>
            {totalOverdue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Noch nicht verrechnet</p>
          <p className={`text-lg font-bold ${deliveryNotes.length > 0 ? "text-blue-600" : "text-gray-400"}`}>
            {deliveryNotes.length} Lieferschein{deliveryNotes.length !== 1 ? "e" : ""}
          </p>
        </div>
      </div>

      <OffenePostenList invoices={serializedInvoices} deliveryNotes={serializedDeliveryNotes} />
    </div>
  );
}
