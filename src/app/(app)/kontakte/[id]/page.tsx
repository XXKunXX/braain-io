import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getContact } from "@/actions/contacts";
import { getUsers } from "@/actions/users";
import { ContactDetail } from "@/components/contacts/contact-detail";

export default async function KontaktDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contact, users, clerkUser] = await Promise.all([getContact(id), getUsers(), currentUser()]);

  if (!contact) notFound();

  const userNames = users.map((u) => `${u.firstName} ${u.lastName}`.trim());
  const currentUserName = clerkUser ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() : undefined;

  const serializedContact = {
    ...contact,
    quotes: contact.quotes.map((q) => ({ ...q, totalPrice: q.totalPrice.toNumber() })),
    deliveryNotes: contact.deliveryNotes.map((dn) => ({ ...dn, quantity: dn.quantity.toNumber() })),
  } as unknown as typeof contact;

  return <ContactDetail contact={serializedContact} userNames={userNames} currentUserName={currentUserName} />;
}
