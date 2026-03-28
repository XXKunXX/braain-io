import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getTankbuch } from "@/actions/fahrer-features";
import { TankbuchShell } from "@/components/fahrer/tankbuch-shell";

export default async function TankbuchPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Fahrer";
  const today = format(new Date(), "yyyy-MM-dd");
  const history = await getTankbuch(userId);

  return (
    <TankbuchShell
      clerkUserId={userId}
      userName={userName}
      today={today}
      history={history}
    />
  );
}
