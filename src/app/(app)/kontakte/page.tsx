import { getContacts } from "@/actions/contacts";
import { ContactList } from "@/components/contacts/contact-list";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function KontaktePage() {
  const contacts = await getContacts();

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Kontakte</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contacts.length} Kontakte</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <ContactList contacts={contacts} />
    </div>
  );
}
