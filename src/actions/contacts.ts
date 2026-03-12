"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const contactSchema = z.object({
  companyName: z.string().min(1, "Name ist erforderlich"),
  email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  type: z.enum(["COMPANY", "PRIVATE", "SUPPLIER"]),
  owner: z.string().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export type ContactFormData = z.infer<typeof contactSchema>;

export async function createContact(data: ContactFormData) {
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { owner, ...rest } = parsed.data;
  const contact = await prisma.contact.create({ data: { ...rest, owner: owner || null } });
  revalidatePath("/kontakte");
  return { contact };
}

export async function updateContact(id: string, data: ContactFormData) {
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { owner, ...rest } = parsed.data;
  const contact = await prisma.contact.update({
    where: { id },
    data: { ...rest, owner: owner || null },
  });
  revalidatePath("/kontakte");
  revalidatePath(`/kontakte/${id}`);
  return { contact };
}

export async function deleteContact(id: string) {
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/kontakte");
  return { success: true };
}

export async function getContacts(search?: string) {
  return prisma.contact.findMany({
    where: search
      ? {
          OR: [
            { companyName: { contains: search, mode: "insensitive" } },
            { contactPerson: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { companyName: "asc" },
  });
}

export async function getContact(id: string) {
  return prisma.contact.findUnique({
    where: { id },
    include: {
      requests: { orderBy: { createdAt: "desc" } },
      quotes: { orderBy: { createdAt: "desc" } },
      orders: { orderBy: { createdAt: "desc" } },
      deliveryNotes: { orderBy: { date: "desc" } },
      contactNotes: { orderBy: { createdAt: "desc" }, include: { request: { select: { id: true, title: true } } } },
      attachments: { orderBy: { createdAt: "desc" }, include: { request: { select: { id: true, title: true } } } },
    },
  });
}
