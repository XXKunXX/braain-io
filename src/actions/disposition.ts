"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { startOfDay, endOfDay, format } from "date-fns";
import { de } from "date-fns/locale";

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
  baustelleId: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional(),
  blockType: z.enum(["URLAUB", "SERVICE", "KRANK"]).optional(),
});

export async function createDispositionEntry(data: z.infer<typeof entrySchema>) {
  const parsed = entrySchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  // Require either baustelleId or blockType
  if (!parsed.data.baustelleId && !parsed.data.blockType) {
    return { error: { baustelleId: ["Baustelle oder Sperrtyp erforderlich"] } };
  }

  // Derive orderId from the baustelle (optional)
  let orderId: string | null = null;
  if (parsed.data.baustelleId) {
    const baustelle = await (prisma as any).baustelle.findUnique({
      where: { id: parsed.data.baustelleId },
      select: { orderId: true },
    });
    orderId = baustelle?.orderId ?? null;
  }

  const entry = await (prisma as any).dispositionEntry.create({
    data: {
      resourceId: parsed.data.resourceId,
      baustelleId: parsed.data.baustelleId ?? null,
      orderId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      notes: parsed.data.notes,
      blockType: parsed.data.blockType ?? null,
    },
    include: {
      resource: true,
      baustelle: { include: { contact: { select: { id: true, companyName: true } } } },
      order: { include: { contact: true } },
    },
  });

  // Set Baustelle status to ACTIVE when a disposition entry is created
  if (parsed.data.baustelleId) {
    await (prisma as any).baustelle.update({
      where: { id: parsed.data.baustelleId },
      data: { status: "ACTIVE" },
    });
  }

  revalidatePath("/disposition");
  revalidatePath("/baustellen");
  if (parsed.data.baustelleId) revalidatePath(`/baustellen/${parsed.data.baustelleId}`);
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

export async function sendTagesplan(dateISO: string) {
  const day = new Date(dateISO);
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const dateStr = format(day, "EEEE, d. MMMM", { locale: de });

  // Fetch all entries for the day
  const entries = await (prisma as any).dispositionEntry.findMany({
    where: { startDate: { lte: dayEnd }, endDate: { gte: dayStart }, blockType: null },
    include: {
      resource: { select: { id: true, name: true, clerkUserId: true } },
      baustelle: { select: { id: true, name: true, city: true } },
    },
  });

  // Group entries by resource
  const byResource: Record<string, { resource: { id: string; name: string; clerkUserId: string | null }; baustellenNames: string[] }> = {};
  for (const e of entries) {
    if (!byResource[e.resourceId]) {
      byResource[e.resourceId] = { resource: e.resource, baustellenNames: [] };
    }
    if (e.baustelle?.name) byResource[e.resourceId].baustellenNames.push(e.baustelle.name);
  }

  let sent = 0;
  for (const { resource, baustellenNames } of Object.values(byResource)) {
    if (!resource.clerkUserId) continue;
    const msg = baustellenNames.length > 0
      ? `Einsätze: ${[...new Set(baustellenNames)].join(", ")}`
      : "Kein Einsatz geplant";
    await prisma.notification.create({
      data: {
        clerkUserId: resource.clerkUserId,
        title: `Tagesplan ${dateStr}`,
        message: msg,
        type: "TAGESPLAN",
        link: "/fahrer/tagesplan",
      },
    });
    sent++;
  }

  return { sent };
}
