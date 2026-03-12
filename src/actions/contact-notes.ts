"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

  const note = await prisma.contactNote.create({
    data: { content: content.trim(), contactId, requestId: requestId ?? null, createdBy: createdBy ?? null },
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
