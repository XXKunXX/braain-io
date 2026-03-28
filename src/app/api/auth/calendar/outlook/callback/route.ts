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
  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/calendar/outlook/callback`,
        grant_type: "authorization_code",
        scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read",
      }),
    }
  );

  if (!tokenRes.ok) return redirect("token_exchange_failed");
  const tokens = await tokenRes.json();

  // Get account email via Microsoft Graph
  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meRes.ok) return redirect("userinfo_failed");
  const me = await meRes.json();
  const accountEmail = me.mail ?? me.userPrincipalName;

  // Save integration to DB
  await prisma.calendarIntegration.upsert({
    where: { clerkUserId_provider: { clerkUserId: userId, provider: "OUTLOOK" } },
    create: {
      clerkUserId: userId,
      provider: "OUTLOOK",
      accountEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      status: "ACTIVE",
    },
    update: {
      accountEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      status: "ACTIVE",
    },
  });

  const response = NextResponse.redirect(`${origin}/kalender-integration?success=outlook`);
  response.cookies.delete("cal_oauth");
  return response;
}
