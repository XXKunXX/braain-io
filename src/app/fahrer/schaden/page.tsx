import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { getSchadensmeldungen } from "@/actions/fahrer-features";
import { getBaustellenForDriverByClerkId } from "@/actions/driver";
import { SchadenShell } from "@/components/fahrer/schaden-shell";

export default async function SchadenPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Fahrer";
  const today = format(new Date(), "yyyy-MM-dd");

  const [history, baustellenRaw] = await Promise.all([
    getSchadensmeldungen(userId),
    getBaustellenForDriverByClerkId(today, userId),
  ]);

  const baustellenOptions = baustellenRaw.map((b: any) => ({ id: b.id, name: b.name }));

  return (
    <SchadenShell
      clerkUserId={userId}
      userName={userName}
      today={today}
      history={history}
      baustellenOptions={baustellenOptions}
    />
  );
}
