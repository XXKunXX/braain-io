import { getContacts } from "@/actions/contacts";
import { getUsers } from "@/actions/users";
import { NewRequestClient } from "@/components/requests/new-request-client";

export default async function NeueAnfragePage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string }>;
}) {
  const { contactId } = await searchParams;
  const [contacts, users] = await Promise.all([getContacts(), getUsers()]);
  const userNames = users.map((u) => `${u.firstName} ${u.lastName}`.trim()).filter(Boolean);

  return <NewRequestClient contacts={contacts} userNames={userNames} preselectedContactId={contactId} />;
}
