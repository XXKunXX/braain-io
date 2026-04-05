"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getNextNumber } from "@/lib/counter";
import { generatePaymentTermText, parseSkontoFromJson } from "@/lib/payment-terms";
import { getSettings } from "@/actions/settings";
import { reportBetaError } from "@/lib/report-error";
import nodemailer from "nodemailer";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf/invoice-pdf";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InvoiceItemInput = {
  description: string;
  note?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate?: number;
};

export type CreateInvoiceInput = {
  orderId?: string;
  contactId: string;
  invoiceDate?: string;
  dueDate?: string;
  headerText?: string;
  footerText?: string;
  notes?: string;
  vatRate?: number;
  items: InvoiceItemInput[];
};

export type UpdateInvoiceInput = {
  invoiceDate?: string;
  dueDate?: string;
  headerText?: string;
  footerText?: string;
  notes?: string;
  status?: "ENTWURF" | "VERSENDET" | "BEZAHLT" | "STORNIERT";
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcTotals(items: InvoiceItemInput[], vatRate: number) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vatAmount = subtotal * vatRate;
  const totalAmount = subtotal + vatAmount;
  return { subtotal, vatAmount, totalAmount };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getInvoices() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { invoiceDate: "desc" },
    include: {
      contact: { select: { id: true, companyName: true, firstName: true, lastName: true, email: true } },
      order: { select: { id: true, orderNumber: true, title: true } },
      items: { orderBy: { position: "asc" } },
    },
  });
  return invoices.map((inv) => ({
    ...inv,
    subtotal: Number(inv.subtotal),
    vatRate: Number(inv.vatRate),
    vatAmount: Number(inv.vatAmount),
    totalAmount: Number(inv.totalAmount),
    items: inv.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      vatRate: Number(item.vatRate),
      total: Number(item.total),
    })),
  }));
}

export async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      contact: true,
      order: { select: { id: true, orderNumber: true, title: true } },
      items: { orderBy: { position: "asc" } },
      deliveryNotes: {
        select: { id: true, deliveryNumber: true, date: true, material: true, quantity: true, unit: true },
        orderBy: { date: "asc" },
      },
    },
  });
}

export async function createInvoice(data: CreateInvoiceInput) {
  try {
    const settings = await getSettings();
    const vatRate = data.vatRate ?? Number(settings.vatRate);
    const { subtotal, vatAmount, totalAmount } = calcTotals(data.items, vatRate);
    const invoiceNumber = await getNextNumber("invoice");

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        contactId: data.contactId,
        orderId: data.orderId ?? null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        headerText: data.headerText ?? null,
        footerText: data.footerText ?? settings.defaultPaymentTerms,
        notes: data.notes ?? null,
        vatRate,
        subtotal,
        vatAmount,
        totalAmount,
        items: {
          create: data.items.map((item, idx) => ({
            position: idx + 1,
            description: item.description,
            note: item.note ?? null,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate ?? vatRate,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
    });

    // Automatically advance order status to VERRECHNET when an invoice is created
    if (data.orderId) {
      await prisma.order.updateMany({
        where: { id: data.orderId, status: { in: ["OPEN", "DISPONIERT", "IN_LIEFERUNG"] } },
        data: { status: "VERRECHNET" },
      });
      revalidatePath("/auftraege");
      revalidatePath(`/auftraege/${data.orderId}`);
    }

    revalidatePath("/rechnungen");
    return { invoice };
  } catch (err) {
    await reportBetaError(err, { location: "createInvoice", extra: { contactId: data.contactId, orderId: data.orderId } });
    return { error: "Rechnung konnte nicht erstellt werden." };
  }
}

export async function createInvoiceFromDeliveryNotes(
  contactId: string,
  deliveryNoteIds: string[],
  orderId?: string
) {
  if (deliveryNoteIds.length === 0) return { error: "Keine Lieferscheine ausgewählt" };

  const [settings, contact] = await Promise.all([
    getSettings(),
    prisma.contact.findUnique({ where: { id: contactId }, select: { paymentTermDays: true, paymentTermSkonto: true, paymentTermCustom: true } }),
  ]);
  const vatRate = Number(settings.vatRate);
  const invoiceNumber = await getNextNumber("invoice");

  const footerText = contact
    ? generatePaymentTermText({
        paymentTermDays: contact.paymentTermDays ?? 30,
        paymentTermSkonto: parseSkontoFromJson(contact.paymentTermSkonto),
        paymentTermCustom: contact.paymentTermCustom ?? null,
      })
    : settings.defaultPaymentTerms;

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        contactId,
        orderId: orderId ?? null,
        invoiceDate: new Date(),
        footerText,
        vatRate,
        subtotal: 0,
        vatAmount: 0,
        totalAmount: 0,
        items: {
          create: deliveryNoteIds.map((_, idx) => ({
            position: idx + 1,
            description: "",
            quantity: 1,
            unit: "Stk",
            unitPrice: 0,
            vatRate,
            total: 0,
          })),
        },
      },
    });

    // Fetch delivery notes to build items
    const notes = await tx.deliveryNote.findMany({
      where: { id: { in: deliveryNoteIds } },
      select: { id: true, deliveryNumber: true, date: true, material: true, quantity: true, unit: true },
      orderBy: { date: "asc" },
    });

    // Delete placeholder items and create real ones from delivery notes
    await tx.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
    await tx.invoiceItem.createMany({
      data: notes.map((dn, idx) => ({
        invoiceId: inv.id,
        position: idx + 1,
        description: dn.material,
        note: `Lieferschein ${dn.deliveryNumber} – ${new Date(dn.date).toLocaleDateString("de-DE")}`,
        quantity: Number(dn.quantity),
        unit: dn.unit,
        unitPrice: 0,
        vatRate,
        total: 0,
      })),
    });

    // Link delivery notes to this invoice
    await tx.deliveryNote.updateMany({
      where: { id: { in: deliveryNoteIds } },
      data: { invoiceId: inv.id },
    });

    return inv;
  });

  // Automatically advance order status to VERRECHNET when an invoice is created
  if (orderId) {
    await prisma.order.updateMany({
      where: { id: orderId, status: { in: ["OPEN", "DISPONIERT", "IN_LIEFERUNG"] } },
      data: { status: "VERRECHNET" },
    });
    revalidatePath("/auftraege");
    revalidatePath(`/auftraege/${orderId}`);
  }

  revalidatePath("/rechnungen");
  revalidatePath("/lieferscheine");
  return { invoice };
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  await prisma.invoice.update({
    where: { id },
    data: {
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      headerText: data.headerText ?? null,
      footerText: data.footerText ?? null,
      notes: data.notes ?? null,
      status: data.status ?? undefined,
    },
  });
  revalidatePath("/rechnungen");
  revalidatePath(`/rechnungen/${id}`);
  return { success: true };
}

