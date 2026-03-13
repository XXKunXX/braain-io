import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getDeliveryNote } from "@/actions/delivery-notes";
import { DeliveryDetail } from "@/components/delivery/delivery-detail";

export default async function LieferscheinDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const raw = await getDeliveryNote(id);
  if (!raw) notFound();

  const deliveryNote = {
    ...raw,
    quantity: raw.quantity.toNumber(),
  } as unknown as typeof raw;

  return (
    <>
      <Header title={`Lieferschein ${deliveryNote.deliveryNumber}`} />
      <div className="p-4 md:p-6">
        <DeliveryDetail deliveryNote={deliveryNote} />
      </div>
    </>
  );
}
