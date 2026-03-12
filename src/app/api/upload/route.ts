import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requestId = formData.get("requestId") as string | null;
  const contactId = formData.get("contactId") as string | null;

  if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Datei zu groß (max. 20 MB)" }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}_${safeName}`;

  const blob = await put(uniqueName, file, { access: "public" });

  const attachment = await prisma.attachment.create({
    data: {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      url: blob.url,
      requestId: requestId ?? null,
      contactId: contactId ?? null,
    },
  });

  return NextResponse.json({ attachment });
}
