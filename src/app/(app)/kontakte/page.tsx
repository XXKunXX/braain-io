import { getContacts } from "@/actions/contacts";
import { ContactList } from "@/components/contacts/contact-list";
import { CreateContactButton } from "@/components/contacts/create-contact-button";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function KontaktePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const contacts = await getContacts(params.q);

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Kontakte</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contacts.length} Kontakte</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <CreateContactButton />
        </div>
      </div>

      <ContactList contacts={contacts} search={params.q} />
    </div>
  );
}
