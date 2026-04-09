"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { sendEmail } from "@/lib/email";
import { createNotificationsForUsers, getNonDriverUserIds } from "@/actions/notifications";

const requestSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  contactId: z.string().min(1, "Kontakt ist erforderlich"),
  assignedTo: z.string().optional(),
  status: z.enum(["NEU", "BESICHTIGUNG_GEPLANT", "BESICHTIGUNG_DURCHGEFUEHRT", "ANGEBOT_ERSTELLT", "DONE"]).optional(),
  priority: z.string().optional(),
  siteAddress: z.string().optional(),
  sitePhone: z.string().optional(),
  inspectionDate: z.string().optional(),
  inspectionStatus: z.string().optional(),
  noInspectionRequired: z.boolean().optional(),
});

export type RequestFormData = z.infer<typeof requestSchema>;

export async function createRequest(data: RequestFormData) {
  const parsed = requestSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { inspectionDate, ...rest } = parsed.data;

  const clerkUser = await currentUser();
  const createdByName = clerkUser
    ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || clerkUser.emailAddresses[0]?.emailAddress
    : null;

  const [request, contact] = await Promise.all([
    prisma.request.create({
      data: {
        ...rest,
        status: rest.status ?? "NEU",
        inspectionDate: inspectionDate ? new Date(inspectionDate) : undefined,
        noInspectionRequired: rest.noInspectionRequired ?? false,
        createdByName,
      },
    }),
    prisma.contact.findUnique({ where: { id: rest.contactId }, select: { companyName: true } }),
  ]);

  // Automatisch eine Aufgabe erstellen (nur wenn keine Besichtigung ausgeschlossen)
  if (!rest.noInspectionRequired) {
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
  }

  // E-Mail-Benachrichtigung an den zugewiesenen Owner
  if (rest.assignedTo) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://braain-io.vercel.app";
      const requestUrl = `${appUrl}/anfragen/${request.id}`;
      const client = await clerkClient();
      const { data: users } = await client.users.getUserList({ limit: 100 });
      const ownerUser = users.find((u) =>
        `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() === rest.assignedTo
      );
      const ownerEmail = ownerUser?.emailAddresses[0]?.emailAddress;
      if (ownerEmail) {
        await sendEmail({
          to: ownerEmail,
          subject: `Neue Anfrage: ${request.title}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#111">Neue Anfrage eingegangen</h2>
              <p><strong>Titel:</strong> ${request.title}</p>
              <p><strong>Kontakt:</strong> ${contact?.companyName ?? "Unbekannt"}</p>
              <p style="margin-top:24px">
                <a href="${requestUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
                  Anfrage öffnen →
                </a>
              </p>
            </div>
          `,
        });
      }
    } catch {
      // E-Mail-Fehler blockieren den Anfrage-Prozess nicht
    }
  }

  // In-app notification for all non-driver users
  try {
    const userIds = await getNonDriverUserIds();
    await createNotificationsForUsers(userIds, {
      title: `Neue Anfrage: ${request.title}`,
      message: contact?.companyName ? `Von: ${contact.companyName}` : undefined,
      type: "INFO",
      link: `/anfragen/${request.id}`,
    });
  } catch {
    // Notification errors must not block the main flow
  }

  revalidatePath("/anfragen");
  revalidatePath("/aufgaben");
  return { request };
}

export async function updateRequest(id: string, data: Partial<RequestFormData>) {
  const { inspectionDate, noInspectionRequired, ...rest } = data;

  // Fetch current state to detect transitions
  const before = await prisma.request.findUnique({
    where: { id },
    select: { status: true, inspectionStatus: true, contactId: true, assignedTo: true, contact: { select: { companyName: true, firstName: true, lastName: true } } },
  });

  const request = await prisma.request.update({
    where: { id },
    data: {
      ...rest,
      ...(inspectionDate !== undefined
        ? { inspectionDate: inspectionDate ? new Date(inspectionDate) : null }
        : {}),
      ...(noInspectionRequired !== undefined ? { noInspectionRequired } : {}),
    },
  });

  const contactName = before?.contact?.companyName
    || [before?.contact?.firstName, before?.contact?.lastName].filter(Boolean).join(" ")
    || "Unbekannt";
  const assignedTo = rest.assignedTo ?? before?.assignedTo ?? null;

  // Besichtigung geplant
  if (rest.status === "BESICHTIGUNG_GEPLANT" && before?.status !== "BESICHTIGUNG_GEPLANT") {
    await prisma.task.updateMany({
      where: { requestId: id, title: { startsWith: "Anfrage" }, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
    await prisma.task.create({
      data: {
        title: `Besichtigung durchführen – ${contactName}`,
        description: "Besichtigung wurde geplant. Bitte vor Ort besichtigen und Ergebnis dokumentieren.",
        contactId: before!.contactId,
        requestId: id,
        assignedTo,
        dueDate: inspectionDate ? new Date(inspectionDate) : null,
        priority: "HIGH",
        status: "OPEN",
      },
    });
    revalidatePath("/aufgaben");
  }

  // Besichtigung abgeschlossen
  if ((rest as Record<string, unknown>).inspectionStatus === "DONE" && before?.inspectionStatus !== "DONE") {
    await prisma.task.updateMany({
      where: { requestId: id, title: { startsWith: "Besichtigung durchführen" }, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
    await prisma.task.create({
      data: {
        title: `Angebot erstellen – ${contactName}`,
        description: "Besichtigung wurde abgeschlossen. Bitte Angebot ausarbeiten und versenden.",
        contactId: before!.contactId,
        requestId: id,
        assignedTo,
        priority: "HIGH",
        status: "OPEN",
      },
    });
    revalidatePath("/aufgaben");
  }

  revalidatePath("/anfragen");
  revalidatePath(`/anfragen/${id}`);
  return { request };
}

export async function deleteRequest(id: string) {
  await prisma.request.delete({ where: { id } });
  revalidatePath("/anfragen");
  return { success: true };
}

export async function getNewRequestCount() {
  return prisma.request.count({ where: { status: "NEU" } });
}

export async function getRequests(status?: string) {
  return prisma.request.findMany({
    where: status ? { status: status as "NEU" | "BESICHTIGUNG_GEPLANT" | "BESICHTIGUNG_DURCHGEFUEHRT" | "ANGEBOT_ERSTELLT" | "DONE" } : undefined,
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
