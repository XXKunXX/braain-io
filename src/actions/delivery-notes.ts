"use server";

import { prisma } from "@/lib/prisma";
import { getNextNumber } from "@/lib/counter";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const deliveryNoteSchema = z.object({
  contactId: z.string().min(1, "Kontakt ist erforderlich"),
  orderId: z.string().optional(),
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

  const { date, orderId, ...noteData } = parsed.data;
  const deliveryNumber = await getNextNumber("delivery");

  const deliveryNote = await prisma.deliveryNote.create({
    data: {
      ...noteData,
      deliveryNumber,
      orderId: orderId || undefined,
      date: new Date(date),
    },
  });

  revalidatePath("/lieferscheine");
  return { deliveryNote };
}

export async function updateDeliveryNote(id: string, data: DeliveryNoteFormData) {
  const parsed = deliveryNoteSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { date, orderId, ...noteData } = parsed.data;

  const deliveryNote = await prisma.deliveryNote.update({
    where: { id },
    data: {
      ...noteData,
      orderId: orderId || undefined,
      date: new Date(date),
    },
  });

  revalidatePath("/lieferscheine");
  revalidatePath(`/lieferscheine/${id}`);
  return { deliveryNote };
}

export async function updateDeliveryNotePdfUrl(id: string, pdfUrl: string) {
  await prisma.deliveryNote.update({ where: { id }, data: { pdfUrl } });
  revalidatePath(`/lieferscheine/${id}`);
}

export async function deleteDeliveryNote(id: string) {
  await prisma.deliveryNote.delete({ where: { id } });
  revalidatePath("/lieferscheine");
  return { success: true };
}

export async function getDeliveryNotes(contactId?: string) {
  return prisma.deliveryNote.findMany({
    where: contactId ? { contactId } : undefined,
    orderBy: { date: "desc" },
    include: { contact: true, order: true },
  });
}

export async function getDeliveryNote(id: string) {
  return prisma.deliveryNote.findUnique({
    where: { id },
    include: { contact: true, order: true },
  });
}
