import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { QuotePDF } from "@/lib/pdf/quote-pdf";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      contact: true,
      items: { orderBy: { position: "asc" } },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logoCandidates = ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp"];
  let logoPath: string | undefined;
  for (const name of logoCandidates) {
    const p = path.join(process.cwd(), "public", name);
    if (fs.existsSync(p)) { logoPath = p; break; }
  }

  const element = createElement(QuotePDF, { quote, logoPath }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quoteNumber}.pdf"`,
    },
  });
}
