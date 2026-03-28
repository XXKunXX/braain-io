import { currentUser } from "@clerk/nextjs/server";
import { getBaustellenForDriverApp, getBaustellenForDriverByClerkId } from "@/actions/driver";
import { DriverAppShell } from "@/components/fahrer/driver-app-shell";
import { getSettings } from "@/actions/settings";

export default async function FahrerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const user = await currentUser();
  const dateStr = params.date ?? new Date().toISOString().split("T")[0];
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";

  const [baustellenRaw, settings] = await Promise.all([
    role === "Fahrer" && user?.id
      ? getBaustellenForDriverByClerkId(dateStr, user.id)
      : getBaustellenForDriverApp(dateStr),
    getSettings(),
  ]);
  const baustellen = baustellenRaw;
  const companyAddress = [settings.street, settings.postalCode, settings.city].filter(Boolean).join(" ") || undefined;

  const serialized = baustellen.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status as "PLANNED" | "ACTIVE" | "PENDING" | "INVOICED" | "COMPLETED",
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
      companyAddress={companyAddress}
    />
  );
}
