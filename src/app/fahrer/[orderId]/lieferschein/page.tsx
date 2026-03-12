import { notFound } from "next/navigation";
import { getOrderForDriverApp } from "@/actions/driver";
import { DeliverySignForm } from "@/components/fahrer/delivery-sign-form";

export default async function FahrerLieferscheinPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderForDriverApp(orderId);
  if (!order) notFound();

  const items = order.quote?.items.map((i) => ({
    id: i.id,
    description: i.description,
    quantity: Number(i.quantity),
    unit: i.unit,
  })) ?? [];

  return (
    <DeliverySignForm
      orderId={order.id}
      orderTitle={order.title}
      contactId={order.contactId}
      contactName={order.contact.companyName}
      items={items}
    />
  );
}
