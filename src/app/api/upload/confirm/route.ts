import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { fileName, fileSize, mimeType, url, requestId, contactId } = await req.json();

  if (!fileName || !url) {
    return NextResponse.json({ error: "fileName und url erforderlich" }, { status: 400 });
  }

  const attachment = await prisma.attachment.create({
    data: {
      fileName,
      fileSize: fileSize ?? 0,
      mimeType: mimeType ?? "application/octet-stream",
      url,
      requestId: requestId ?? null,
      contactId: contactId ?? null,
    },
  });

  return NextResponse.json({ attachment });
}
