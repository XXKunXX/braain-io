"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const taskSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  contactId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).default("OPEN"),
});

export type TaskFormData = z.infer<typeof taskSchema>;

export async function getTasks(filters?: {
  status?: string;
  assignedTo?: string;
  priority?: string;
  search?: string;
}) {
  const tasks = await prisma.task.findMany({
    where: {
      ...(filters?.status && filters.status !== "ALL" ? { status: filters.status as "OPEN" | "IN_PROGRESS" | "DONE" } : {}),
      ...(filters?.priority && filters.priority !== "ALL" ? { priority: filters.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT" } : {}),
      ...(filters?.assignedTo && filters.assignedTo !== "ALL" ? { assignedTo: filters.assignedTo } : {}),
      ...(filters?.search ? { title: { contains: filters.search, mode: "insensitive" as const } } : {}),
    },
    include: { contact: true, request: true, deliveryNote: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
  return tasks.map((task) => ({
    ...task,
    deliveryNote: task.deliveryNote
      ? { ...task.deliveryNote, quantity: task.deliveryNote.quantity.toNumber() }
      : null,
  }));
}

export async function getOpenTaskCount() {
  return prisma.task.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } });
}

export async function createTask(data: TaskFormData) {
  const parsed = taskSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { dueDate, contactId, ...rest } = parsed.data;
  const task = await prisma.task.create({
    data: {
      ...rest,
      contactId: contactId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  revalidatePath("/aufgaben");
  return { task };
}

export async function updateTaskStatus(id: string, status: "OPEN" | "IN_PROGRESS" | "DONE") {
  await prisma.task.update({ where: { id }, data: { status } });
  revalidatePath("/aufgaben");
  return { success: true };
}

export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } });
  revalidatePath("/aufgaben");
  return { success: true };
}
