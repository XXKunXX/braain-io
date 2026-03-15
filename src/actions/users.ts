"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getUsers() {
  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ limit: 100 });
  return users.map((u) => ({
    id: u.id,
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    email: u.emailAddresses[0]?.emailAddress ?? "",
    phone: u.phoneNumbers[0]?.phoneNumber ?? "",
    role: (u.publicMetadata?.role as string) ?? "Mitarbeiter",
    status: u.banned ? "Gesperrt" : "Aktiv",
    imageUrl: u.imageUrl,
  }));
}

export async function setUserRole(userId: string, role: string) {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role },
  });
  revalidatePath("/benutzer");
}

export async function updateUser(userId: string, data: { firstName: string; lastName: string; phone?: string }) {
  const client = await clerkClient();
  await client.users.updateUser(userId, {
    firstName: data.firstName,
    lastName: data.lastName,
  });
  revalidatePath("/benutzer");
}

export async function deleteUser(userId: string) {
  const client = await clerkClient();
  await client.users.deleteUser(userId);
  revalidatePath("/benutzer");
}

export async function inviteUser(data: { email: string; firstName: string; lastName: string; role: string }) {
  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: data.email,
      publicMetadata: { role: data.role, firstName: data.firstName, lastName: data.lastName },
    });
    revalidatePath("/benutzer");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}
