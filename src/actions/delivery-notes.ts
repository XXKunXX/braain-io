"use server";

import { prisma } from "@/lib/prisma";
import { getNextNumber } from "@/lib/counter";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createNotificationsForUsers, getNonDriverUserIds } from "@/actions/notifications";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Creates a "Rechnung erstellen" task for a delivery note, if none exists yet.
 * Safe to call multiple times — idempotent via deliveryNoteId check.
 */
export async function createInvoiceTaskForDeliveryNote(deliveryNoteId: string) {
  // Check for existing invoice task linked to this delivery note
  const existing = await prisma.task.findFirst({
    where: {
      deliveryNoteId,
      title: { startsWith: "Rechnung erstellen" },
    },
  });
  if (existing) return;

  const deliveryNote = await prisma.deliveryNote.findUnique({
    where: { id: deliveryNoteId },
    select: {
      contactId: true,
      baustelle: {
        select: {
          name: true,
          order: { select: { title: true, quote: { select: { assignedTo: true } } } },
        },
      },
    },
  });
  if (!deliveryNote) return;

  const orderTitle = deliveryNote.baustelle?.order?.title ?? deliveryNote.baustelle?.name ?? "Auftrag";
  const assignedTo = deliveryNote.baustelle?.order?.quote?.assignedTo ?? null;

  await prisma.task.create({
    data: {
      title: `Rechnung erstellen - ${orderTitle}`,
      description: `Lieferschein wurde abgeschlossen. Bitte Rechnung ausstellen.`,
      contactId: deliveryNote.contactId,
      deliveryNoteId,
      assignedTo,
      priority: "HIGH",
      status: "OPEN",
    },
  });

  revalidatePath("/aufgaben");
}

const deliveryNoteSchema = z.object({
  contactId: z.string().min(1, "Kontakt ist erforderlich"),
  orderId: z.string().optional(),
  baustelleId: z.string().optional(),
  date: z.string().min(1, "Datum ist erforderlich"),
  material: z.string().min(1, "Material ist erforderlich"),
  quantity: z.coerce.number().positive("Menge muss positiv sein"),
  unit: z.string().min(1),
  driver: z.string().optional(),
  vehicle: z.string().optional(),
  notes: z.string().optional(),
});

export type DeliveryNoteFormData = z.infer<typeof deliveryNoteSchema>;

export async function createDeliveryNote(data: DeliveryNoteFormData) {
  const parsed = deliveryNoteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { date, ...noteData } = parsed.data;
  const [deliveryNumber, clerkUser] = await Promise.all([getNextNumber("delivery"), currentUser()]);
  const createdByName = clerkUser
    ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || clerkUser.emailAddresses[0]?.emailAddress
    : null;

  // Derive orderId from baustelleId if not directly provided
  let resolvedOrderId = noteData.orderId ?? null;
  if (!resolvedOrderId && noteData.baustelleId) {
    const baustelle = await prisma.baustelle.findUnique({
      where: { id: noteData.baustelleId },
      select: { orderId: true },
    });
    resolvedOrderId = baustelle?.orderId ?? null;
  }

  const deliveryNote = await prisma.deliveryNote.create({
    data: {
      ...noteData,
      orderId: resolvedOrderId,
      deliveryNumber,
      date: new Date(date),
      createdByName,
    },
  });

  // Automatically advance order status to IN_LIEFERUNG when a delivery note is created
  if (resolvedOrderId) {
    await prisma.order.updateMany({
      where: { id: resolvedOrderId, status: { in: ["OPEN", "DISPONIERT"] } },
      data: { status: "IN_LIEFERUNG" },
    });
    revalidatePath("/auftraege");
    revalidatePath(`/auftraege/${resolvedOrderId}`);
  }

  // Automatically advance Baustelle status to IN_LIEFERUNG
  if (noteData.baustelleId) {
    await prisma.baustelle.updateMany({
      where: { id: noteData.baustelleId, status: { in: ["OPEN", "DISPONIERT"] } },
      data: { status: "IN_LIEFERUNG" },
    });
    revalidatePath(`/baustellen/${noteData.baustelleId}`);
  }

  revalidatePath("/lieferscheine");
  return { deliveryNote: { ...deliveryNote, quantity: Number(deliveryNote.quantity) } };
}

export async function updateDeliveryNote(id: string, data: DeliveryNoteFormData) {
  const parsed = deliveryNoteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { date, ...noteData } = parsed.data;

  const deliveryNote = await prisma.deliveryNote.update({
    where: { id },
    data: {
      ...noteData,
      date: new Date(date),
    },
  });

  revalidatePath("/lieferscheine");
  revalidatePath(`/lieferscheine/${id}`);
  return { deliveryNote: { ...deliveryNote, quantity: Number(deliveryNote.quantity) } };
}

export interface MaterialRow {
  material: string;
  m3: string;
  to: string;
}

