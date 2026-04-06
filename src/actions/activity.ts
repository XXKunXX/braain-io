"use server";
import { prisma } from "@/lib/prisma";

export type ActivityEvent = {
  id: string;
  type: "created" | "note" | "document" | "payment" | "delivery" | "baustelle" | "status" | "quote" | "request" | "task" | "disposition";
  title: string;
  description?: string;
  actor?: string;
  actorType: "USER" | "SYSTEM";
  actorImage?: string;
  date: Date;
  link?: string;
};

function actorInfo(name?: string | null): { actor: string; actorType: "USER" | "SYSTEM" } {
  if (name && name.trim() !== "" && name !== "System") {
    return { actor: name, actorType: "USER" };
  }
  return { actor: "System", actorType: "SYSTEM" };
}

export async function getOrderActivity(orderId: string): Promise<ActivityEvent[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      quote: true,
      baustellen: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return [];

  const events: ActivityEvent[] = [];

  // Order created
  events.push({
    id: `order-created`,
    type: "created",
    title: "Auftrag erstellt",
    description: order.title,
    ...actorInfo(order.createdByName),
    date: order.createdAt,
    link: `/auftraege/${order.id}`,
  });

  // Quote linked (always System — happens automatically when order is created from quote)
  if (order.quote) {
    events.push({
      id: `quote-${order.quote.id}`,
      type: "quote",
      title: `Angebot ${order.quote.quoteNumber} verknüpft`,
      description: order.quote.title,
      actor: "System",
      actorType: "SYSTEM",
      date: order.quote.createdAt,
      link: `/angebote/${order.quote.id}`,
    });
    if (order.quote.status === "ACCEPTED") {
      events.push({
        id: `quote-accepted-${order.quote.id}`,
        type: "status",
        title: `Angebot ${order.quote.quoteNumber} angenommen`,
        ...actorInfo(order.quote.statusChangedByName),
        date: order.quote.updatedAt,
      });
    }
  }

  // Status changes
  if (order.status === "DISPONIERT" || order.status === "IN_LIEFERUNG" || order.status === "VERRECHNET" || order.status === "ABGESCHLOSSEN") {
    events.push({
      id: `order-active`,
      type: "status",
      title: "Auftrag disponiert",
      ...actorInfo(order.statusChangedByName),
      date: order.updatedAt,
    });
  }
  if (order.status === "ABGESCHLOSSEN") {
    events.push({
      id: `order-completed`,
      type: "status",
      title: "Auftrag abgeschlossen",
      ...actorInfo(order.statusChangedByName),
      date: order.updatedAt,
    });
  }

  // Baustellen
  for (const b of order.baustellen) {
    events.push({
      id: `baustelle-${b.id}`,
      type: "baustelle",
      title: `Baustelle „${b.name}" hinzugefügt`,
      description: b.city ?? undefined,
      ...actorInfo((b as { createdByName?: string | null }).createdByName),
      date: b.createdAt,
      link: `/baustellen/${b.id}`,
    });
  }

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getContactActivity(contactId: string): Promise<ActivityEvent[]> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      requests: { orderBy: { createdAt: "asc" } },
      quotes: { orderBy: { createdAt: "asc" } },
      orders: { orderBy: { createdAt: "asc" } },
      deliveryNotes: { orderBy: { createdAt: "asc" } },
      contactNotes: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!contact) return [];

  const events: ActivityEvent[] = [];

  // Contact created
  events.push({
    id: `contact-created`,
    type: "created",
    title: "Kontakt angelegt",
    description: contact.companyName,
    actor: "System",
    actorType: "SYSTEM",
    date: contact.createdAt,
  });

  // Requests
  for (const r of contact.requests) {
    events.push({
      id: `request-${r.id}`,
      type: "request",
      title: `Anfrage erstellt`,
      description: r.title,
      ...actorInfo((r as { createdByName?: string | null }).createdByName),
      date: r.createdAt,
      link: `/anfragen/${r.id}`,
    });
  }

  // Quotes
  for (const q of contact.quotes) {
    events.push({
      id: `quote-${q.id}`,
      type: "quote",
      title: `Angebot ${q.quoteNumber} erstellt`,
      description: q.title,
      ...actorInfo(q.createdByName),
      date: q.createdAt,
      link: `/angebote/${q.id}`,
    });
    if (q.status === "SENT") {
      events.push({
        id: `quote-sent-${q.id}`,
        type: "status",
        title: `Angebot ${q.quoteNumber} versendet`,
        ...actorInfo(q.statusChangedByName),
        date: q.updatedAt,
      });
    }
    if (q.status === "ACCEPTED") {
      events.push({
        id: `quote-accepted-${q.id}`,
        type: "status",
        title: `Angebot ${q.quoteNumber} angenommen`,
        ...actorInfo(q.statusChangedByName),
        date: q.updatedAt,
      });
    }
    if (q.status === "REJECTED") {
      events.push({
        id: `quote-rejected-${q.id}`,
        type: "status",
        title: `Angebot ${q.quoteNumber} abgelehnt`,
        ...actorInfo(q.statusChangedByName),
        date: q.updatedAt,
      });
    }
  }

  // Orders
  for (const o of contact.orders) {
    events.push({
      id: `order-${o.id}`,
      type: "created",
      title: `Auftrag ${o.orderNumber} erstellt`,
      description: o.title,
      ...actorInfo((o as { createdByName?: string | null }).createdByName),
      date: o.createdAt,
      link: `/auftraege/${o.id}`,
    });
  }

  // Delivery notes
  for (const d of contact.deliveryNotes) {
    events.push({
      id: `delivery-${d.id}`,
      type: "delivery",
      title: `Lieferschein ${d.deliveryNumber} erstellt`,
      description: d.material ?? undefined,
      ...actorInfo((d as { createdByName?: string | null }).createdByName),
      date: d.createdAt,
    });
  }

  // Contact notes
  for (const n of contact.contactNotes) {
    const isUser = !!n.createdBy && n.createdBy !== "System";
    events.push({
      id: `note-${n.id}`,
      type: "note",
      title: "Notiz hinzugefügt",
      description: n.content.slice(0, 80) + (n.content.length > 80 ? "…" : ""),
      actor: n.createdBy ?? "System",
      actorType: isUser ? "USER" : "SYSTEM",
      date: n.createdAt,
    });
  }

  // Attachments
  for (const a of contact.attachments) {
    events.push({
      id: `attachment-${a.id}`,
      type: "document",
      title: "Dokument hochgeladen",
      description: a.fileName,
      ...actorInfo((a as { createdByName?: string | null }).createdByName),
      date: a.createdAt,
    });
  }

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}
