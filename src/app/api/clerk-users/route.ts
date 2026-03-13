import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ limit: 100 });

  const result = users.map((u) => ({
    id: u.id,
    name:
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      u.emailAddresses[0]?.emailAddress ||
      u.id,
    email: u.emailAddresses[0]?.emailAddress ?? null,
  }));

  return NextResponse.json({ users: result });
}
