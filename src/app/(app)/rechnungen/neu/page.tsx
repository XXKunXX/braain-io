import { getContacts } from "@/actions/contacts";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/actions/settings";
import { CreateInvoiceForm } from "@/components/invoices/create-invoice-form";

export default async function NeueRechnungPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; milestoneId?: string }>;
}) {
  const { orderId, milestoneId } = await searchParams;

  const [contacts, orders, settings] = await Promise.all([
    getContacts(),
    prisma.order.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE", "COMPLETED"] } },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        contactId: true,
        paymentMilestones: {
          select: { id: true, title: true, amount: true, type: true, invoiceNumber: true },
          where: { invoiceNumber: null },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getSettings(),
  ]);

  // Prefill order if orderId given
  let prefillOrder: (typeof orders)[0] | undefined;
  let prefillMilestone: { id: string; title: string; amount: number; type: string } | undefined;

  if (orderId) {
    prefillOrder = orders.find((o) => o.id === orderId);
    if (prefillOrder && milestoneId) {
      const ms = prefillOrder.paymentMilestones.find((m) => m.id === milestoneId);
      if (ms) prefillMilestone = { ...ms, amount: Number(ms.amount) };
    }
  }

  const serializedOrders = orders.map((o) => ({
    ...o,
    paymentMilestones: o.paymentMilestones.map((m) => ({
      ...m,
      amount: Number(m.amount),
    })),
  }));

  return (
    <CreateInvoiceForm
      contacts={contacts}
      orders={serializedOrders}
      defaultVatRate={Number(settings.vatRate)}
      prefillOrderId={prefillOrder?.id}
      prefillContactId={prefillOrder?.contactId}
      prefillMilestoneId={prefillMilestone?.id}
      prefillMilestoneAmount={prefillMilestone?.amount}
      prefillMilestoneTitle={prefillMilestone?.title}
    />
  );
}
