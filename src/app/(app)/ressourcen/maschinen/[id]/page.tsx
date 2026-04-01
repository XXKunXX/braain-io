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

  const [machine, dispositionResource] = await Promise.all([
    getMachine(id),
    prisma.resource.findUnique({
      where: { machineId: id },
      include: {
        entries: {
          orderBy: { startDate: "asc" },
          include: {
            order: { select: { id: true, orderNumber: true, title: true } },
            baustelle: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  if (!machine) notFound();

  return (
    <MachineDetailClient
      machine={machine}
      dispositionEntries={dispositionResource?.entries ?? []}
    />
  );
}
