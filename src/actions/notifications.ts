"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
  const { userId } = await auth();
  if (!userId) return [];
  return prisma.notification.findMany({
    where: { clerkUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function markAllRead() {
  const { userId } = await auth();
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { clerkUserId: userId, read: false },
    data: { read: true },
  });
  revalidatePath("/");
}

export async function markRead(id: string) {
  const { userId } = await auth();
  if (!userId) return;
  await prisma.notification.update({
    where: { id, clerkUserId: userId },
    data: { read: true },
  });
  revalidatePath("/");
}
