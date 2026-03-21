import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { InvoicePDF } from "@/lib/pdf/invoice-pdf";
import { getSettings } from "@/actions/settings";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [invoice, rawSettings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        contact: true,
        order: { select: { id: true, orderNumber: true, title: true } },
        items: { orderBy: { position: "asc" } },
      },
    }),
    getSettings(),
  ]);

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logoCandidates = ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp"];
  let logoPath: string | undefined;
  for (const name of logoCandidates) {
    const p = path.join(process.cwd(), "public", name);
    if (fs.existsSync(p)) { logoPath = p; break; }
  }

  const company = { ...rawSettings, vatRate: Number(rawSettings.vatRate) };
  const element = createElement(InvoicePDF, { invoice, logoPath, company }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
