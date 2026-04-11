"use server";

import { prisma } from "@/lib/prisma";
import { getNextNumber } from "@/lib/counter";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";

const quoteItemSchema = z.object({
  description: z.string().min(1, "Beschreibung erforderlich"),
  note: z.string().optional(),
  quantity: z.coerce.number().positive("Menge muss positiv sein"),
  unit: z.string().min(1),
  unitPrice: z.coerce.number().min(0),
  position: z.number().optional(),
});

const quoteSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  contactId: z.string().min(1, "Kontakt ist erforderlich"),
  requestId: z.string().optional(),
  notes: z.string().optional(),
  validUntil: z.string().optional(),
  siteAddress: z.string().optional(),
  assignedTo: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, "Mindestens eine Position erforderlich"),
});

export type QuoteFormData = z.infer<typeof quoteSchema>;

export async function createQuote(data: QuoteFormData) {
  const parsed = quoteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { items, validUntil, ...quoteData } = parsed.data;

  const totalPrice = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const quoteNumber = await getNextNumber("quote");
  const clerkUser = await currentUser();
  const createdByName = clerkUser
    ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || clerkUser.emailAddresses[0]?.emailAddress
    : undefined;

  const quote = await prisma.quote.create({
    data: {
      ...quoteData,
      quoteNumber,
      totalPrice,
      createdByName,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      items: {
        create: items.map((item, idx) => ({
          ...item,
          position: idx + 1,
          total: item.quantity * item.unitPrice,
        })),
      },
    },
    include: { items: true },
  });

  // Update request status to ANGEBOT_ERSTELLT if linked
  if (quoteData.requestId) {
    await prisma.request.update({
      where: { id: quoteData.requestId },
      data: { status: "ANGEBOT_ERSTELLT" },
    });

    // Close "Angebot erstellen" task, create "Angebot nachfassen"
    await prisma.task.updateMany({
      where: { requestId: quoteData.requestId, title: { startsWith: "Angebot erstellen" }, status: { not: "DONE" } },
      data: { status: "DONE" },
    });

    const contact = await prisma.contact.findUnique({
      where: { id: quoteData.contactId },
      select: { companyName: true, firstName: true, lastName: true },
    });
    const contactName = contact?.companyName
      || [contact?.firstName, contact?.lastName].filter(Boolean).join(" ")
      || "Unbekannt";

    // Due date: validUntil or 14 days from now
    const followUpDate = validUntil ? new Date(validUntil) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await prisma.task.create({
      data: {
        title: `Angebot nachfassen – ${contactName}`,
        description: "Angebot wurde erstellt. Bitte beim Kunden nachfassen ob Interesse besteht.",
        contactId: quoteData.contactId,
        requestId: quoteData.requestId,
        assignedTo: quoteData.assignedTo ?? null,
        dueDate: followUpDate,
        priority: "NORMAL",
        status: "OPEN",
      },
    });

    revalidatePath("/aufgaben");
    revalidatePath(`/anfragen/${quoteData.requestId}`);
  }

  revalidatePath("/angebote");
  return {
    quote: {
      ...quote,
      totalPrice: Number(quote.totalPrice),
      items: quote.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        total: Number(i.total),
      })),
    },
  };
}

export async function updateQuote(id: string, data: QuoteFormData) {
  const parsed = quoteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { items, validUntil, ...quoteData } = parsed.data;

  const totalPrice = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  // Replace all items
  await prisma.quoteItem.deleteMany({ where: { quoteId: id } });

  const quote = await prisma.quote.update({
    where: { id },
    data: {
      ...quoteData,
      totalPrice,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      items: {
        create: items.map((item, idx) => ({
          ...item,
          position: idx + 1,
          total: item.quantity * item.unitPrice,
        })),
      },
    },
    include: { items: true, contact: true },
  });

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${id}`);
  return {
    quote: {
      ...quote,
      totalPrice: Number(quote.totalPrice),
      validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
      items: quote.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        total: Number(i.total),
      })),
      contact: quote.contact
        ? { ...quote.contact, createdAt: quote.contact.createdAt.toISOString(), updatedAt: quote.contact.updatedAt.toISOString() }
        : null,
    },
  };
}

export async function updateQuoteStatus(
  id: string,
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"
) {
  const clerkUser = await currentUser();
  const statusChangedByName = clerkUser
    ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || clerkUser.emailAddresses[0]?.emailAddress
    : undefined;

  const quote = await prisma.quote.update({
    where: { id },
    data: { status, statusChangedByName },
    select: { id: true, status: true, requestId: true },
  });

  // Set linked request to DONE when quote is won or lost
  if ((status === "ACCEPTED" || status === "REJECTED") && quote.requestId) {
    await prisma.request.update({
      where: { id: quote.requestId },
      data: { status: "DONE" },
    });
    // Close "Angebot nachfassen" task
    await prisma.task.updateMany({
      where: { requestId: quote.requestId, title: { startsWith: "Angebot nachfassen" }, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
    revalidatePath("/aufgaben");
    revalidatePath(`/anfragen/${quote.requestId}`);
  }

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${id}`);
  return { quote };
}

export async function acceptQuoteAndCreateOrder(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { request: true },
  });
  if (!quote) return { error: "Angebot nicht gefunden" };

  // Determine dates: use inspection date from request or today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = quote.request?.inspectionDate ?? today;
  const endDate = quote.validUntil ?? today;

  const orderNumber = await getNextNumber("order");

  const [, order] = await Promise.all([
    prisma.quote.update({ where: { id: quoteId }, data: { status: "ACCEPTED" } }),
    prisma.order.create({
      data: {
        orderNumber,
        title: quote.title,
        contactId: quote.contactId,
        quoteId: quote.id,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
        notes: quote.notes ?? undefined,
        status: "OPEN",
      },
    }),
  ]);

  // Also update request status if linked
  if (quote.requestId) {
    await prisma.request.update({
      where: { id: quote.requestId },
      data: { status: "DONE" },
    });
    // Close "Angebot nachfassen" task
    await prisma.task.updateMany({
      where: { requestId: quote.requestId, title: { startsWith: "Angebot nachfassen" }, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
    revalidatePath("/aufgaben");
    revalidatePath(`/anfragen/${quote.requestId}`);
  }

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${quoteId}`);
  revalidatePath("/auftraege");
  return { order };
}

export async function deleteQuote(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { requestId: true, request: { select: { inspectionStatus: true } } },
  });

  await prisma.quote.delete({ where: { id } });

  // Request-Status zurücksetzen
  if (quote?.requestId) {
    const resetStatus = quote.request?.inspectionStatus === "DONE"
      ? "BESICHTIGUNG_DURCHGEFUEHRT"
      : "NEU";
    await prisma.request.update({
      where: { id: quote.requestId },
      data: { status: resetStatus },
    });
    revalidatePath(`/anfragen/${quote.requestId}`);
  }

  revalidatePath("/angebote");
  return { success: true, requestId: quote?.requestId ?? null };
}

export async function getQuotes(status?: string) {
  return prisma.quote.findMany({
    where: status ? { status: status as "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" } : undefined,
    orderBy: { createdAt: "desc" },
    include: { contact: true, items: true },
  });
}

export async function getQuote(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      contact: true,
      request: true,
      orders: { select: { id: true } },
      items: { orderBy: { position: "asc" } },
    },
  });
}
