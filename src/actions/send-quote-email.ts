"use server";

import nodemailer from "nodemailer";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { QuotePDF } from "@/lib/pdf/quote-pdf";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

export async function sendQuoteEmail(quoteId: string, toEmail: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      contact: true,
      items: { orderBy: { position: "asc" } },
    },
  });

  if (!quote) return { error: "Angebot nicht gefunden" };

  // Logo
  const logoCandidates = ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp"];
  let logoPath: string | undefined;
  for (const name of logoCandidates) {
    const p = path.join(process.cwd(), "public", name);
    if (fs.existsSync(p)) { logoPath = p; break; }
  }

  // Generate PDF
  const element = createElement(QuotePDF, { quote, logoPath }) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  // Send email
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: toEmail,
    subject: `Angebot ${quote.quoteNumber} – ${quote.title}`,
    html: `
      <p>Guten Tag,</p>
      <p>anbei erhalten Sie unser Angebot <strong>${quote.quoteNumber}</strong> für <strong>${quote.title}</strong>.</p>
      <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
      <p>Mit freundlichen Grüßen</p>
    `,
    attachments: [
      {
        filename: `${quote.quoteNumber}.pdf`,
        content: Buffer.from(new Uint8Array(buffer as unknown as ArrayBuffer)).toString("base64"),
        encoding: "base64",
        contentType: "application/pdf",
      },
    ],
  });

  return { success: true };
}
