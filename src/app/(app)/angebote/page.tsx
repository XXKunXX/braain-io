import { getQuotes } from "@/actions/quotes";
import { QuoteList } from "@/components/quotes/quote-list";

export default async function AngebotePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const raw = await getQuotes(params.status);
  const quotes = raw.map((q) => ({
    ...q,
    totalPrice: Number(q.totalPrice),
    validUntil: q.validUntil ? q.validUntil.toISOString() : null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    items: q.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <QuoteList quotes={quotes as any} currentStatus={params.status} />;
}
