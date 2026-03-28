import { prisma } from "@/lib/prisma";
import { getUsers } from "@/actions/users";
import { getContacts } from "@/actions/contacts";
import { NeueBaustelleClient } from "@/components/baustellen/neue-baustelle-client";

export default async function NeueBaustellePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  const [orders, users, contacts] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE", "PENDING", "INVOICED"] } },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        startDate: true,
        endDate: true,
        contact: {
          select: { address: true, postalCode: true, city: true, firstName: true, lastName: true, phone: true },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    getUsers(),
    getContacts(),
  ]);

  const userNames = users
    .filter((u) => u.role !== "Fahrer")
    .map((u) => `${u.firstName} ${u.lastName}`.trim())
    .filter(Boolean);

  const prefillOrder = orderId ? orders.find((o) => o.id === orderId) ?? null : null;

  return (
    <NeueBaustelleClient
      orders={orders}
      userNames={userNames}
      contacts={contacts}
      prefillOrder={prefillOrder}
    />
  );
}
