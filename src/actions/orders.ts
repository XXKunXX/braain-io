"use server";

import { prisma } from "@/lib/prisma";
import { getNextNumber } from "@/lib/counter";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createNotificationsForUsers, getNonDriverUserIds } from "@/actions/notifications";

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

  // Notify all non-driver users about the new order
  try {
    const userIds = await getNonDriverUserIds();
    await createNotificationsForUsers(userIds, {
      title: `Neuer Auftrag: ${orderData.title}`,
      message: `Auftrag #${orderNumber} wurde erstellt.`,
      type: "INFO",
      link: `/auftraege/${order.id}`,
    });
  } catch {
    // Notification errors must not block the main flow
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

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  COMPLETED: "Abgeschlossen",
};

export async function updateOrderStatus(
  id: string,
  status: "PLANNED" | "ACTIVE" | "COMPLETED"
) {
  const order = await prisma.order.update({
    where: { id },
    data: { status },
  });

  // Notify all non-driver users about the status change
  try {
    const userIds = await getNonDriverUserIds();
    await createNotificationsForUsers(userIds, {
      title: `Auftrag Status geändert: ${order.title}`,
      message: `Status wurde auf "${STATUS_LABELS[status] ?? status}" gesetzt.`,
      type: "INFO",
      link: `/auftraege/${id}`,
    });
  } catch {
    // Notification errors must not block the main flow
  }

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
      baustellen: {
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          address: true,
          city: true,
        },
      },
      paymentMilestones: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function createOrderWithDetails(data: {
  // Order
  title: string;
  contactId: string;
  startDate: string;
  endDate: string;
  notes?: string;
  // Optional Baustelle
  baustelle?: {
    address?: string;
    postalCode?: string;
    city?: string;
  };
  // Optional Leistungen (creates a Quote)
  items?: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }[];
}) {
  const orderNumber = await getNextNumber("order");

  const order = await prisma.order.create({
    data: {
      orderNumber,
      title: data.title,
      contactId: data.contactId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      notes: data.notes || null,
    },
  });

  // Create Baustelle if address provided
  if (data.baustelle && (data.baustelle.address || data.baustelle.city)) {
    await prisma.baustelle.create({
      data: {
        name: data.title,
        orderId: order.id,
        contactId: data.contactId,
        address: data.baustelle.address || null,
        postalCode: data.baustelle.postalCode || null,
        city: data.baustelle.city || null,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: "PLANNED",
      },
    });
  }

  // Create Quote with items if provided
  if (data.items && data.items.length > 0) {
    const totalPrice = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const quoteNumber = await getNextNumber("quote");

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        title: data.title,
        contactId: data.contactId,
        status: "ACCEPTED",
        totalPrice,
        items: {
          create: data.items.map((item, idx) => ({
            position: idx + 1,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { quoteId: quote.id },
    });
  }

  // Notify all non-driver users about the new order
  try {
    const userIds = await getNonDriverUserIds();
    await createNotificationsForUsers(userIds, {
      title: `Neuer Auftrag: ${data.title}`,
      message: `Auftrag #${orderNumber} wurde erstellt.`,
      type: "INFO",
      link: `/auftraege/${order.id}`,
    });
  } catch {
    // Notification errors must not block the main flow
  }

  revalidatePath("/auftraege");
  revalidatePath("/disposition");
  revalidatePath("/baustellen");
  return { order };
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
