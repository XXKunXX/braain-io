import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

// Phonetische Varianten des Suchbegriffs: Umlaute, Doppelkonsonanten
function getQueryVariants(q: string): string[] {
  const variants = new Set<string>([q]);

  // ü→u, ö→o, ä→a, ß→ss
  const noUmlauts = q
    .replace(/ü/gi, "u")
    .replace(/ö/gi, "o")
    .replace(/ä/gi, "a")
    .replace(/ß/g, "ss");
  variants.add(noUmlauts);

  // ue→ü, oe→ö, ae→ä (Tippfehler ohne Umlaut-Taste)
  const withUmlauts = q
    .replace(/ue/gi, "ü")
    .replace(/oe/gi, "ö")
    .replace(/ae/gi, "ä");
  if (withUmlauts !== q) variants.add(withUmlauts);

  // Doppelte Konsonanten → einfach (Müller → Müler, Miller → Miler)
  const halved = q.replace(/([ltnmrsfpkdbgcz])\1/gi, "$1");
  if (halved !== q) variants.add(halved);

  // Einfache Konsonanten → doppelt (Müler → Müller, Miler → Miller)
  const doubled = q.replace(/([ltnmrsfpkdbgcz])(?!\1)/gi, "$1$1");
  if (doubled !== q && doubled.length <= q.length + 4) variants.add(doubled);

  // Normalisierte Variante auch mit Umlaut-Expansion kombinieren
  const noUmlauts_halved = halved
    .replace(/ü/gi, "u")
    .replace(/ö/gi, "o")
    .replace(/ä/gi, "a")
    .replace(/ß/g, "ss");
  if (noUmlauts_halved !== halved) variants.add(noUmlauts_halved);

  return [...variants].filter((v) => v.length >= 2);
}

function containsAny(field: string, variants: string[]) {
  const mode = "insensitive" as const;
  return variants.map((v) => ({ [field]: { contains: v, mode } }));
}

function contactVariants(variants: string[]) {
  return [
    ...containsAny("companyName", variants),
    ...containsAny("firstName", variants),
    ...containsAny("lastName", variants),
  ];
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: {} });

  const variants = getQueryVariants(q);

  const [contacts, requests, quotes, orders, deliveryNotes, tasks, resources, attachments, baustellen] = await Promise.all([
    prisma.contact.findMany({
      where: { OR: [...containsAny("companyName", variants), ...containsAny("firstName", variants), ...containsAny("lastName", variants), ...containsAny("email", variants)] },
      take: 8,
      select: { id: true, companyName: true, firstName: true, lastName: true, type: true },
    }),
    prisma.request.findMany({
      where: { OR: [...containsAny("title", variants), ...containsAny("description", variants), { contact: { OR: contactVariants(variants) } }] },
      take: 10,
      select: { id: true, title: true, status: true, contact: { select: { companyName: true, firstName: true, lastName: true } } },
    }),
    prisma.quote.findMany({
      where: { OR: [...containsAny("title", variants), ...containsAny("quoteNumber", variants), { contact: { OR: contactVariants(variants) } }] },
      take: 10,
      select: { id: true, title: true, quoteNumber: true, status: true, contact: { select: { companyName: true, firstName: true, lastName: true } } },
    }),
    prisma.order.findMany({
      where: { OR: [...containsAny("title", variants), ...containsAny("orderNumber", variants), { contact: { OR: contactVariants(variants) } }] },
      take: 10,
      select: { id: true, title: true, orderNumber: true, status: true, contact: { select: { companyName: true, firstName: true, lastName: true } } },
    }),
    prisma.deliveryNote.findMany({
      where: { OR: [...containsAny("deliveryNumber", variants), ...containsAny("material", variants), { contact: { OR: contactVariants(variants) } }] },
      take: 10,
      select: { id: true, deliveryNumber: true, material: true, contact: { select: { companyName: true, firstName: true, lastName: true } } },
    }),
    prisma.task.findMany({
      where: { OR: [...containsAny("title", variants), ...containsAny("description", variants)] },
      take: 8,
      select: { id: true, title: true, status: true, priority: true },
    }),
    prisma.resource.findMany({
      where: { OR: containsAny("name", variants) },
      take: 8,
      select: { id: true, name: true, type: true },
    }),
    prisma.attachment.findMany({
      where: { OR: containsAny("fileName", variants) },
      take: 8,
      select: { id: true, fileName: true, contact: { select: { companyName: true, firstName: true, lastName: true } } },
    }),
    prisma.baustelle.findMany({
      where: { OR: [...containsAny("name", variants), ...containsAny("address", variants), ...containsAny("city", variants), ...containsAny("bauleiter", variants)] },
      take: 10,
      select: { id: true, name: true, status: true, city: true, order: { select: { orderNumber: true } } },
    }),
  ]);

  // Deduplizieren (mehrere Varianten könnten dasselbe Ergebnis liefern)
  function dedup<T extends { id: string }>(arr: T[]): T[] {
    const seen = new Set<string>();
    return arr.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  return NextResponse.json({
    results: {
      contacts: dedup(contacts),
      requests: dedup(requests),
      quotes: dedup(quotes),
      orders: dedup(orders),
      deliveryNotes: dedup(deliveryNotes),
      tasks: dedup(tasks),
      resources: dedup(resources),
      attachments: dedup(attachments),
      baustellen: dedup(baustellen),
    },
  });
}
