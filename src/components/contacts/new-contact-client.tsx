"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEscapeKey } from "@/hooks/use-escape-key";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ContactForm } from "@/components/contacts/contact-form";
import { createContact, type ContactFormData } from "@/actions/contacts";
import { toast } from "sonner";

export function NewContactClient({ userNames, returnTo }: { userNames: string[]; returnTo?: string }) {
  const router = useRouter();
  useEscapeKey(() => router.back(), true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(data: ContactFormData) {
    setLoading(true);
    const result = await createContact(data);
    setLoading(false);
    if (result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Kontakt erstellt");
    if (returnTo && result.contact?.id) {
      router.push(`${returnTo}?contactId=${result.contact.id}`);
    } else {
      router.push(`/kontakte/${result.contact?.id}`);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link href="/kontakte" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6">
        <ChevronLeft className="h-4 w-4" />
        Alle Kontakte
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Neuer Kontakt</h1>
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <ContactForm onSubmit={handleSubmit} onCancel={() => router.back()} isLoading={loading} userNames={userNames} />
      </div>
    </div>
  );
}
