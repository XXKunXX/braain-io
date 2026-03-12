import { prisma } from "./prisma";

export async function getNextNumber(
  key: "quote" | "order" | "delivery"
): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });

  const prefix: Record<string, string> = {
    quote: "ANG",
    order: "AUF",
    delivery: "LS",
  };

  return `${prefix[key]}-${String(counter.value).padStart(5, "0")}`;
}
