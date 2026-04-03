import { getDeliveryNotes } from "@/actions/delivery-notes";
import { getContacts } from "@/actions/contacts";
import { DeliveryList } from "@/components/delivery/delivery-list";
import { CreateDeliveryButton } from "@/components/delivery/create-delivery-button";

export default async function LieferscheinePage() {
  const [deliveryNotes, contacts] = await Promise.all([
    getDeliveryNotes(),
    getContacts(),
  ]);

  // Serialize Decimal quantity
  const serialized = deliveryNotes.map((dn) => ({
    ...dn,
    quantity: Number(dn.quantity),
    invoice: dn.invoice ?? null,
  }));

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lieferscheine</h1>
          <p className="text-sm text-gray-400 mt-0.5">{deliveryNotes.length} Lieferscheine</p>
        </div>
        <CreateDeliveryButton contacts={contacts} />
      </div>
      <DeliveryList deliveryNotes={serialized} />
    </div>
  );
}
