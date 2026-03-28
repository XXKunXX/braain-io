import { notFound } from "next/navigation";
import { getMachine } from "@/actions/machines";
import { MachineDetailClient } from "@/components/machines/machine-detail-client";
import { prisma } from "@/lib/prisma";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [machine, orders, driverResources] = await Promise.all([
    getMachine(id),
    prisma.order.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE", "PENDING", "INVOICED"] } },
      select: { id: true, orderNumber: true, title: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.resource.findMany({
      where: { active: true, type: "FAHRER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!machine) notFound();

  return (
    <MachineDetailClient
      machine={machine}
      orders={orders}
      drivers={driverResources}
    />
  );
}
