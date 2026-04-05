import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!from || !to) return NextResponse.json({ error: "Missing from/to" }, { status: 400 });

  const gte = new Date(from);
  const lte = new Date(to);

  const [requests, quotesCreated, quotesSent, quotesAccepted, ordersCompleted] = await Promise.all([
    prisma.request.count({ where: { createdAt: { gte, lte } } }),
    prisma.quote.count({ where: { createdAt: { gte, lte } } }),
    prisma.quote.count({ where: { status: "SENT", updatedAt: { gte, lte } } }),
    prisma.quote.count({ where: { status: "ACCEPTED", updatedAt: { gte, lte } } }),
    prisma.order.count({ where: { status: "ABGESCHLOSSEN", updatedAt: { gte, lte } } }),
  ]);

  return NextResponse.json({ requests, quotesCreated, quotesSent, quotesAccepted, ordersCompleted });
}
