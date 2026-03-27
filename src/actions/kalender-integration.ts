"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { CalendarProvider } from "@prisma/client";
import { z } from "zod";

const connectSchema = z.object({
  provider: z.enum(["GOOGLE", "OUTLOOK", "ICLOUD"]),
  accountEmail: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  calendarUrl: z.string().url("Bitte eine gültige URL eingeben.").optional().or(z.literal("")),
});

const syncSettingsSchema = z.object({
  syncEnabled: z.boolean(),
  syncOrders: z.boolean(),
  syncBaustellen: z.boolean(),
  syncTasks: z.boolean(),
});

export async function getCalendarIntegrations() {
  const { userId } = await auth();
  if (!userId) return [];

  return prisma.calendarIntegration.findMany({
    where: { clerkUserId: userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function connectCalendar(data: {
  provider: string;
  accountEmail: string;
  calendarUrl?: string;
}) {
  const { userId } = await auth();
  if (!userId) return { error: "Nicht authentifiziert" };

  const parsed = connectSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { provider, accountEmail, calendarUrl } = parsed.data;

  try {
    await prisma.calendarIntegration.upsert({
      where: { clerkUserId_provider: { clerkUserId: userId, provider: provider as CalendarProvider } },
      create: {
        clerkUserId: userId,
        provider: provider as CalendarProvider,
        accountEmail,
        calendarUrl: calendarUrl || null,
        status: "ACTIVE",
      },
      update: {
        accountEmail,
        calendarUrl: calendarUrl || null,
        status: "ACTIVE",
        syncEnabled: true,
      },
    });

    revalidatePath("/kalender-integration");
    return { success: true };
  } catch {
    return { error: "Verbindung konnte nicht gespeichert werden." };
  }
}

export async function disconnectCalendar(provider: string) {
  const { userId } = await auth();
  if (!userId) return { error: "Nicht authentifiziert" };

  try {
    await prisma.calendarIntegration.delete({
      where: {
        clerkUserId_provider: {
          clerkUserId: userId,
          provider: provider as CalendarProvider,
        },
      },
    });

    revalidatePath("/kalender-integration");
    return { success: true };
  } catch {
    return { error: "Verbindung konnte nicht getrennt werden." };
  }
}

export async function updateCalendarSyncSettings(
  provider: string,
  settings: {
    syncEnabled: boolean;
    syncOrders: boolean;
    syncBaustellen: boolean;
    syncTasks: boolean;
  }
) {
  const { userId } = await auth();
  if (!userId) return { error: "Nicht authentifiziert" };

  const parsed = syncSettingsSchema.safeParse(settings);
  if (!parsed.success) return { error: "Ungültige Einstellungen" };

  try {
    await prisma.calendarIntegration.update({
      where: {
        clerkUserId_provider: {
          clerkUserId: userId,
          provider: provider as CalendarProvider,
        },
      },
      data: parsed.data,
    });

    revalidatePath("/kalender-integration");
    return { success: true };
  } catch {
    return { error: "Einstellungen konnten nicht gespeichert werden." };
  }
}
