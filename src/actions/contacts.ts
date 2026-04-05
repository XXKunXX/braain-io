"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateSkontoSteps, type SkontoStep } from "@/lib/payment-terms";
import { reportBetaError } from "@/lib/report-error";

const contactSchema = z
  .object({
    companyName: z.string().optional().or(z.literal("")),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    type: z.enum(["COMPANY", "PRIVATE", "SUPPLIER"]),
    owner: z.string().optional().or(z.literal("")),
    notes: z.string().optional(),
    billingMode: z.enum(["PRO_LIEFERSCHEIN", "NACH_PROJEKTENDE", "PERIODISCH", "MANUELL"]).default("MANUELL"),
    billingIntervalDays: z.coerce.number().int().positive().optional().nullable(),
    paymentTermDays: z.number().nullable().optional(),
    paymentTermSkonto: z.array(z.object({ days: z.number(), percent: z.number() })).optional(),
    paymentTermCustom: z.string().optional().nullable(),
    paymentReminderDays: z.number().int().positive().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "PRIVATE" && !data.companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name ist erforderlich",
        path: ["companyName"],
      });
    }
  });

export type ContactFormData = z.infer<typeof contactSchema>;

export async function createContact(data: ContactFormData) {
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { owner, companyName, billingIntervalDays, paymentTermDays, paymentTermSkonto, paymentTermCustom, paymentReminderDays, ...rest } = parsed.data;
  try {
    const contact = await prisma.contact.create({
      data: {
        ...rest,
        companyName: companyName ?? "",
        owner: owner || null,
        billingIntervalDays: billingIntervalDays ?? null,
        ...(paymentTermDays !== undefined && { paymentTermDays: paymentTermDays ?? null }),
        ...(paymentTermSkonto !== undefined && { paymentTermSkonto: paymentTermSkonto }),
        ...(paymentTermCustom !== undefined && { paymentTermCustom: paymentTermCustom ?? null }),
        paymentReminderDays: paymentReminderDays ?? null,
      },
    });
    revalidatePath("/kontakte");
    revalidatePath("/anfragen/neu");
    return { contact };
  } catch (err) {
    await reportBetaError(err, { location: "createContact" });
    return { error: { _form: ["Kontakt konnte nicht erstellt werden."] } };
  }
}

export async function updateContact(id: string, data: ContactFormData) {
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { owner, companyName, billingIntervalDays, paymentTermDays, paymentTermSkonto, paymentTermCustom, paymentReminderDays, ...rest } = parsed.data;
  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...rest,
      companyName: companyName ?? "",
      owner: owner || null,
      billingIntervalDays: billingIntervalDays ?? null,
      ...(paymentTermDays !== undefined && { paymentTermDays: paymentTermDays ?? null }),
      ...(paymentTermSkonto !== undefined && { paymentTermSkonto: paymentTermSkonto }),
      ...(paymentTermCustom !== undefined && { paymentTermCustom: paymentTermCustom ?? null }),
      paymentReminderDays: paymentReminderDays ?? null,
    },
  });
  revalidatePath("/kontakte");
  revalidatePath(`/kontakte/${id}`);
  return { contact };
}

export async function updatePaymentTerm(
  id: string,
  data: {
    paymentTermDays: number | null;
    paymentTermSkonto: SkontoStep[];
    paymentTermCustom: string | null;
  }
) {
  const validationError = validateSkontoSteps(data.paymentTermSkonto, data.paymentTermDays);
  if (validationError) return { error: validationError };

  await prisma.contact.update({
    where: { id },
    data: {
      paymentTermDays: data.paymentTermDays,
      paymentTermSkonto: data.paymentTermSkonto.length > 0 ? data.paymentTermSkonto : [],
      paymentTermCustom: data.paymentTermCustom || null,
    },
  });
  revalidatePath(`/kontakte/${id}`);
  return { success: true };
}

export async function updateContactEmail(id: string, email: string) {
  await prisma.contact.update({ where: { id }, data: { email } });
  revalidatePath(`/kontakte/${id}`);
  return { success: true };
}

export async function deleteContact(id: string) {
  try {
    await prisma.contact.delete({ where: { id } });
    revalidatePath("/kontakte");
    return { success: true };
  } catch (err) {
    await reportBetaError(err, { location: "deleteContact", extra: { id } });
    return { error: "Kontakt konnte nicht gelöscht werden." };
  }
}

export async function getContacts() {
  return prisma.contact.findMany({
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
      deliveryNotes: {
        orderBy: { date: "asc" },
        include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } },
      },
      invoices: {
        orderBy: { invoiceDate: "desc" },
        select: { id: true, invoiceNumber: true, invoiceDate: true, status: true, totalAmount: true },
      },
      contactNotes: { orderBy: { createdAt: "desc" }, include: { request: { select: { id: true, title: true } } } },
      attachments: { orderBy: { createdAt: "desc" }, include: { request: { select: { id: true, title: true } } } },
    },
  });
}
