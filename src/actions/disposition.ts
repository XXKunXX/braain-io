"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getResources() {
  return (prisma as any).resource.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      assignedDriver: { select: { id: true, name: true } },
    },
  }) as Promise<Array<{
    id: string;
    name: string;
    type: string;
    email: string | null;
    phone: string | null;
    description: string | null;
    active: boolean;
    clerkUserId: string | null;
    licensePlate: string | null;
    driverResourceId: string | null;
    assignedDriver: { id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }>>;
}

export async function getOrdersForDisposition() {
  return prisma.order.findMany({
    where: { status: { in: ["ACTIVE", "PLANNED"] } },
    include: { contact: true },
    orderBy: { startDate: "asc" },
  });
}

export async function getDispositionEntries(weekStart: Date, weekEnd: Date) {
  return prisma.dispositionEntry.findMany({
    where: {
      startDate: { lte: weekEnd },
      endDate: { gte: weekStart },
    },
    include: {
      resource: true,
      order: { include: { contact: true } },
    },
  });
}

const entrySchema = z.object({
  resourceId: z.string().min(1, "Ressource erforderlich"),
  orderId: z.string().min(1, "Auftrag erforderlich"),
  baustelleId: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional(),
});

export async function createDispositionEntry(data: z.infer<typeof entrySchema>) {
  const parsed = entrySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const [entry] = await Promise.all([
    prisma.dispositionEntry.create({
      data: {
        resourceId: parsed.data.resourceId,
        orderId: parsed.data.orderId,
        baustelleId: parsed.data.baustelleId || null,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        notes: parsed.data.notes,
      },
      include: { resource: true, order: { include: { contact: true } } },
    }),
    prisma.order.updateMany({
      where: { id: parsed.data.orderId, status: "PLANNED" },
      data: { status: "ACTIVE" },
    }),
  ]);

  revalidatePath("/disposition");
  revalidatePath("/auftraege");
  if (parsed.data.baustelleId) revalidatePath(`/baustellen/${parsed.data.baustelleId}`);
  return { entry };
}

export async function updateDispositionEntry(id: string, data: { startDate: string; endDate: string; notes?: string; resourceId?: string }) {
  const entry = await prisma.dispositionEntry.update({
    where: { id },
    data: {
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      notes: data.notes,
      ...(data.resourceId ? { resourceId: data.resourceId } : {}),
    },
    include: { resource: true, order: { include: { contact: true } } },
  });
  revalidatePath("/disposition");
  return { entry };
}

export async function deleteDispositionEntry(id: string) {
  await prisma.dispositionEntry.delete({ where: { id } });
  revalidatePath("/disposition");
  return { success: true };
}

const resourceSchema = z.object({
  name: z.string().min(1, "Name erforderlich"),
  type: z.enum(["FAHRER", "MASCHINE", "FAHRZEUG", "OTHER"]),
  description: z.string().optional(),
});

export async function createResource(data: z.infer<typeof resourceSchema>) {
  const parsed = resourceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const resource = await prisma.resource.create({ data: parsed.data });
  revalidatePath("/disposition");
  return { resource };
}

export async function deleteResource(id: string) {
  await prisma.resource.delete({ where: { id } });
  revalidatePath("/disposition");
  return { success: true };
}
