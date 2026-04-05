"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { startOfDay, endOfDay, format } from "date-fns";
import { de } from "date-fns/locale";
import { createNotificationsForUsers, getNonDriverUserIds } from "@/actions/notifications";

export async function getResources() {
  // Ensure all machines have a corresponding Resource record (sync missing ones)
  const machines = await (prisma as any).machine.findMany({
    where: { resource: null },
    select: { id: true, name: true, machineType: true, licensePlate: true },
  });
  if (machines.length > 0) {
    await (prisma as any).resource.createMany({
      data: machines.map((m: { id: string; name: string; machineType: string; licensePlate: string | null }) => ({
        name: m.name,
        type: "MASCHINE",
        licensePlate: m.licensePlate ?? null,
        description: m.machineType,
        machineId: m.id,
      })),
      skipDuplicates: true,
    });
  }

  return (prisma as any).resource.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      email: true,
      phone: true,
      description: true,
      active: true,
      clerkUserId: true,
      licensePlate: true,
      driverResourceId: true,
      machineId: true,
      createdAt: true,
      updatedAt: true,
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
    machineId: string | null;
    assignedDriver: { id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }>>;
}

export async function getBaustellenForDisposition() {
  return (prisma as any).baustelle.findMany({
    where: { status: { in: ["OPEN", "DISPONIERT", "IN_LIEFERUNG", "VERRECHNET"] } },
    include: {
      contact: { select: { id: true, companyName: true, firstName: true, lastName: true } },
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
    contact: { id: string; companyName: string | null; firstName: string | null; lastName: string | null } | null;
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
      resource: { select: { id: true, name: true, type: true } },
      baustelle: {
        include: {
          contact: { select: { id: true, companyName: true, firstName: true, lastName: true } },
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
      baustelle: { include: { contact: { select: { id: true, companyName: true, firstName: true, lastName: true } } } },
      order: { include: { contact: true } },
    },
  });

  // Notify the assigned driver (if resource is a Fahrer with a linked Clerk user)
  if (entry.resource?.clerkUserId && entry.resource?.type === "FAHRER") {
    try {
      const baustelleName =
        entry.baustelle?.name ??
        entry.order?.contact?.companyName ??
        "Baustelle";
      await prisma.notification.create({
        data: {
          clerkUserId: entry.resource.clerkUserId,
          title: `Neue Disposition: ${baustelleName}`,
          message: "Du wurdest für einen Einsatz eingeplant.",
          type: "INFO",
          link: "/fahrer",
        },
      });
    } catch {
      // Notification errors must not block the main flow
    }
  }

  // Set Baustelle status to DISPONIERT when a disposition entry is created
  if (parsed.data.baustelleId) {
    await (prisma as any).baustelle.update({
      where: { id: parsed.data.baustelleId },
      data: { status: "DISPONIERT" },
    });
  }

  // Set Order status to DISPONIERT when a disposition entry is created for it
  if (orderId) {
    await (prisma as any).order.update({
      where: { id: orderId },
      data: { status: "DISPONIERT" },
    });
    revalidatePath("/auftraege");
    revalidatePath(`/auftraege/${orderId}`);
  }

  revalidatePath("/disposition");
  revalidatePath("/baustellen");
  revalidatePath("/fahrer");
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
      baustelle: { include: { contact: { select: { id: true, companyName: true, firstName: true, lastName: true } } } },
      order: { include: { contact: true } },
    },
  });
  revalidatePath("/disposition");
  return { entry };
}

export async function deleteDispositionEntry(id: string) {
  // Fetch the entry to find its resource and baustelle/order
  const entry = await (prisma as any).dispositionEntry.findUnique({
    where: { id },
    select: {
      baustelleId: true,
      orderId: true,
      startDate: true,
      endDate: true,
      resource: { select: { id: true, type: true, assignedDriver: { select: { id: true } } } },
    },
  });

  await prisma.dispositionEntry.delete({ where: { id } });

  // Also delete the paired driver entry if this was a vehicle with a Stammfahrer
  if (entry?.resource?.assignedDriver?.id) {
    const driverId = entry.resource.assignedDriver.id;
    const paired = await (prisma as any).dispositionEntry.findFirst({
      where: {
        resourceId: driverId,
        ...(entry.baustelleId ? { baustelleId: entry.baustelleId } : { orderId: entry.orderId }),
        startDate: entry.startDate,
        endDate: entry.endDate,
      },
    });
    if (paired) {
      await prisma.dispositionEntry.delete({ where: { id: paired.id } });
    }
  }

  const now = new Date();

  // If this entry was linked to a Baustelle, check if there are remaining future/current entries
  // and set the Baustelle status back to PLANNED if none remain
  let resetBaustelleId: string | null = null;
  if (entry?.baustelleId) {
    const remainingBaustelleEntries = await (prisma as any).dispositionEntry.count({
      where: { baustelleId: entry.baustelleId, endDate: { gte: now } },
    });
    if (remainingBaustelleEntries === 0) {
      await (prisma as any).baustelle.update({
        where: { id: entry.baustelleId },
        data: { status: "OPEN" },
      });
      resetBaustelleId = entry.baustelleId;
      revalidatePath("/baustellen");
      revalidatePath(`/baustellen/${entry.baustelleId}`);

      // Also reset the Order if all its Baustellen have no remaining future/current entries
      const baustelle = await (prisma as any).baustelle.findUnique({
        where: { id: entry.baustelleId },
        select: { orderId: true },
      });
      if (baustelle?.orderId) {
        const remainingOrderEntries = await (prisma as any).dispositionEntry.count({
          where: { orderId: baustelle.orderId, endDate: { gte: now } },
        });
        if (remainingOrderEntries === 0) {
          await (prisma as any).order.update({
            where: { id: baustelle.orderId },
            data: { status: "OPEN" },
          });
          revalidatePath("/auftraege");
          revalidatePath(`/auftraege/${baustelle.orderId}`);
        }
      }
    }
  }

  // If this entry was linked directly to an Order (without a Baustelle), check remaining future/current entries
  if (!entry?.baustelleId && entry?.orderId) {
    const remainingEntries = await (prisma as any).dispositionEntry.count({
      where: { orderId: entry.orderId, endDate: { gte: now } },
    });
    if (remainingEntries === 0) {
      await (prisma as any).order.update({
        where: { id: entry.orderId },
        data: { status: "OPEN" },
      });
      revalidatePath("/auftraege");
      revalidatePath(`/auftraege/${entry.orderId}`);
    }
  }

  revalidatePath("/disposition");
  revalidatePath("/fahrer");
  return { success: true, resetBaustelleId };
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
