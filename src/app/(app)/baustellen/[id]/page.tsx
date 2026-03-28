import { notFound } from "next/navigation";
import { getBaustelle } from "@/actions/baustellen";
import { BaustellenDetailClient } from "@/components/baustellen/baustellen-detail-client";
import { prisma } from "@/lib/prisma";
import { getUsers } from "@/actions/users";

export default async function BaustelleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [baustelle, orders, users] = await Promise.all([
    getBaustelle(id),
    prisma.order.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE", "PENDING", "INVOICED"] } },
      select: { id: true, orderNumber: true, title: true },
      orderBy: { startDate: "asc" },
    }),
    getUsers(),
  ]);

  if (!baustelle) notFound();

  const userNames = users
    .filter((u: { firstName: string; lastName: string; role: string }) => u.role !== "Fahrer")
    .map((u: { firstName: string; lastName: string }) =>
      `${u.firstName} ${u.lastName}`.trim()
    )
    .filter(Boolean);

  return (
    <BaustellenDetailClient
      baustelle={baustelle}
      orders={orders}
      userNames={userNames}
    />
  );
}