export async function updateInvoiceItems(invoiceId: string, items: InvoiceItemInput[], vatRate: number) {
  const { subtotal, vatAmount, totalAmount } = calcTotals(items, vatRate);

  // Delete existing items and recreate
  await prisma.invoiceItem.deleteMany({ where: { invoiceId } });
  await prisma.invoiceItem.createMany({
    data: items.map((item, idx) => ({
      invoiceId,
      position: idx + 1,
      description: item.description,
      note: item.note ?? null,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate ?? vatRate,
      total: item.quantity * item.unitPrice,
    })),
  });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { subtotal, vatAmount, totalAmount, vatRate },
  });

  revalidatePath("/rechnungen");
  revalidatePath(`/rechnungen/${invoiceId}`);
  return { success: true };
}

export async function markInvoicePaid(id: string) {
  await prisma.invoice.update({
    where: { id },
    data: { status: "BEZAHLT", paidAt: new Date() },
  });

  revalidatePath("/rechnungen");
  revalidatePath("/zahlungen");
  revalidatePath(`/rechnungen/${id}`);
  return { success: true };
}

export async function getOffenePostenCount() {
  const now = new Date();
  const [overdue, drafts, unInvoiced] = await Promise.all([
    prisma.invoice.count({ where: { status: "VERSENDET", dueDate: { lt: now } } }),
    prisma.invoice.count({ where: { status: "ENTWURF" } }),
    prisma.deliveryNote.count({ where: { invoiceId: null } }),
  ]);
  return overdue + drafts + unInvoiced;
}

export async function deleteInvoice(id: string) {
  await prisma.$transaction([
    prisma.deliveryNote.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } }),
    prisma.invoice.delete({ where: { id } }),
  ]);
  revalidatePath("/rechnungen");
  revalidatePath("/kontakte");
  revalidatePath("/lieferscheine");
  return { success: true };
}

// ─── Email ────────────────────────────────────────────────────────────────────

export async function sendInvoiceEmail(invoiceId: string, toEmail: string) {
  try {
    const [invoice, rawSettings] = await Promise.all([
      prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          contact: true,
          items: { orderBy: { position: "asc" } },
          order: { select: { id: true, orderNumber: true, title: true } },
        },
      }),
      getSettings(),
    ]);

    if (!invoice) return { error: "Rechnung nicht gefunden" };

    const logoCandidates = ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp"];
    let logoPath: string | undefined;
    for (const name of logoCandidates) {
      const p = path.join(process.cwd(), "public", name);
      if (fs.existsSync(p)) { logoPath = p; break; }
    }

    const company = { ...rawSettings, vatRate: Number(rawSettings.vatRate) };
    const element = createElement(InvoicePDF, { invoice, logoPath, company }) as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

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
      subject: `Rechnung ${invoice.invoiceNumber}`,
      html: `
        <p>Guten Tag,</p>
        <p>anbei erhalten Sie unsere Rechnung <strong>${invoice.invoiceNumber}</strong>.</p>
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Mit freundlichen Grüßen</p>
      `,
      attachments: [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: Buffer.from(new Uint8Array(buffer as unknown as ArrayBuffer)).toString("base64"),
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
    });

    // Mark as sent
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "VERSENDET", sentAt: new Date() },
    });

    revalidatePath("/rechnungen");
    revalidatePath(`/rechnungen/${invoiceId}`);
    return { success: true };
  } catch (e) {
    console.error("sendInvoiceEmail error:", e);
    return { error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}
