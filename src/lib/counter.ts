import { prisma } from "./prisma";

export async function getNextNumber(
  key: "quote" | "order" | "delivery" | "invoice"
): Promise<string> {
  // Atomares INSERT ON CONFLICT – verhindert Race Conditions bei gleichzeitigen Requests
  const result = await prisma.$queryRaw<[{ value: bigint }]>`
    INSERT INTO "Counter" (id, key, value)
    VALUES (gen_random_uuid()::text, ${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = "Counter".value + 1
    RETURNING value
  `;
  const value = Number(result[0].value);

  const settings = await prisma.appSettings.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton" },
    select: { quotePrefix: true, orderPrefix: true, deliveryPrefix: true, invoicePrefix: true },
  });

  const prefix: Record<string, string> = {
    quote:    settings.quotePrefix,
    order:    settings.orderPrefix,
    delivery: settings.deliveryPrefix,
    invoice:  settings.invoicePrefix,
  };

  return `${prefix[key]}-${String(value).padStart(5, "0")}`;
}
