"use server";

import { prisma } from "@/lib/prisma";
import { getNextNumber } from "@/lib/counter";
import { revalidatePath } from "next/cache";

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
      deliveryNotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, deliveryNumber: true },
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
  const deliveryNumber = await getNextNumber("delivery");
  const deliveryNote = await prisma.deliveryNote.create({
    data: {
      deliveryNumber,
      orderId: data.orderId,
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

  // Create a task for the order owner to issue an invoice
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    select: { title: true, contactId: true, quote: { select: { assignedTo: true } } },
  });
  if (order) {
    await prisma.task.create({
      data: {
        title: `Rechnung erstellen – ${order.title}`,
        description: `Lieferschein ${deliveryNote.deliveryNumber} wurde abgeschlossen. Bitte Rechnung ausstellen.`,
        contactId: order.contactId,
        deliveryNoteId: deliveryNote.id,
        assignedTo: order.quote?.assignedTo ?? null,
        priority: "HIGH",
        status: "OPEN",
      },
    });
  }

  revalidatePath("/lieferscheine");
  revalidatePath("/aufgaben");
  revalidatePath(`/fahrer/${data.orderId}`);
  return { deliveryNote };
}
