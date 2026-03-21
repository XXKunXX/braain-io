"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const db = prisma as any;

export async function createFahrerTagesrapport(data: {
  baustelleId: string;
  date: string;
  driverName: string;
  machineName?: string;
  hours?: number | null;
  employees?: number | null;
  description?: string;
}) {
  const rapport = await db.tagesrapport.create({
    data: {
      baustelleId: data.baustelleId,
      date: new Date(data.date),
      driverName: data.driverName || null,
      machineName: data.machineName || null,
      hours: data.hours ?? null,
      employees: data.employees ?? null,
      description: data.description || null,
    },
  });
  revalidatePath("/fahrer/tagesbericht");
  revalidatePath(`/baustellen/${data.baustelleId}`);
  return { rapport: { ...rapport, hours: rapport.hours != null ? Number(rapport.hours) : null } };
}

export async function getFahrerTagesrapporte(clerkUserId: string, limit = 14) {
  // Fetch rapporte for baustellen where this driver had disposition entries
  const entries = await db.dispositionEntry.findMany({
    where: {
      resource: { clerkUserId },
      blockType: null,
    },
    select: { baustelleId: true },
    distinct: ["baustelleId"],
  });
  const baustelleIds = entries
    .map((e: { baustelleId: string | null }) => e.baustelleId)
    .filter(Boolean) as string[];

  if (baustelleIds.length === 0) return [];

  return db.tagesrapport.findMany({
    where: { baustelleId: { in: baustelleIds } },
    orderBy: { date: "desc" },
    take: limit,
    include: { baustelle: { select: { id: true, name: true } } },
  }) as Promise<Array<{
    id: string;
    baustelleId: string;
    date: Date;
    driverName: string | null;
    machineName: string | null;
    hours: number | null;
    employees: number | null;
    description: string | null;
    baustelle: { id: string; name: string };
  }>>;
}
