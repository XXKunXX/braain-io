import { getContacts } from "@/actions/contacts";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/actions/settings";
import { CreateInvoiceForm } from "@/components/invoices/create-invoice-form";

export default async function NeueRechnungPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; contactId?: string; from?: string }>;
}) {
  const { orderId, contactId, from } = await searchParams;

  const [contacts, orders, settings, quoteItems] = await Promise.all([
    getContacts(),
    prisma.order.findMany({
      where: { status: { in: ["OPEN", "DISPONIERT", "IN_LIEFERUNG", "VERRECHNET", "ABGESCHLOSSEN"] } },
      select: { id: true, orderNumber: true, title: true, contactId: true },
      orderBy: { createdAt: "desc" },
    }),
    getSettings(),
    orderId
      ? prisma.quoteItem.findMany({
          where: { quote: { orders: { some: { id: orderId } } } },
          select: { description: true, note: true, quantity: true, unit: true, unitPrice: true },
          orderBy: { position: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const prefillOrder = orderId ? orders.find((o) => o.id === orderId) : undefined;

  const prefillItems = quoteItems.map((i) => ({
    description: i.description,
    note: i.note ?? "",
    quantity: String(Number(i.quantity)),
    unit: i.unit,
    unitPrice: String(Number(i.unitPrice)),
  }));

  return (
    <CreateInvoiceForm
      contacts={contacts}
      orders={orders}
      defaultVatRate={Number(settings.vatRate)}
      prefillOrderId={prefillOrder?.id}
      prefillContactId={prefillOrder?.contactId ?? contactId}
      prefillItems={prefillItems.length > 0 ? prefillItems : undefined}
      from={from}
    />
  );
}
