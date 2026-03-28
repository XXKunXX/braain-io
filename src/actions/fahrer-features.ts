"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const db = prisma as any;

// ─── Fahrzeug-Check ───────────────────────────────────────────────────────────

export type CheckItem = { label: string; checked: boolean; notes?: string };

export async function createFahrzeugCheck(data: {
  clerkUserId: string;
  date: string;
  vehicleName?: string;
  items: CheckItem[];
  photos?: string[];
  notes?: string;
}) {
  await db.fahrzeugCheck.create({
    data: {
      clerkUserId: data.clerkUserId,
      date: data.date,
      vehicleName: data.vehicleName || null,
      items: data.items,
      photos: data.photos ?? [],
      notes: data.notes || null,
    },
  });
  revalidatePath("/fahrer/fahrzeug-check");
}

export async function getFahrzeugCheckHistory(clerkUserId: string, limit = 14) {
  return db.fahrzeugCheck.findMany({
    where: { clerkUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ─── Schadensmeldung ──────────────────────────────────────────────────────────

export async function createSchadensmeldung(data: {
  clerkUserId: string;
  driverName?: string;
  vehicleName?: string;
  date: string;
  description: string;
  urgency: string;
  photos?: string[];
  baustelleId?: string;
}) {
  await db.schadensmeldung.create({
    data: {
      clerkUserId: data.clerkUserId,
      driverName: data.driverName || null,
      vehicleName: data.vehicleName || null,
      date: data.date,
      description: data.description,
      urgency: data.urgency,
      photos: data.photos ?? [],
      baustelleId: data.baustelleId || null,
    },
  });
  revalidatePath("/fahrer/schaden");
}

export async function getSchadensmeldungen(clerkUserId: string, limit = 20) {
  return db.schadensmeldung.findMany({
    where: { clerkUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ─── Tankbuch ─────────────────────────────────────────────────────────────────

export async function createTankEintrag(data: {
  clerkUserId: string;
  date: string;
  vehicleName: string;
  liters: number;
  kmStand?: number;
  costCenter?: string;
  notes?: string;
}) {
  await db.tankEintrag.create({
    data: {
      clerkUserId: data.clerkUserId,
      date: data.date,
      vehicleName: data.vehicleName,
      liters: data.liters,
      kmStand: data.kmStand ?? null,
      costCenter: data.costCenter || null,
      notes: data.notes || null,
    },
  });
  revalidatePath("/fahrer/tankbuch");
}

export async function getTankbuch(clerkUserId: string, limit = 30) {
  return db.tankEintrag.findMany({
    where: { clerkUserId },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function deleteTankEintrag(id: string) {
  await db.tankEintrag.delete({ where: { id } });
  revalidatePath("/fahrer/tankbuch");
}

// ─── Chat / Nachrichten ───────────────────────────────────────────────────────

export async function sendChatMessage(data: {
  fromUserId: string;
  fromName: string;
  toDriverId?: string;
  message: string;
}) {
  await db.chatMessage.create({
    data: {
      fromUserId: data.fromUserId,
      fromName: data.fromName,
      toDriverId: data.toDriverId || null,
      message: data.message,
    },
  });
  revalidatePath("/fahrer/nachrichten");
}

export async function getChatMessages(clerkUserId: string, limit = 50) {
  // Fetch messages sent to this driver OR broadcast messages (toDriverId = null) OR sent by this driver
  return db.chatMessage.findMany({
    where: {
      OR: [
        { toDriverId: clerkUserId },
        { toDriverId: null },
        { fromUserId: clerkUserId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function markMessagesRead(clerkUserId: string) {
  await db.chatMessage.updateMany({
    where: { toDriverId: clerkUserId, read: false },
    data: { read: true },
  });
  revalidatePath("/fahrer/nachrichten");
}

export async function getUnreadMessageCount(clerkUserId: string) {
  return db.chatMessage.count({
    where: { toDriverId: clerkUserId, read: false },
  });
}

// ─── Abwesenheit ──────────────────────────────────────────────────────────────

export async function createAbwesenheit(data: {
  clerkUserId: string;
  driverName?: string;
  type: string;
  startDate: string;
  endDate: string;
  notes?: string;
}) {
  await db.abwesenheit.create({
    data: {
      clerkUserId: data.clerkUserId,
      driverName: data.driverName || null,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes || null,
    },
  });
  revalidatePath("/fahrer/abwesenheit");
}

export async function getAbwesenheiten(clerkUserId: string, limit = 20) {
  return db.abwesenheit.findMany({
    where: { clerkUserId },
    orderBy: { startDate: "desc" },
    take: limit,
  });
}

export async function deleteAbwesenheit(id: string) {
  await db.abwesenheit.delete({ where: { id } });
  revalidatePath("/fahrer/abwesenheit");
}
