"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import path from "path";

export async function deleteAttachment(id: string, requestId?: string, contactId?: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return { error: "Nicht gefunden" };

  // Remove physical file
  try {
    const filePath = path.join(process.cwd(), "public", attachment.url);
    await unlink(filePath);
  } catch {
    // File may not exist, continue
  }

  await prisma.attachment.delete({ where: { id } });

  if (requestId) revalidatePath(`/anfragen/${requestId}`);
  if (contactId) revalidatePath(`/kontakte/${contactId}`);

  return { success: true };
}
