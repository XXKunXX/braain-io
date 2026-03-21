import { currentUser } from "@clerk/nextjs/server";
import { getBaustellenForDriverApp, getBaustellenForDriverByClerkId } from "@/actions/driver";
import { DriverAppShell } from "@/components/fahrer/driver-app-shell";

export default async function FahrerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const user = await currentUser();
  const dateStr = params.date ?? new Date().toISOString().split("T")[0];
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";

  const baustellen = role === "Fahrer" && user?.id
    ? await getBaustellenForDriverByClerkId(dateStr, user.id)
    : await getBaustellenForDriverApp(dateStr);

  const serialized = baustellen.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status as "PLANNED" | "ACTIVE" | "COMPLETED",
    startDate: b.entryStart.toISOString(),
    endDate: b.entryEnd.toISOString(),
    address: b.address ?? null,
    postalCode: b.postalCode ?? null,
    city: b.city ?? null,
    contactName: b.contact?.companyName ?? null,
    orderId: b.order?.id ?? null,
  }));

  return (
    <DriverAppShell
      baustellen={serialized}
      userName={user?.firstName ?? "Fahrer"}
      selectedDate={dateStr}
    />
  );
}
