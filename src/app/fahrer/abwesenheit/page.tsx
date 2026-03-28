import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getAbwesenheiten } from "@/actions/fahrer-features";
import { AbwesenheitShell } from "@/components/fahrer/abwesenheit-shell";

export default async function AbwesenheitPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Fahrer";
  const today = format(new Date(), "yyyy-MM-dd");
  const history = await getAbwesenheiten(userId);

  return (
    <AbwesenheitShell
      clerkUserId={userId}
      userName={userName}
      today={today}
      history={history}
    />
  );
}
