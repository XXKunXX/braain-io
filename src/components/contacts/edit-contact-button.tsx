"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactForm } from "./contact-form";
import { updateContact, type ContactFormData } from "@/actions/contacts";
import { toast } from "sonner";
import type { BillingMode, Contact } from "@prisma/client";

type ContactWithBilling = Contact & { billingMode?: BillingMode; billingIntervalDays?: number | null };

export function EditContactButton({ contact, userNames = [] }: { contact: ContactWithBilling; userNames?: string[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(data: ContactFormData) {
    setLoading(true);
    const result = await updateContact(contact.id, data);
    setLoading(false);

    if (result.error) {
      toast.error("Fehler beim Speichern");
      return;
    }
    toast.success("Kontakt gespeichert");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 mr-1" />
        Bearbeiten
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Kontakt bearbeiten</DialogTitle>
          </DialogHeader>
          <ContactForm
            defaultValues={{
              ...contact,
              firstName: contact.firstName ?? undefined,
              lastName: contact.lastName ?? undefined,
              companyName: contact.companyName ?? undefined,
              email: contact.email ?? "",
              phone: contact.phone ?? "",
              address: contact.address ?? "",
              postalCode: contact.postalCode ?? "",
              city: contact.city ?? "",
              notes: contact.notes ?? "",
              owner: contact.owner ?? "",
              billingMode: contact.billingMode ?? "MANUELL",
              billingIntervalDays: contact.billingIntervalDays ?? null,
              paymentTermSkonto: (contact.paymentTermSkonto ?? []) as { days: number; percent: number }[],
            }}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            isLoading={loading}
            userNames={userNames}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
