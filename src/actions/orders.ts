"use server";

import { prisma } from "@/lib/prisma";
import { getNextNumber } from "@/lib/counter";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const orderSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  contactId: z.string().min(1, "Kontakt ist erforderlich"),
  quoteId: z.string().optional(),
  startDate: z.string().min(1, "Startdatum ist erforderlich"),
  endDate: z.string().min(1, "Enddatum ist erforderlich"),
  notes: z.string().optional(),
});

export type OrderFormData = z.infer<typeof orderSchema>;

export async function createOrder(data: OrderFormData) {
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { startDate, endDate, quoteId, ...orderData } = parsed.data;
  const orderNumber = await getNextNumber("order");

  const order = await prisma.order.create({
    data: {
      ...orderData,
      orderNumber,
      quoteId: quoteId || undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });

  // If created from quote, mark quote as accepted
  if (quoteId) {
    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: "ACCEPTED" },
    });
  }

  revalidatePath("/auftraege");
  revalidatePath("/disposition");
  return { order };
}

export async function updateOrder(id: string, data: OrderFormData) {
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { startDate, endDate, quoteId, ...orderData } = parsed.data;

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...orderData,
      quoteId: quoteId || undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });

  revalidatePath("/auftraege");
  revalidatePath(`/auftraege/${id}`);
  revalidatePath("/disposition");
  return { order };
}

export async function updateOrderStatus(
  id: string,
  status: "PLANNED" | "ASSIGNED" | "ACTIVE" | "COMPLETED"
) {
  const order = await prisma.order.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/auftraege");
  revalidatePath(`/auftraege/${id}`);
  revalidatePath("/disposition");
  return { order };
}

export async function deleteOrder(id: string) {
  await prisma.order.delete({ where: { id } });
  revalidatePath("/auftraege");
  revalidatePath("/disposition");
  return { success: true };
}

export async function getOrders(status?: string) {
  return prisma.order.findMany({
    where: status ? { status: status as "PLANNED" | "ACTIVE" | "COMPLETED" } : undefined,
    orderBy: { startDate: "asc" },
    include: { contact: true, quote: true },
  });
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      contact: true,
      quote: { include: { items: true } },
      deliveryNotes: { orderBy: { date: "desc" } },
    },
  });
}

export async function getOrdersForCalendar(weekStart: Date, weekEnd: Date) {
  return prisma.order.findMany({
    where: {
      OR: [
        { startDate: { lte: weekEnd }, endDate: { gte: weekStart } },
      ],
    },
    include: { contact: true },
    orderBy: { startDate: "asc" },
  });
}
