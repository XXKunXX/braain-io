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

export async function getBaustellenForDisposition() {
  return (prisma as any).baustelle.findMany({
    where: { status: { in: ["PLANNED", "ACTIVE"] } },
    include: {
      contact: { select: { id: true, companyName: true } },
      order: { select: { id: true, orderNumber: true, title: true } },
    },
    orderBy: { startDate: "asc" },
  }) as Promise<Array<{
    id: string;
    name: string;
    status: string;
    startDate: Date;
    endDate: Date | null;
    city: string | null;
    orderId: string | null;
    contact: { id: string; companyName: string } | null;
    order: { id: string; orderNumber: string; title: string } | null;
  }>>;
}

export async function getDispositionEntries(weekStart: Date, weekEnd: Date) {
  return (prisma as any).dispositionEntry.findMany({
    where: {
      startDate: { lte: weekEnd },
      endDate: { gte: weekStart },
    },
    include: {
      resource: true,
      baustelle: {
        include: {
          contact: { select: { id: true, companyName: true } },
        },
      },
      order: { include: { contact: true } },
    },
  });
}

const entrySchema = z.object({
  resourceId: z.string().min(1, "Ressource erforderlich"),
  baustelleId: z.string().min(1, "Baustelle erforderlich"),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional(),
});

export async function createDispositionEntry(data: z.infer<typeof entrySchema>) {
  const parsed = entrySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  // Derive orderId from the baustelle (optional)
  const baustelle = await (prisma as any).baustelle.findUnique({
    where: { id: parsed.data.baustelleId },
    select: { orderId: true },
  });

  const entry = await (prisma as any).dispositionEntry.create({
    data: {
      resourceId: parsed.data.resourceId,
      baustelleId: parsed.data.baustelleId,
      orderId: baustelle?.orderId ?? null,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      notes: parsed.data.notes,
    },
    include: {
      resource: true,
      baustelle: { include: { contact: { select: { id: true, companyName: true } } } },
      order: { include: { contact: true } },
    },
  });

  revalidatePath("/disposition");
  revalidatePath("/baustellen");
  revalidatePath(`/baustellen/${parsed.data.baustelleId}`);
  return { entry };
}

export async function updateDispositionEntry(id: string, data: { startDate: string; endDate: string; notes?: string; resourceId?: string }) {
  const entry = await (prisma as any).dispositionEntry.update({
    where: { id },
    data: {
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      notes: data.notes,
      ...(data.resourceId ? { resourceId: data.resourceId } : {}),
    },
    include: {
      resource: true,
      baustelle: { include: { contact: { select: { id: true, companyName: true } } } },
      order: { include: { contact: true } },
    },
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
