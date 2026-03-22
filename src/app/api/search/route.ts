import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: {} });

  const mode = "insensitive" as const;

  const [contacts, requests, quotes, orders, deliveryNotes, tasks, resources, attachments, baustellen] = await Promise.all([
    prisma.contact.findMany({
      where: { OR: [{ companyName: { contains: q, mode } }, { firstName: { contains: q, mode } }, { lastName: { contains: q, mode } }, { email: { contains: q, mode } }] },
      take: 5,
      select: { id: true, companyName: true, firstName: true, lastName: true, type: true },
    }),
    prisma.request.findMany({
      where: { OR: [{ title: { contains: q, mode } }, { description: { contains: q, mode } }, { contact: { OR: [{ companyName: { contains: q, mode } }, { firstName: { contains: q, mode } }, { lastName: { contains: q, mode } }] } }] },
      take: 8,
      select: { id: true, title: true, status: true, contact: { select: { companyName: true } } },
    }),
    prisma.quote.findMany({
      where: { OR: [{ title: { contains: q, mode } }, { quoteNumber: { contains: q, mode } }, { contact: { OR: [{ companyName: { contains: q, mode } }, { firstName: { contains: q, mode } }, { lastName: { contains: q, mode } }] } }] },
      take: 8,
      select: { id: true, title: true, quoteNumber: true, status: true, contact: { select: { companyName: true } } },
    }),
    prisma.order.findMany({
      where: { OR: [{ title: { contains: q, mode } }, { orderNumber: { contains: q, mode } }, { contact: { OR: [{ companyName: { contains: q, mode } }, { firstName: { contains: q, mode } }, { lastName: { contains: q, mode } }] } }] },
      take: 8,
      select: { id: true, title: true, orderNumber: true, status: true, contact: { select: { companyName: true } } },
    }),
    prisma.deliveryNote.findMany({
      where: { OR: [{ deliveryNumber: { contains: q, mode } }, { material: { contains: q, mode } }, { contact: { OR: [{ companyName: { contains: q, mode } }, { firstName: { contains: q, mode } }, { lastName: { contains: q, mode } }] } }] },
      take: 8,
      select: { id: true, deliveryNumber: true, material: true, contact: { select: { companyName: true } } },
    }),
    prisma.task.findMany({
      where: { OR: [{ title: { contains: q, mode } }, { description: { contains: q, mode } }] },
      take: 5,
      select: { id: true, title: true, status: true, priority: true },
    }),
    prisma.resource.findMany({
      where: { name: { contains: q, mode } },
      take: 5,
      select: { id: true, name: true, type: true },
    }),
    prisma.attachment.findMany({
      where: { fileName: { contains: q, mode } },
      take: 5,
      select: { id: true, fileName: true, contact: { select: { companyName: true } } },
    }),
    prisma.baustelle.findMany({
      where: { OR: [{ name: { contains: q, mode } }, { address: { contains: q, mode } }, { city: { contains: q, mode } }, { bauleiter: { contains: q, mode } }] },
      take: 8,
      select: { id: true, name: true, status: true, city: true, order: { select: { orderNumber: true } } },
    }),
  ]);

  return NextResponse.json({ results: { contacts, requests, quotes, orders, deliveryNotes, tasks, resources, attachments, baustellen } });
}
