import { getPaymentMilestones } from "@/actions/payment-milestones";
import { prisma } from "@/lib/prisma";
import { ZahlungenList } from "@/components/zahlungen/zahlungen-list";

export default async function ZahlungenPage() {
  const [milestones, orders] = await Promise.all([
    getPaymentMilestones(),
    prisma.order.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE"] } },
      select: { id: true, title: true, orderNumber: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const serialized = milestones.map((m) => ({
    ...m,
    amount: m.amount.toNumber(),
  }));

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Zahlungen</h1>
        <p className="text-sm text-gray-400 mt-0.5">{milestones.length} Zahlungsmeilensteine</p>
      </div>
      <ZahlungenList milestones={serialized} orders={orders} />
    </div>
  );
}
