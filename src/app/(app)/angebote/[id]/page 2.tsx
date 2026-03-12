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

  const userNames = users.map((u) => `${u.firstName} ${u.lastName}`.trim());

  return <QuoteDetail quote={quote} userNames={userNames} />;
}
