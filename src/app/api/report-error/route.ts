import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { reportBetaError } from "@/lib/report-error";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  const body = await req.json().catch(() => ({}));

  await reportBetaError(
    { message: body.message ?? "Unbekannter Client-Fehler", stack: body.stack },
    {
      location: body.location ?? "Client Error Boundary",
      userId:   user?.id,
      extra:    { url: body.url, userAgent: req.headers.get("user-agent") },
    }
  );

  return NextResponse.json({ ok: true });
}
