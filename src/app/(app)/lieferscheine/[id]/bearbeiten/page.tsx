import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getDeliveryNote } from "@/actions/delivery-notes";
import { getResources } from "@/actions/resources";
import { EditDeliveryForm } from "@/components/delivery/edit-delivery-form";
import { format } from "date-fns";

export default async function LieferscheinBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [raw, allResources] = await Promise.all([
    getDeliveryNote(id),
    getResources(),
  ]);

  if (!raw) notFound();

  const drivers = allResources.filter((r) => r.type === "FAHRER").map((r) => ({ id: r.id, name: r.name }));
  const vehicles = allResources.filter((r) => r.type === "FAHRZEUG").map((r) => ({ id: r.id, name: r.name }));

  const deliveryNote = {
    id: raw.id,
    contactId: raw.contactId,
    contactName: raw.contact.companyName,
    baustelleId: raw.baustelleId,
    date: format(new Date(raw.date), "yyyy-MM-dd"),
    material: raw.material,
    quantity: Number(raw.quantity),
    unit: raw.unit,
    driver: raw.driver,
    vehicle: raw.vehicle,
    notes: raw.notes,
  };

  return (
    <>
      <Header title={`Lieferschein ${raw.deliveryNumber} bearbeiten`} />
      <EditDeliveryForm
        deliveryNote={deliveryNote}
        drivers={drivers}
        vehicles={vehicles}
      />
    </>
  );
}
