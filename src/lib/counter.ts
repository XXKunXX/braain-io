import { prisma } from "./prisma";

export async function getNextNumber(
  key: "quote" | "order" | "delivery" | "invoice"
): Promise<string> {
  const [counter, settings] = await Promise.all([
    prisma.counter.upsert({
      where:  { key },
      update: { value: { increment: 1 } },
      create: { key, value: 1 },
    }),
    prisma.appSettings.upsert({
      where:  { id: "singleton" },
      update: {},
      create: { id: "singleton" },
      select: { quotePrefix: true, orderPrefix: true, deliveryPrefix: true, invoicePrefix: true },
    }),
  ]);

  const prefix: Record<string, string> = {
    quote:    settings.quotePrefix,
    order:    settings.orderPrefix,
    delivery: settings.deliveryPrefix,
    invoice:  settings.invoicePrefix ?? "RE",
  };

  return `${prefix[key]}-${String(counter.value).padStart(5, "0")}`;
}
