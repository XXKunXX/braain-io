import { getBaustellen } from "@/actions/baustellen";
import { BaustellenListClient } from "@/components/baustellen/baustellen-list-client";
import { prisma } from "@/lib/prisma";
import { getUsers } from "@/actions/users";

export default async function BaustellenPage() {
  const [baustellen, orders, users] = await Promise.all([
    getBaustellen(),
    prisma.order.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE", "PENDING", "INVOICED"] } },
      select: { id: true, orderNumber: true, title: true },
      orderBy: { startDate: "asc" },
    }),
    getUsers(),
  ]);

  const userNames = users
    .filter((u) => u.role !== "Fahrer")
    .map((u) => `${u.firstName} ${u.lastName}`.trim())
    .filter(Boolean);

  return (
    <BaustellenListClient
      baustellen={baustellen}
      orders={orders}
      userNames={userNames}
    />
  );
}
