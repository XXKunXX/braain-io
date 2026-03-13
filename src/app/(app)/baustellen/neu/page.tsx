import { prisma } from "@/lib/prisma";
import { getUsers } from "@/actions/users";
import { NeueBaustelleClient } from "@/components/baustellen/neue-baustelle-client";

export default async function NeueBaustellePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  const [orders, users] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE"] } },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        startDate: true,
        endDate: true,
        contact: {
          select: { address: true, postalCode: true, city: true, contactPerson: true, phone: true },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    getUsers(),
  ]);

  const userNames = users
    .map((u) => `${u.firstName} ${u.lastName}`.trim())
    .filter(Boolean);

  const prefillOrder = orderId ? orders.find((o) => o.id === orderId) ?? null : null;

  return (
    <NeueBaustelleClient
      orders={orders}
      userNames={userNames}
      prefillOrder={prefillOrder}
    />
  );
}
