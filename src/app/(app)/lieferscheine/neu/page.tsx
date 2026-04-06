import { getContacts } from "@/actions/contacts";
import { getOrder } from "@/actions/orders";
import { getResources } from "@/actions/resources";
import { CreateDeliveryForm } from "@/components/delivery/create-delivery-form";
import { prisma } from "@/lib/prisma";

export default async function NeuenLieferscheinPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; baustelleId?: string }>;
}) {
  const params = await searchParams;

  const [contacts, order, allResources, baustelle] = await Promise.all([
    getContacts(),
    params.orderId ? getOrder(params.orderId) : Promise.resolve(null),
    getResources(),
    params.baustelleId
      ? prisma.baustelle.findUnique({ where: { id: params.baustelleId }, select: { id: true, contactId: true } })
      : Promise.resolve(null),
  ]);

  const orderBaustellen = order
    ? order.baustellen.map((b) => ({ id: b.id, name: b.name }))
    : [];

  const drivers = allResources.filter((r) => r.type === "FAHRER").map((r) => ({ id: r.id, name: r.name }));
  const vehicles = allResources.filter((r) => r.type === "FAHRZEUG").map((r) => ({ id: r.id, name: r.name }));

  // Disponierte Ressourcen für heute ermitteln (tagesgrenzen-sicher)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const dispositionEntries = params.orderId
    ? await prisma.dispositionEntry.findMany({
        where: {
          orderId: params.orderId,
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
          blockType: null,
        },
        include: { resource: { select: { id: true, type: true } } },
      })
    : [];

  const defaultDriverId = dispositionEntries.find((e) => e.resource.type === "FAHRER")?.resource.id ?? "";
  const defaultVehicleId = dispositionEntries.find((e) => e.resource.type === "FAHRZEUG")?.resource.id ?? "";

  const serializedOrder = order
    ? {
        id: order.id,
        title: order.title,
        contactId: order.contactId,
        quoteItems:
          order.quote?.items.map((i) => ({
            id: i.id,
            position: i.position,
            description: i.description,
            quantity: Number(i.quantity),
            unit: i.unit,
          })) ?? [],
      }
    : null;

  return (
    <CreateDeliveryForm
      contacts={contacts}
      order={serializedOrder}
      drivers={drivers}
      vehicles={vehicles}
      baustelleId={baustelle?.id}
      baustelleContactId={baustelle?.contactId ?? undefined}
      orderBaustellen={orderBaustellen}
      defaultDriverId={defaultDriverId}
      defaultVehicleId={defaultVehicleId}
    />
  );
}
