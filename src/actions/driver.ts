"use server";

import { prisma } from "@/lib/prisma";
import { getNextNumber } from "@/lib/counter";
import { revalidatePath } from "next/cache";
import { createInvoiceTaskForDeliveryNote } from "@/actions/delivery-notes";
import { createNotificationsForUsers, getNonDriverUserIds } from "@/actions/notifications";

async function fetchOrdersForEntries(dateStr: string, resourceId?: string) {
  const date = new Date(dateStr);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const entries = await prisma.dispositionEntry.findMany({
    where: {
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
      ...(resourceId ? { resourceId } : {}),
    },
    orderBy: { startDate: "asc" },
    include: {
      order: {
        include: {
          contact: true,
          quote: { select: { siteAddress: true } },
        },
      },
    },
  });

  const seen = new Set<string>();
  return entries
    .filter((e) => e.order != null)
    .map((e) => ({
      ...e.order!,
      startDate: e.startDate,
      endDate: e.endDate,
    }))
    .filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
}

export async function getOrdersForDriverApp(dateStr: string) {
  return fetchOrdersForEntries(dateStr);
}

export async function getOrdersForDriverByClerkId(dateStr: string, clerkUserId: string) {
  // Find the Resource linked to this Clerk user
  const resource = await prisma.resource.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!resource) return [];
  return fetchOrdersForEntries(dateStr, resource.id);
}

async function fetchBaustellenForEntries(dateStr: string, resourceId?: string) {
  const date = new Date(dateStr);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const entries = await prisma.dispositionEntry.findMany({
    where: {
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
      baustelleId: { not: null },
      ...(resourceId ? { resourceId } : {}),
    },
    orderBy: { startDate: "asc" },
    include: {
      baustelle: {
        include: {
          contact: { select: { companyName: true } },
          order: {
            select: {
              id: true,
              title: true,
              notes: true,
              quote: {
                select: {
                  items: { orderBy: { position: "asc" }, select: { description: true, quantity: true, unit: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  return entries
    .filter((e) => e.baustelle != null)
    .map((e) => ({ ...e.baustelle!, entryStart: e.startDate, entryEnd: e.endDate }))
    .filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
}

export async function getBaustellenForDriverApp(dateStr: string) {
  return fetchBaustellenForEntries(dateStr);
}

export async function getBaustellenForDriverByClerkId(dateStr: string, clerkUserId: string) {
  const resource = await prisma.resource.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!resource) return [];
  return fetchBaustellenForEntries(dateStr, resource.id);
}

export async function getBaustelleForDriverApp(id: string) {
  return prisma.baustelle.findUnique({
    where: { id },
    include: {
      contact: { select: { companyName: true, address: true, postalCode: true, city: true } },
      order: {
        select: {
          id: true,
          title: true,
          notes: true,
          quote: {
            select: {
              items: { orderBy: { position: "asc" }, select: { description: true, quantity: true, unit: true } },
            },
          },
        },
      },
      deliveryNotes: { orderBy: { createdAt: "desc" }, select: { id: true, deliveryNumber: true } },
    },
  });
}

export async function getBaustelleEntryForDate(baustelleId: string, dateStr: string) {
  const date = new Date(dateStr);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return prisma.dispositionEntry.findFirst({
    where: {
      baustelleId,
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function getDeliveryNoteForFahrerApp(id: string) {
  return prisma.deliveryNote.findUnique({
    where: { id },
    include: { contact: true },
  });
}

export async function getOrderForDriverApp(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      contact: true,
      quote: {
        select: {
          siteAddress: true,
          items: {
            orderBy: { position: "asc" },
            select: { id: true, position: true, description: true, quantity: true, unit: true },
          },
        },
      },
    },
  });
}

export async function createSignedDeliveryNote(data: {
  orderId: string;
  contactId: string;
  date: string;
  lines: { material: string; quantity: number; unit: string }[];
  driver: string;
  vehicle: string;
  notes: string;
  signatureUrl: string;
  signerName: string;
}) {
  const materialText = data.lines
    .map((l) => `${l.material}: ${l.quantity} ${l.unit}`)
    .join("\n");
  const firstLine = data.lines[0];

  // Look up the Baustelle linked to this order so the delivery note appears there
  const baustelle = await prisma.baustelle.findFirst({
    where: { orderId: data.orderId },
    select: { id: true },
  });

  const deliveryNumber = await getNextNumber("delivery");
  const deliveryNote = await prisma.deliveryNote.create({
    data: {
      deliveryNumber,
      orderId: data.orderId,
      baustelleId: baustelle?.id ?? null,
      contactId: data.contactId,
      date: new Date(data.date),
      material: materialText,
      quantity: firstLine?.quantity ?? 0,
      unit: firstLine?.unit ?? "t",
      driver: data.driver || null,
      vehicle: data.vehicle || null,
      notes: data.notes ? `${data.notes}\nUnterschrift von: ${data.signerName}` : `Unterschrift von: ${data.signerName}`,
      signatureUrl: data.signatureUrl || null,
    },
  });
  // Mark order as completed
  await prisma.order.update({
    where: { id: data.orderId },
    data: { status: "COMPLETED" },
  });

  // Create invoice task (idempotent — prevents duplicates)
  await createInvoiceTaskForDeliveryNote(deliveryNote.id);

  // Notify non-driver users about the signed delivery note
  try {
    const userIds = await getNonDriverUserIds();
    await createNotificationsForUsers(userIds, {
      title: `Lieferschein unterschrieben: #${deliveryNumber}`,
      message: data.driver ? `Fahrer: ${data.driver}` : "Lieferschein wurde unterschrieben.",
      type: "SUCCESS",
      link: `/lieferscheine/${deliveryNote.id}`,
    });
  } catch {
    // Notification errors must not block the main flow
  }

  revalidatePath("/lieferscheine");
  revalidatePath("/aufgaben");
  revalidatePath(`/fahrer/${data.orderId}`);
  if (baustelle) revalidatePath(`/baustellen/${baustelle.id}`);
  return { deliveryNoteId: deliveryNote.id };
}
