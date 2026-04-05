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

export async function updateUserAdmin(
  userId: string,
  data: { firstName: string; lastName: string; email: string; role: string }
) {
  const client = await clerkClient();
  // Update name
  await client.users.updateUser(userId, {
    firstName: data.firstName,
    lastName: data.lastName,
  });
  // Update role
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: data.role },
  });
  // Update email if changed
  const user = await client.users.getUser(userId);
  const currentEmail = user.emailAddresses[0]?.emailAddress ?? "";
  if (data.email && data.email !== currentEmail) {
    const newAddr = await client.emailAddresses.createEmailAddress({
      userId,
      emailAddress: data.email,
      verified: true,
      primary: true,
    });
    await client.users.updateUser(userId, { primaryEmailAddressID: newAddr.id });
    if (user.emailAddresses[0]?.id) {
      await client.emailAddresses.deleteEmailAddress(user.emailAddresses[0].id);
    }
  }
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
      publicMetadata: { role: data.role },
      notify: true,
    });

    revalidatePath("/benutzer");
    return { success: true };
  } catch (err: unknown) {
    const clerkErr = err as { errors?: { message: string; longMessage?: string }[] };
    const msg = clerkErr?.errors?.[0]?.longMessage
      ?? clerkErr?.errors?.[0]?.message
      ?? (err instanceof Error ? err.message : String(err));
    return { error: msg };
  }
}
