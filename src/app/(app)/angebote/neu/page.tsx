import { getContacts } from "@/actions/contacts";
import { getUsers } from "@/actions/users";
import { getRequest } from "@/actions/requests";
import { NewQuoteClient } from "@/components/quotes/new-quote-client";

export default async function NeuesAngebotPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string; contactId?: string }>;
}) {
  const { requestId, contactId } = await searchParams;
  const [contacts, users, rawRequest] = await Promise.all([
    getContacts(),
    getUsers(),
    requestId ? getRequest(requestId) : Promise.resolve(null),
  ]);
  const userNames = users.map((u) => `${u.firstName} ${u.lastName}`.trim()).filter(Boolean);

  // Strip non-serializable Decimal fields from nested quotes
  const request = rawRequest
    ? {
        ...rawRequest,
        quotes: rawRequest.quotes?.map((q) => ({
          ...q,
          totalPrice: Number(q.totalPrice),
          items: q.items.map((i) => ({
            ...i,
            unitPrice: Number(i.unitPrice),
            total: Number(i.total),
            quantity: Number(i.quantity),
          })),
        })),
      }
    : null;

  return (
    <NewQuoteClient
      contacts={contacts}
      userNames={userNames}
      prefillContactId={contactId}
      prefillRequest={request as any}
    />
  );
}
