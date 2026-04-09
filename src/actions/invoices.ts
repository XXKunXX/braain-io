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

// ─── Task Helpers ─────────────────────────────────────────────────────────────

async function closeTasksByTitle(invoiceId: string, titlePrefix: string) {
  await prisma.task.updateMany({
    where: { invoiceId, title: { startsWith: titlePrefix }, status: { not: "DONE" } },
    data: { status: "DONE" },
  });
}

async function getInvoiceContext(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      contactId: true,
      dueDate: true,
      order: { select: { title: true, quote: { select: { assignedTo: true } } } },
    },
  });
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

    // Close "Rechnung erstellen" tasks for the order, create "Rechnung prüfen & versenden"
    const orderTitle = data.orderId
      ? (await prisma.order.findUnique({ where: { id: data.orderId }, select: { title: true, quote: { select: { assignedTo: true } } } }))
      : null;
    const label = orderTitle?.title ?? "Auftrag";
    const assignedTo = orderTitle?.quote?.assignedTo ?? null;

    if (data.orderId) {
      await prisma.task.updateMany({
        where: { title: { startsWith: "Rechnung erstellen" }, status: { not: "DONE" } },
        data: { status: "DONE" },
      });
    }

    await prisma.task.create({
      data: {
        title: `Rechnung prüfen & versenden – ${label}`,
        description: "Rechnungsentwurf wurde erstellt. Bitte prüfen und an den Kunden versenden.",
        contactId: data.contactId,
        invoiceId: invoice.id,
        assignedTo,
        priority: "HIGH",
        status: "OPEN",
      },
    });

    revalidatePath("/aufgaben");
    revalidatePath("/rechnungen");
    return { invoice: { id: invoice.id } };
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

  const [settings, contact, orderQuoteItems, contactQuoteItems] = await Promise.all([
    getSettings(),
    prisma.contact.findUnique({ where: { id: contactId }, select: { paymentTermDays: true, paymentTermSkonto: true, paymentTermCustom: true } }),
    orderId
      ? prisma.quoteItem.findMany({
          where: { quote: { orders: { some: { id: orderId } } } },
          select: { description: true, unitPrice: true },
        })
      : Promise.resolve([]),
    prisma.quoteItem.findMany({
      where: { quote: { contactId } },
      select: { description: true, unitPrice: true },
      orderBy: { quote: { createdAt: "desc" } },
    }),
  ]);
  // Order-level quote items take priority; fall back to any quote for this contact
  const quoteItems = orderQuoteItems.length > 0 ? orderQuoteItems : contactQuoteItems;
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

    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

    // Delete placeholder items and create real ones from delivery notes
    await tx.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
    const itemRows = notes.map((dn, idx) => {
      const matchedItem = quoteItems.find(
        (qi) => normalize(qi.description) === normalize(dn.material)
      );
      const unitPrice = matchedItem ? Number(matchedItem.unitPrice) : 0;
      const qty = Number(dn.quantity);
      return {
        invoiceId: inv.id,
        position: idx + 1,
        description: dn.material,
        note: `Lieferschein ${dn.deliveryNumber} – ${new Date(dn.date).toLocaleDateString("de-DE")}`,
        quantity: qty,
        unit: dn.unit,
        unitPrice,
        vatRate,
        total: qty * unitPrice,
      };
    });
    await tx.invoiceItem.createMany({ data: itemRows });

    // Link delivery notes to this invoice
    await tx.deliveryNote.updateMany({
      where: { id: { in: deliveryNoteIds } },
      data: { invoiceId: inv.id },
    });

    // Update invoice totals based on actual items
    const { subtotal, vatAmount, totalAmount } = calcTotals(
      itemRows.map((i) => ({ description: i.description, unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice })),
      vatRate
    );
    await tx.invoice.update({
      where: { id: inv.id },
      data: { subtotal, vatAmount, totalAmount },
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

  // Check if any Baustellen are now fully invoiced → set VERRECHNET
  const affectedNotes = await prisma.deliveryNote.findMany({
    where: { id: { in: deliveryNoteIds }, baustelleId: { not: null } },
    select: { baustelleId: true },
  });
  const baustelleIds = [...new Set(affectedNotes.map((n) => n.baustelleId!))];
  for (const baustelleId of baustelleIds) {
    const [total, unlinked] = await Promise.all([
      prisma.deliveryNote.count({ where: { baustelleId } }),
      prisma.deliveryNote.count({ where: { baustelleId, invoiceId: null } }),
    ]);
    if (total > 0 && unlinked === 0) {
      await prisma.baustelle.updateMany({
        where: { id: baustelleId, status: { notIn: ["ABGESCHLOSSEN"] } },
        data: { status: "VERRECHNET" },
      });
      revalidatePath(`/baustellen/${baustelleId}`);
    }
  }

  // Close "Rechnung erstellen" tasks, create "Rechnung prüfen & versenden"
  const orderInfo = orderId
    ? await prisma.order.findUnique({ where: { id: orderId }, select: { title: true, quote: { select: { assignedTo: true } } } })
    : null;
  const label = orderInfo?.title ?? "Auftrag";
  const assignedTo = orderInfo?.quote?.assignedTo ?? null;

  if (orderId) {
    await prisma.task.updateMany({
      where: { title: { startsWith: "Rechnung erstellen" }, status: { not: "DONE" } },
      data: { status: "DONE" },
    });
  } else {
    await prisma.task.updateMany({
      where: {
        deliveryNoteId: { in: deliveryNoteIds },
        title: { startsWith: "Rechnung erstellen" },
        status: { not: "DONE" },
      },
      data: { status: "DONE" },
    });
  }

  await prisma.task.create({
    data: {
      title: `Rechnung prüfen & versenden – ${label}`,
      description: "Rechnungsentwurf wurde erstellt. Bitte prüfen und an den Kunden versenden.",
      contactId,
      invoiceId: invoice.id,
      assignedTo,
      priority: "HIGH",
      status: "OPEN",
    },
  });

  revalidatePath("/aufgaben");
  revalidatePath("/rechnungen");
  revalidatePath("/lieferscheine");
  return { invoice: { id: invoice.id } };
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

  await closeTasksByTitle(id, "Zahlungseingang prüfen");

  revalidatePath("/", "layout");
  return { success: true };
}

export async function getOffenePostenCount() {
  return prisma.invoice.count({ where: { status: { in: ["ENTWURF", "VERSENDET"] } } });
}

export async function deleteInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { orderId: true },
  });

  // Find Baustellen affected by this invoice before unlinking
  const affectedNotes = await prisma.deliveryNote.findMany({
    where: { invoiceId: id, baustelleId: { not: null } },
    select: { baustelleId: true },
  });
  const affectedBaustelleIds = [...new Set(affectedNotes.map((n) => n.baustelleId!))];

  await prisma.$transaction([
    prisma.deliveryNote.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } }),
    prisma.invoice.delete({ where: { id } }),
  ]);

  // If invoice was linked to an order, revert order status from VERRECHNET → IN_LIEFERUNG
  // (only if no other invoices remain for that order)
  if (invoice?.orderId) {
    const remainingInvoices = await prisma.invoice.count({
      where: { orderId: invoice.orderId },
    });
    if (remainingInvoices === 0) {
      await prisma.order.updateMany({
        where: { id: invoice.orderId, status: "VERRECHNET" },
        data: { status: "IN_LIEFERUNG" },
      });
      revalidatePath(`/auftraege/${invoice.orderId}`);
      revalidatePath("/auftraege");
    }
  }

  // Revert Baustelle status from VERRECHNET → IN_LIEFERUNG (now has unlinked delivery notes again)
  for (const baustelleId of affectedBaustelleIds) {
    await prisma.baustelle.updateMany({
      where: { id: baustelleId, status: "VERRECHNET" },
      data: { status: "IN_LIEFERUNG" },
    });
    revalidatePath(`/baustellen/${baustelleId}`);
  }

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

    // Close "Rechnung prüfen & versenden", create "Zahlungseingang prüfen"
    await closeTasksByTitle(invoiceId, "Rechnung prüfen & versenden");
    const ctx = await getInvoiceContext(invoiceId);
    if (ctx) {
      const label = ctx.order?.title ?? "Auftrag";
      await prisma.task.create({
        data: {
          title: `Zahlungseingang prüfen – ${label}`,
          description: "Rechnung wurde versendet. Bitte Zahlungseingang überwachen.",
          contactId: ctx.contactId,
          invoiceId,
          assignedTo: ctx.order?.quote?.assignedTo ?? null,
          dueDate: ctx.dueDate ?? null,
          priority: "NORMAL",
          status: "OPEN",
        },
      });
    }

    revalidatePath("/aufgaben");
    revalidatePath("/rechnungen");
    revalidatePath(`/rechnungen/${invoiceId}`);
    return { success: true };
  } catch (e) {
    console.error("sendInvoiceEmail error:", e);
    return { error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}
