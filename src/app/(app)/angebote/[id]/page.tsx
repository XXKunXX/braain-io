import { notFound } from "next/navigation";
import { getQuote } from "@/actions/quotes";
import { getUsers } from "@/actions/users";
import { QuoteDetail } from "@/components/quotes/quote-detail";

export default async function AngebotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, users] = await Promise.all([getQuote(id), getUsers()]);

  if (!quote) notFound();

  const serialized = {
    ...quote,
    totalPrice: Number(quote.totalPrice),
    validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    items: quote.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
  };

  const userNames = users.map((u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim());

  return <QuoteDetail quote={serialized as any} userNames={userNames} />;
}
