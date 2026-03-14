import { getDeliveryNote } from "@/actions/delivery-notes";
import { FillDeliveryClient } from "@/components/delivery/fill-delivery-client";
import { notFound } from "next/navigation";

export default async function AusfuellenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dn = await getDeliveryNote(id);
  if (!dn) notFound();

  // Serialize Decimal fields
  const serialized = {
    ...dn,
    quantity: Number(dn.quantity),
    date: dn.date.toISOString(),
    createdAt: dn.createdAt.toISOString(),
    updatedAt: dn.updatedAt.toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <FillDeliveryClient deliveryNote={serialized as any} />;
}