export async function fillDeliveryNote(id: string, data: {
  driver?: string;
  vehicle?: string;
  licensePlate?: string;
  siteAddress?: string;
  vehicleType?: string;
  isMaut?: boolean;
  mautKm?: number;
  regieStart1?: string;
  regieEnd1?: string;
  regieStart2?: string;
  regieEnd2?: string;
  deliveredItems?: MaterialRow[];
  receivedItems?: MaterialRow[];
  notes?: string;
  signatureUrl?: string;
}) {
  await prisma.deliveryNote.update({
    where: { id },
    data: {
      driver: data.driver || undefined,
      vehicle: data.vehicle || undefined,
      licensePlate: data.licensePlate || undefined,
      siteAddress: data.siteAddress || undefined,
      vehicleType: data.vehicleType || undefined,
      isMaut: data.isMaut ?? false,
      mautKm: data.mautKm || undefined,
      regieStart1: data.regieStart1 || undefined,
      regieEnd1: data.regieEnd1 || undefined,
      regieStart2: data.regieStart2 || undefined,
      regieEnd2: data.regieEnd2 || undefined,
      deliveredItems: data.deliveredItems as object[] ?? undefined,
      receivedItems: data.receivedItems as object[] ?? undefined,
      notes: data.notes || undefined,
      signatureUrl: data.signatureUrl || undefined,
    },
  });

  if (data.signatureUrl) {
    // Check billing mode of the contact
    const noteForBilling = await prisma.deliveryNote.findUnique({
      where: { id },
      select: { contactId: true, orderId: true, contact: { select: { billingMode: true } } },
    });

    if (noteForBilling?.contact.billingMode === "PRO_LIEFERSCHEIN") {
      const { createInvoiceFromDeliveryNotes } = await import("@/actions/invoices");
      await createInvoiceFromDeliveryNotes(
        noteForBilling.contactId,
        [id],
        noteForBilling.orderId ?? undefined
      );
    } else {
      await createInvoiceTaskForDeliveryNote(id);
    }

    // Notify non-driver users about the signed delivery note
    try {
      const note = await prisma.deliveryNote.findUnique({
        where: { id },
        select: { deliveryNumber: true, driver: true },
      });
      const userIds = await getNonDriverUserIds();
      await createNotificationsForUsers(userIds, {
        title: `Lieferschein unterschrieben: #${note?.deliveryNumber}`,
        message: note?.driver ? `Fahrer: ${note.driver}` : "Lieferschein wurde unterschrieben.",
        type: "SUCCESS",
        link: `/lieferscheine/${id}`,
      });
    } catch {
      // Notification errors must not block the main flow
    }
  }

  revalidatePath(`/lieferscheine/${id}`);
  return { success: true };
}

export async function updateDeliveryNotePdfUrl(id: string, pdfUrl: string) {
  await prisma.deliveryNote.update({ where: { id }, data: { pdfUrl } });
  revalidatePath(`/lieferscheine/${id}`);
}

export async function deleteDeliveryNote(id: string) {
  const note = await prisma.deliveryNote.findUnique({
    where: { id },
    select: {
      orderId: true,
      baustelleId: true,
      invoice: { select: { status: true } },
    },
  });
  if (note?.invoice?.status === "VERSENDET" || note?.invoice?.status === "BEZAHLT") {
    return { success: false, error: "Lieferschein kann nicht gelöscht werden, da die verknüpfte Rechnung bereits versendet oder bezahlt ist." };
  }

  await prisma.deliveryNote.delete({ where: { id } });

  // Resolve orderId (direkt oder via Baustelle)
  let orderId = note?.orderId ?? null;
  if (!orderId && note?.baustelleId) {
    const baustelle = await prisma.baustelle.findUnique({
      where: { id: note.baustelleId },
      select: { orderId: true },
    });
    orderId = baustelle?.orderId ?? null;
  }

  // Wenn kein Lieferschein mehr vorhanden → Order-Status zurück auf DISPONIERT
  if (orderId) {
    const remaining = await prisma.deliveryNote.count({
      where: { OR: [{ orderId }, { baustelle: { orderId } }] },
    });
    if (remaining === 0) {
      await prisma.order.updateMany({
        where: { id: orderId, status: "IN_LIEFERUNG" },
        data: { status: "DISPONIERT" },
      });
      revalidatePath(`/auftraege/${orderId}`);
      revalidatePath("/auftraege");
    }
  }

  // Wenn kein Lieferschein mehr für Baustelle → Status zurück auf DISPONIERT (oder OPEN)
  if (note?.baustelleId) {
    const baustelleId = note.baustelleId;
    const remainingForBaustelle = await prisma.deliveryNote.count({
      where: { baustelleId },
    });
    if (remainingForBaustelle === 0) {
      const hasDisposition = await prisma.dispositionEntry.count({ where: { baustelleId } });
      await prisma.baustelle.updateMany({
        where: { id: baustelleId, status: "IN_LIEFERUNG" },
        data: { status: hasDisposition > 0 ? "DISPONIERT" : "OPEN" },
      });
      revalidatePath(`/baustellen/${baustelleId}`);
    }
  }

  revalidatePath("/lieferscheine");
  return { success: true };
}

export async function getDeliveryNotes(contactId?: string) {
  return prisma.deliveryNote.findMany({
    where: contactId ? { contactId } : undefined,
    orderBy: { date: "desc" },
    include: {
      contact: true,
      baustelle: true,
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });
}

export async function getUnbilledDeliveryNotesForOrder(orderId: string) {
  return prisma.deliveryNote.findMany({
    where: { orderId, invoiceId: null },
    orderBy: { date: "asc" },
    select: { id: true, deliveryNumber: true, date: true, material: true, quantity: true, unit: true },
  });
}

export async function getUnbilledDeliveryNotesForContact(contactId: string, olderThanDays?: number) {
  const where: Record<string, unknown> = { contactId, invoiceId: null };
  if (olderThanDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    where.date = { lte: cutoff };
  }
  return prisma.deliveryNote.findMany({
    where,
    orderBy: { date: "asc" },
    select: { id: true, deliveryNumber: true, date: true, material: true, quantity: true, unit: true, orderId: true },
  });
}

export async function getDeliveryNote(id: string) {
  return prisma.deliveryNote.findUnique({
    where: { id },
    include: { contact: true, order: true, baustelle: { include: { order: true } } },
  });
}

