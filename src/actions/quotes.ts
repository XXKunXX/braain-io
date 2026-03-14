"use server";

import { prisma } from "@/lib/prisma";
import { getNextNumber } from "@/lib/counter";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

  const quote = await prisma.quote.create({
    data: {
      ...quoteData,
      quoteNumber,
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
    include: { items: true },
  });

  // Update request status to ANGEBOT_ERSTELLT if linked
  if (quoteData.requestId) {
    await prisma.request.update({
      where: { id: quoteData.requestId },
      data: { status: "ANGEBOT_ERSTELLT" },
    });
    revalidatePath(`/anfragen/${quoteData.requestId}`);
  }

  revalidatePath("/angebote");
  return { quote };
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
  return { quote };
}

export async function updateQuoteStatus(
  id: string,
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"
) {
  const quote = await prisma.quote.update({
    where: { id },
    data: { status },
    select: { id: true, status: true, requestId: true },
  });

  // Set linked request to DONE when quote is won or lost
  if ((status === "ACCEPTED" || status === "REJECTED") && quote.requestId) {
    await prisma.request.update({
      where: { id: quote.requestId },
      data: { status: "DONE" },
    });
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

  const { getNextNumber } = await import("@/lib/counter");
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
        status: "PLANNED",
      },
    }),
  ]);

  // Also update request status if linked
  if (quote.requestId) {
    await prisma.request.update({
      where: { id: quote.requestId },
      data: { status: "ANGEBOT_ERSTELLT" },
    });
  }

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${quoteId}`);
  revalidatePath("/auftraege");
  return { order };
}

export async function deleteQuote(id: string) {
  await prisma.quote.delete({ where: { id } });
  revalidatePath("/angebote");
  return { success: true };
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
      items: { orderBy: { position: "asc" } },
    },
  });
}
