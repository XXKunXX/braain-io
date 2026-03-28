import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const cookieValue = Buffer.from(JSON.stringify({ state, userId })).toString("base64");

  const origin = new URL(request.url).origin;

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/calendar/outlook/callback`,
    response_type: "code",
    scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read",
    response_mode: "query",
    state,
  });

  const response = NextResponse.redirect(
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  );

  response.cookies.set("cal_oauth", cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
