import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const redirect = (err: string) =>
    NextResponse.redirect(`${origin}/kalender-integration?error=${err}`);

  if (error) return redirect("access_denied");
  if (!code || !state) return redirect("missing_params");

  // Verify CSRF state via cookie
  const cookieRaw = request.cookies.get("cal_oauth")?.value;
  if (!cookieRaw) return redirect("missing_state");

  let cookieData: { state: string; userId: string };
  try {
    cookieData = JSON.parse(Buffer.from(cookieRaw, "base64").toString());
  } catch {
    return redirect("invalid_state");
  }

  if (cookieData.state !== state) return redirect("state_mismatch");
  const { userId } = cookieData;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/calendar/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return redirect("token_exchange_failed");
  const tokens = await tokenRes.json();

  // Get account email
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoRes.ok) return redirect("userinfo_failed");
  const userInfo = await userInfoRes.json();

  // Save integration to DB
  await prisma.calendarIntegration.upsert({
    where: { clerkUserId_provider: { clerkUserId: userId, provider: "GOOGLE" } },
    create: {
      clerkUserId: userId,
      provider: "GOOGLE",
      accountEmail: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      status: "ACTIVE",
    },
    update: {
      accountEmail: userInfo.email,
      accessToken: tokens.access_token,
      // Only overwrite refresh token if we got a new one (Google only sends it on first auth)
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      status: "ACTIVE",
    },
  });

  const response = NextResponse.redirect(`${origin}/kalender-integration?success=google`);
  response.cookies.delete("cal_oauth");
  return response;
}
