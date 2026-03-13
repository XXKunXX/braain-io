import { notFound } from "next/navigation";
import { getBaustelle } from "@/actions/baustellen";
import { BaustellenDetailClient } from "@/components/baustellen/baustellen-detail-client";
import { prisma } from "@/lib/prisma";
import { getUsers } from "@/actions/users";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function BaustelleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [baustelle, resources, machines, orders, users] = await Promise.all([
    getBaustelle(id),
    prisma.resource.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.machine.findMany({
      select: { id: true, name: true, machineType: true },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE"] } },
      select: { id: true, orderNumber: true, title: true },
      orderBy: { startDate: "asc" },
    }),
    getUsers(),
  ]);

  if (!baustelle) notFound();

  const userNames = users
    .map((u: { firstName: string; lastName: string }) =>
      `${u.firstName} ${u.lastName}`.trim()
    )
    .filter(Boolean);

  return (
    <BaustellenDetailClient
      baustelle={baustelle}
      resources={resources}
      machines={machines}
      orders={orders}
      userNames={userNames}
    />
  );
}
