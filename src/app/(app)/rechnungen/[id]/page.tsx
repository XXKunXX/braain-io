import { notFound } from "next/navigation";
import { getInvoice } from "@/actions/invoices";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";

export default async function RechnungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const serialized = {
    ...invoice,
    subtotal: Number(invoice.subtotal),
    vatRate: Number(invoice.vatRate),
    vatAmount: Number(invoice.vatAmount),
    totalAmount: Number(invoice.totalAmount),
    items: invoice.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      vatRate: Number(item.vatRate),
    })),
    deliveryNotes: (invoice.deliveryNotes ?? []).map((dn) => ({
      ...dn,
      quantity: Number(dn.quantity),
    })),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <InvoiceDetail invoice={serialized as any} />;
}
