import { currentUser } from "@clerk/nextjs/server";
import { getOrdersForDriverApp } from "@/actions/driver";
import { DriverAppShell } from "@/components/fahrer/driver-app-shell";

export default async function FahrerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const user = await currentUser();
  const dateStr = params.date ?? new Date().toISOString().split("T")[0];

  const orders = await getOrdersForDriverApp(dateStr);

  const serialized = orders.map((o) => ({
    id: o.id,
    title: o.title,
    status: o.status as "PLANNED" | "ACTIVE" | "COMPLETED",
    startDate: o.startDate.toISOString(),
    endDate: o.endDate.toISOString(),
    contact: {
      companyName: o.contact.companyName,
      address: o.contact.address ?? "",
      postalCode: o.contact.postalCode ?? "",
      city: o.contact.city ?? "",
    },
    siteAddress: o.quote?.siteAddress ?? null,
  }));

  return (
    <DriverAppShell
      orders={serialized}
      userName={user?.firstName ?? "Fahrer"}
      selectedDate={dateStr}
    />
  );
}
