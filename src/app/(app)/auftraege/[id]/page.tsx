import { notFound } from "next/navigation";
import { getOrder } from "@/actions/orders";
import { getContacts } from "@/actions/contacts";
import { getUsers } from "@/actions/users";
import { getOrderActivity } from "@/actions/activity";
import { OrderDetail } from "@/components/orders/order-detail";

export default async function AuftragDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, contacts, users, activity] = await Promise.all([getOrder(id), getContacts(), getUsers(), getOrderActivity(id)]);
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
    paymentMilestones: (order.paymentMilestones ?? []).map((m) => ({
      ...m,
      amount: m.amount.toNumber(),
      skontoPercent: m.skontoPercent ? m.skontoPercent.toNumber() : null,
    })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const filteredUsers = users.filter((u) => u.role !== "Fahrer");
  return <OrderDetail order={serializedOrder} contacts={contacts} users={filteredUsers} activity={activity} />;
}
