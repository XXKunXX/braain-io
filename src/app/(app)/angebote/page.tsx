import { getQuotes } from "@/actions/quotes";
import { QuoteList } from "@/components/quotes/quote-list";
import { CreateQuoteButton } from "@/components/quotes/create-quote-button";

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

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Angebote</h1>
          <p className="text-sm text-gray-400 mt-0.5">{quotes.length} Angebote</p>
        </div>
        <CreateQuoteButton />
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <QuoteList quotes={quotes as any} currentStatus={params.status} />
    </div>
  );
}
