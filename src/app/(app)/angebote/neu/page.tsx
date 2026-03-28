import { getContacts } from "@/actions/contacts";
import { getUsers } from "@/actions/users";
import { getRequest } from "@/actions/requests";
import { getResources } from "@/actions/resources";
import { getMachines } from "@/actions/machines";
import { NewQuoteClient } from "@/components/quotes/new-quote-client";

export default async function NeuesAngebotPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string; contactId?: string }>;
}) {
  const { requestId, contactId } = await searchParams;
  const [contacts, users, rawRequest, allResources, machines] = await Promise.all([
    getContacts(),
    getUsers(),
    requestId ? getRequest(requestId) : Promise.resolve(null),
    getResources(),
    getMachines(),
  ]);
  const products = allResources.filter((r) => r.type === "PRODUKT");
  const userNames = users.filter((u) => u.role !== "Fahrer").map((u) => `${u.firstName} ${u.lastName}`.trim()).filter(Boolean);

  // Strip non-serializable Decimal/Date fields
  const request = rawRequest
    ? {
        ...rawRequest,
        contactNotes: rawRequest.contactNotes?.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        })),
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

  const defaultValidUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <NewQuoteClient
      contacts={contacts}
      userNames={userNames}
      products={products}
      machines={machines}
      prefillContactId={contactId}
      prefillRequest={request as any}
      defaultValidUntil={defaultValidUntil}
    />
  );
}
