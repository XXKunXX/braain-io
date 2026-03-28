import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getChatMessages } from "@/actions/fahrer-features";
import { NachrichtenShell } from "@/components/fahrer/nachrichten-shell";

export default async function NachrichtenPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Fahrer";
  const messages = await getChatMessages(userId);

  return (
    <NachrichtenShell
      clerkUserId={userId}
      userName={userName}
      messages={messages.map((m: any) => ({
        ...m,
        createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
      }))}
    />
  );
}
