import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getFahrzeugCheckHistory } from "@/actions/fahrer-features";
import { FahrzeugCheckShell } from "@/components/fahrer/fahrzeug-check-shell";

export default async function FahrzeugCheckPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Fahrer";
  const today = format(new Date(), "yyyy-MM-dd");
  const history = await getFahrzeugCheckHistory(userId);

  return (
    <FahrzeugCheckShell
      clerkUserId={userId}
      userName={userName}
      today={today}
      history={history}
    />
  );
}
