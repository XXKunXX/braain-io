import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Runs daily – creates "Mahnung versenden" tasks for overdue invoices that don't have one yet.
export async function GET(request: Request) {
  // Secret ist immer erforderlich
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prüfen ob Mahnungs-Cron in den Programmeinstellungen aktiviert ist
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.mahnungCronEnabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Mahnungs-Cron ist deaktiviert" });
  }

  const now = new Date();

  // Find overdue invoices (sent, past due date)
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: "VERSENDET",
      dueDate: { lt: now },
    },
    select: {
      id: true,
      contactId: true,
      order: { select: { title: true, quote: { select: { assignedTo: true } } } },
      contact: { select: { companyName: true, firstName: true, lastName: true } },
    },
  });

  let created = 0;

  for (const invoice of overdueInvoices) {
    // Skip if there's already an open "Mahnung versenden" task for this invoice
    const existing = await prisma.task.findFirst({
      where: { invoiceId: invoice.id, title: { startsWith: "Mahnung versenden" }, status: { not: "DONE" } },
    });
    if (existing) continue;

    const contactName = invoice.contact.companyName
      || [invoice.contact.firstName, invoice.contact.lastName].filter(Boolean).join(" ")
      || "Unbekannt";
    const label = invoice.order?.title ?? contactName;

    await prisma.task.create({
      data: {
        title: `Mahnung versenden – ${label}`,
        description: "Zahlungsziel wurde überschritten. Bitte Mahnung an den Kunden versenden.",
        contactId: invoice.contactId,
        invoiceId: invoice.id,
        assignedTo: invoice.order?.quote?.assignedTo ?? null,
        priority: "URGENT",
        status: "OPEN",
      },
    });

    created++;
  }

  return NextResponse.json({ ok: true, created });
}
