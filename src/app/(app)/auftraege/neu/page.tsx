import { getContacts } from "@/actions/contacts";
import { CreateOrderForm } from "@/components/orders/create-order-form";

export default async function NeuerAuftragPage() {
  const contacts = await getContacts();
  return <CreateOrderForm contacts={contacts} />;
}
