import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { DeliveryPDF } from "@/lib/pdf/delivery-pdf";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { id } = await params;

  const dn = await prisma.deliveryNote.findUnique({
    where: { id },
    include: { contact: true },
  });

  if (!dn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const element = createElement(DeliveryPDF, { dn }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dn.deliveryNumber}.pdf"`,
    },
  });
}
