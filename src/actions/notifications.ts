"use server";
import { prisma } from "@/lib/prisma";
import { auth, clerkClient } from "@clerk/nextjs/server";
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

export async function createNotificationsForUsers(
  clerkUserIds: string[],
  data: { title: string; message?: string; type?: string; link?: string }
) {
  if (clerkUserIds.length === 0) return;
  await prisma.notification.createMany({
    data: clerkUserIds.map((clerkUserId) => ({
      clerkUserId,
      title: data.title,
      message: data.message ?? null,
      type: data.type ?? "INFO",
      link: data.link ?? null,
    })),
  });
}

/** Returns Clerk user IDs of all users whose role is NOT "Fahrer" */
export async function getNonDriverUserIds(): Promise<string[]> {
  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ limit: 100 });
  return users
    .filter((u) => (u.publicMetadata?.role as string) !== "Fahrer")
    .map((u) => u.id);
}

/** Returns the Clerk user ID for a given display name ("Firstname Lastname") */
export async function getUserIdByName(name: string): Promise<string | null> {
  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ limit: 100 });
  const match = users.find(
    (u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() === name
  );
  return match?.id ?? null;
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
