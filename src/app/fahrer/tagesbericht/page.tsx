import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getBaustellenForDriverByClerkId, getBaustellenForDriverApp } from "@/actions/driver";
import { getFahrerTagesrapporte } from "@/actions/tagesbericht";
import { TagesberichtShell } from "@/components/fahrer/tagesbericht-shell";

export default async function TagesberichtPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";
  const today = new Date().toISOString().split("T")[0];

  const [baustellen, history] = await Promise.all([
    role === "Fahrer"
      ? getBaustellenForDriverByClerkId(today, userId)
      : getBaustellenForDriverApp(today),
    getFahrerTagesrapporte(userId),
  ]);

  const baustellenOptions = baustellen.map((b) => ({ id: b.id, name: b.name }));

  const serializedHistory = history.map((r) => ({
    id: r.id,
    baustelleId: r.baustelleId,
    date: new Date(r.date),
    driverName: r.driverName,
    machineName: r.machineName,
    hours: r.hours != null ? Number(r.hours) : null,
    employees: r.employees,
    description: r.description,
    baustelle: r.baustelle,
  }));

  return (
    <TagesberichtShell
      clerkUserId={userId}
      userName={user?.firstName ?? "Fahrer"}
      today={today}
      baustellen={baustellenOptions}
      history={serializedHistory}
    />
  );
}
