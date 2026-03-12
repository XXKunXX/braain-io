import { getUsers } from "@/actions/users";
import { NewContactClient } from "@/components/contacts/new-contact-client";

export default async function NeuerKontaktPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const users = await getUsers();
  const userNames = users.map((u) => `${u.firstName} ${u.lastName}`.trim());
  return <NewContactClient userNames={userNames} returnTo={returnTo} />;
}
