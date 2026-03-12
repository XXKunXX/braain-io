import { notFound } from "next/navigation";
import { getContact } from "@/actions/contacts";
import { getUsers } from "@/actions/users";
import { ContactDetail } from "@/components/contacts/contact-detail";

export default async function KontaktDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contact, users] = await Promise.all([getContact(id), getUsers()]);

  if (!contact) notFound();

  const userNames = users.map((u) => `${u.firstName} ${u.lastName}`.trim());

  const serializedContact = {
    ...contact,
    quotes: contact.quotes.map((q) => ({ ...q, totalPrice: q.totalPrice.toNumber() })),
    deliveryNotes: contact.deliveryNotes.map((dn) => ({ ...dn, quantity: dn.quantity.toNumber() })),
  } as unknown as typeof contact;

  return <ContactDetail contact={serializedContact} userNames={userNames} />;
}
