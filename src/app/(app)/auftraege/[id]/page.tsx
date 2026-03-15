import { notFound } from "next/navigation";
import { getOrder } from "@/actions/orders";
import { getContacts } from "@/actions/contacts";
import { OrderDetail } from "@/components/orders/order-detail";

export default async function AuftragDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, contacts] = await Promise.all([getOrder(id), getContacts()]);
  if (!order) notFound();

  const serializedOrder = {
    ...order,
    quote: order.quote ? {
      ...order.quote,
      totalPrice: order.quote.totalPrice.toNumber(),
      items: order.quote.items.map((i) => ({
        ...i,
        quantity: i.quantity.toNumber(),
        unitPrice: i.unitPrice.toNumber(),
        total: i.total.toNumber(),
      })),
    } : null,
    deliveryNotes: order.deliveryNotes.map((dn) => ({
      ...dn,
      quantity: dn.quantity.toNumber(),
    })),
    baustellen: order.baustellen,
  } as unknown as typeof order;

  return <OrderDetail order={serializedOrder} contacts={contacts} />;
}
