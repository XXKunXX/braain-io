import { getUsers } from "@/actions/users";
import { NewContactClient } from "@/components/contacts/new-contact-client";

export default async function NeuerKontaktPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const users = await getUsers();
  const userNames = users.filter((u) => u.role !== "Fahrer").map((u) => `${u.firstName} ${u.lastName}`.trim()).filter(Boolean);
  return <NewContactClient userNames={userNames} returnTo={returnTo} />;
}
