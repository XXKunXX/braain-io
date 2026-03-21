"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const db = prisma as any;

export async function getZeiterfassungByDate(clerkUserId: string, date: string) {
  return db.zeiterfassung.findFirst({
    where: { clerkUserId, date },
    include: { baustelle: { select: { id: true, name: true } } },
  });
}

export async function getZeiterfassungHistory(clerkUserId: string, limit = 14) {
  return db.zeiterfassung.findMany({
    where: { clerkUserId },
    orderBy: { date: "desc" },
    take: limit,
    include: { baustelle: { select: { id: true, name: true } } },
  });
}

export async function clockIn(clerkUserId: string, date: string, time: string, baustelleId?: string) {
  const existing = await db.zeiterfassung.findFirst({ where: { clerkUserId, date } });
  if (existing) {
    await db.zeiterfassung.update({
      where: { id: existing.id },
      data: { startTime: time, baustelleId: baustelleId ?? existing.baustelleId },
    });
  } else {
    await db.zeiterfassung.create({
      data: { clerkUserId, date, startTime: time, baustelleId: baustelleId ?? null },
    });
  }
  revalidatePath("/fahrer/zeiterfassung");
}

export async function clockOut(clerkUserId: string, date: string, time: string, pauseMinutes: number, notes: string) {
  const existing = await db.zeiterfassung.findFirst({ where: { clerkUserId, date } });
  if (existing) {
    await db.zeiterfassung.update({
      where: { id: existing.id },
      data: { endTime: time, pauseMinutes, notes: notes || null },
    });
  } else {
    await db.zeiterfassung.create({
      data: { clerkUserId, date, endTime: time, pauseMinutes, notes: notes || null },
    });
  }
  revalidatePath("/fahrer/zeiterfassung");
}

export async function deleteZeiterfassung(id: string) {
  await db.zeiterfassung.delete({ where: { id } });
  revalidatePath("/fahrer/zeiterfassung");
}

