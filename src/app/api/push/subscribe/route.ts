import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.auth || !keys?.p256dh) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { clerkUserId: userId, endpoint, auth: keys.auth, p256dh: keys.p256dh },
    update: { clerkUserId: userId, auth: keys.auth, p256dh: keys.p256dh },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  await db.pushSubscription.deleteMany({ where: { endpoint, clerkUserId: userId } });
  return NextResponse.json({ ok: true });
}
