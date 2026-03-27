"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

export async function createContactNote({
  content,
  contactId,
  requestId,
  createdBy,
}: {
  content: string;
  contactId: string;
  requestId?: string;
  createdBy?: string;
}) {
  if (!content.trim()) return { error: "Inhalt ist erforderlich" };

  // Use Clerk session to get the current user name; fall back to provided value
  const clerkUser = await currentUser();
  const resolvedCreatedBy = clerkUser
    ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || clerkUser.emailAddresses?.[0]?.emailAddress
    : (createdBy ?? null);

  const note = await prisma.contactNote.create({
    data: { content: content.trim(), contactId, requestId: requestId ?? null, createdBy: resolvedCreatedBy ?? null },
  });

  revalidatePath(`/kontakte/${contactId}`);
  if (requestId) revalidatePath(`/anfragen/${requestId}`);

  return { note };
}

export async function deleteContactNote(id: string, contactId: string, requestId?: string) {
  await prisma.contactNote.delete({ where: { id } });

  revalidatePath(`/kontakte/${contactId}`);
  if (requestId) revalidatePath(`/anfragen/${requestId}`);

  return { success: true };
}
