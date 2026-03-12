"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const requestSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  contactId: z.string().min(1, "Kontakt ist erforderlich"),
  assignedTo: z.string().optional(),
  status: z.enum(["OPEN", "NEU", "BESICHTIGUNG_GEPLANT", "BESICHTIGUNG_DURCHGEFUEHRT", "ANGEBOT_ERSTELLT", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.string().optional(),
  siteAddress: z.string().optional(),
  sitePhone: z.string().optional(),
  inspectionDate: z.string().optional(),
  inspectionStatus: z.string().optional(),
});

export type RequestFormData = z.infer<typeof requestSchema>;

export async function createRequest(data: RequestFormData) {
  const parsed = requestSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { inspectionDate, ...rest } = parsed.data;

  const [request, contact] = await Promise.all([
    prisma.request.create({
      data: {
        ...rest,
        status: rest.status ?? "NEU",
        inspectionDate: inspectionDate ? new Date(inspectionDate) : undefined,
      },
    }),
    prisma.contact.findUnique({ where: { id: rest.contactId }, select: { companyName: true } }),
  ]);

  // Automatisch eine Aufgabe erstellen
  const today = new Date();
  today.setHours(23, 59, 0, 0);
  await prisma.task.create({
    data: {
      title: `Anfrage - ${contact?.companyName ?? "Unbekannt"}`,
      contactId: rest.contactId,
      requestId: request.id,
      assignedTo: rest.assignedTo ?? null,
      dueDate: today,
      priority: "NORMAL",
      status: "OPEN",
    },
  });

  revalidatePath("/anfragen");
  revalidatePath("/aufgaben");
  return { request };
}

export async function updateRequest(id: string, data: Partial<RequestFormData>) {
  const { inspectionDate, ...rest } = data;
  const request = await prisma.request.update({
    where: { id },
    data: {
      ...rest,
      ...(inspectionDate !== undefined
        ? { inspectionDate: inspectionDate ? new Date(inspectionDate) : null }
        : {}),
    },
  });
  revalidatePath("/anfragen");
  revalidatePath(`/anfragen/${id}`);
  return { request };
}

export async function deleteRequest(id: string) {
  await prisma.request.delete({ where: { id } });
  revalidatePath("/anfragen");
  return { success: true };
}

export async function getRequests(status?: string) {
  return prisma.request.findMany({
    where: status ? { status: status as "OPEN" | "NEU" | "BESICHTIGUNG_GEPLANT" | "ANGEBOT_ERSTELLT" | "IN_PROGRESS" | "DONE" } : undefined,
    orderBy: { createdAt: "desc" },
    include: { contact: true },
  });
}

export async function getRequest(id: string) {
  return prisma.request.findUnique({
    where: { id },
    include: {
      contact: true,
      quotes: { include: { items: true } },
      contactNotes: { orderBy: { createdAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
}
