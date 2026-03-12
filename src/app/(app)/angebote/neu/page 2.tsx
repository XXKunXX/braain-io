import { getRequest } from "@/actions/requests";
import { getContacts } from "@/actions/contacts";
import { getUsers } from "@/actions/users";
import { NewQuoteClient } from "@/components/quotes/new-quote-client";

export default async function NeuesAngebotPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string; contactId?: string }>;
}) {
  const { requestId, contactId } = await searchParams;

  const [contacts, users, request] = await Promise.all([
    getContacts(),
    getUsers(),
    requestId ? getRequest(requestId) : Promise.resolve(null),
  ]);

  const userNames = users.map((u) => `${u.firstName} ${u.lastName}`.trim());

  return (
    <NewQuoteClient
      contacts={contacts}
      userNames={userNames}
      prefillContactId={contactId}
      prefillRequest={request}
    />
  );
}
