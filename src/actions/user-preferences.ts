"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getUserPreferences(): Promise<{ showFahrerApp: boolean }> {
  const { userId } = await auth();
  if (!userId) return { showFahrerApp: false };

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const prefs = (user.privateMetadata?.preferences as Record<string, unknown>) ?? {};
  return { showFahrerApp: Boolean(prefs.showFahrerApp) };
}

export async function setShowFahrerApp(value: boolean) {
  const { userId } = await auth();
  if (!userId) throw new Error("Nicht angemeldet");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const prefs = (user.privateMetadata?.preferences as Record<string, unknown>) ?? {};

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      preferences: { ...prefs, showFahrerApp: value },
    },
  });

  revalidatePath("/", "layout");
}
