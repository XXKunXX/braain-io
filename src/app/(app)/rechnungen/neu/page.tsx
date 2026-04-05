import { getContacts } from "@/actions/contacts";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/actions/settings";
import { CreateInvoiceForm } from "@/components/invoices/create-invoice-form";

export default async function NeueRechnungPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; contactId?: string }>;
}) {
  const { orderId, contactId } = await searchParams;

  const [contacts, orders, settings] = await Promise.all([
    getContacts(),
    prisma.order.findMany({
      where: { status: { in: ["OPEN", "DISPONIERT", "IN_LIEFERUNG", "VERRECHNET", "ABGESCHLOSSEN"] } },
      select: { id: true, orderNumber: true, title: true, contactId: true },
      orderBy: { createdAt: "desc" },
    }),
    getSettings(),
  ]);

  const prefillOrder = orderId ? orders.find((o) => o.id === orderId) : undefined;

  return (
    <CreateInvoiceForm
      contacts={contacts}
      orders={orders}
      defaultVatRate={Number(settings.vatRate)}
      prefillOrderId={prefillOrder?.id}
      prefillContactId={prefillOrder?.contactId ?? contactId}
    />
  );
}
