import { notFound } from "next/navigation";
import { getQuote } from "@/actions/quotes";
import { getUsers } from "@/actions/users";
import { getMachines } from "@/actions/machines";
import { QuoteDetail } from "@/components/quotes/quote-detail";

export default async function AngebotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, users, machines] = await Promise.all([getQuote(id), getUsers(), getMachines()]);

  if (!quote) notFound();

  const serialized = {
    ...quote,
    totalPrice: Number(quote.totalPrice),
    validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    contact: quote.contact
      ? { ...quote.contact, createdAt: quote.contact.createdAt.toISOString(), updatedAt: quote.contact.updatedAt.toISOString() }
      : null,
    request: quote.request
      ? { ...quote.request, createdAt: quote.request.createdAt.toISOString(), updatedAt: quote.request.updatedAt.toISOString(), inspectionDate: quote.request.inspectionDate?.toISOString() ?? null }
      : null,
    items: quote.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
  };

  const userNames = users.filter((u) => u.role !== "Fahrer").map((u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()).filter(Boolean);

  return <QuoteDetail quote={serialized as any} userNames={userNames} machines={machines} />;
}
