"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPaymentMilestones() {
  return prisma.paymentMilestone.findMany({
    orderBy: { dueDate: "asc" },
    include: {
      order: {
        select: {
          id: true,
          title: true,
          orderNumber: true,
          contact: { select: { companyName: true } },
        },
      },
    },
  });
}

export async function createPaymentMilestone(
  orderId: string,
  data: {
    title: string;
    type: "ANZAHLUNG" | "ZWISCHENRECHNUNG" | "SCHLUSSRECHNUNG";
    amount: number;
    dueDate?: string;
    notes?: string;
    invoiceNumber?: string;
    skontoPercent?: number;
    skontoDays?: number;
  }
) {
  await prisma.paymentMilestone.create({
    data: {
      orderId,
      title: data.title,
      type: data.type,
      amount: data.amount,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes,
      invoiceNumber: data.invoiceNumber,
      skontoPercent: data.skontoPercent,
      skontoDays: data.skontoDays,
    },
  });
  revalidatePath(`/auftraege/${orderId}`);
  return { success: true };
}

export async function updatePaymentMilestone(
  id: string,
  orderId: string,
  data: {
    title: string;
    type: "ANZAHLUNG" | "ZWISCHENRECHNUNG" | "SCHLUSSRECHNUNG";
    amount: number;
    dueDate?: string;
    assignedTo?: string;
    notes?: string;
    invoiceNumber?: string;
    skontoPercent?: number;
    skontoDays?: number;
  }
) {
  await prisma.paymentMilestone.update({
    where: { id },
    data: {
      title: data.title,
      type: data.type,
      amount: data.amount,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assignedTo: data.assignedTo || null,
      notes: data.notes || null,
      invoiceNumber: data.invoiceNumber || null,
      skontoPercent: data.skontoPercent ?? null,
      skontoDays: data.skontoDays ?? null,
    },
  });
  revalidatePath(`/auftraege/${orderId}`);
  return { success: true };
}

export async function markPaymentMilestonePaid(id: string, orderId: string) {
  await prisma.paymentMilestone.update({
    where: { id },
    data: { status: "BEZAHLT", paidAt: new Date() },
  });
  revalidatePath(`/auftraege/${orderId}`);
  return { success: true };
}

export async function markPaymentMilestoneUnpaid(id: string, orderId: string) {
  await prisma.paymentMilestone.update({
    where: { id },
    data: { status: "OFFEN", paidAt: null },
  });
  revalidatePath(`/auftraege/${orderId}`);
  return { success: true };
}

export async function deletePaymentMilestone(id: string, orderId: string) {
  await prisma.paymentMilestone.delete({ where: { id } });
  revalidatePath(`/auftraege/${orderId}`);
  return { success: true };
}
