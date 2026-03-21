import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getZeiterfassungByDate, getZeiterfassungHistory } from "@/actions/zeiterfassung";
import { getBaustellenForDriverByClerkId, getBaustellenForDriverApp } from "@/actions/driver";
import { ZeiterfassungShell } from "@/components/fahrer/zeiterfassung-shell";
import { currentUser } from "@clerk/nextjs/server";

export default async function ZeiterfassungPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = params.date ?? today;

  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";

  const [eintrag, history, baustellen] = await Promise.all([
    getZeiterfassungByDate(userId, date),
    getZeiterfassungHistory(userId, 14),
    role === "Fahrer"
      ? getBaustellenForDriverByClerkId(date, userId)
      : getBaustellenForDriverApp(date),
  ]);

  const serializedEintrag = eintrag ? {
    id: eintrag.id,
    date: eintrag.date,
    startTime: eintrag.startTime ?? null,
    endTime: eintrag.endTime ?? null,
    pauseMinutes: eintrag.pauseMinutes,
    notes: eintrag.notes ?? null,
    baustelleId: eintrag.baustelleId ?? null,
    baustelleName: eintrag.baustelle?.name ?? null,
  } : null;

  const serializedHistory = history.map((e: any) => ({
    id: e.id,
    date: e.date,
    startTime: e.startTime ?? null,
    endTime: e.endTime ?? null,
    pauseMinutes: e.pauseMinutes,
    notes: e.notes ?? null,
    baustelleName: e.baustelle?.name ?? null,
  }));

  const baustellenOptions = baustellen.map((b) => ({ id: b.id, name: b.name }));

  return (
    <ZeiterfassungShell
      clerkUserId={userId}
      selectedDate={date}
      today={today}
      eintrag={serializedEintrag}
      history={serializedHistory}
      baustellenOptions={baustellenOptions}
      userName={user?.firstName ?? "Fahrer"}
    />
  );
}
