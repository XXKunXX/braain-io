"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrder } from "@/actions/orders";
import { toast } from "sonner";
import type { Contact } from "@prisma/client";

function todayAt7() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T07:00`;
}

export function CreateOrderForm({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contactId) { toast.error("Bitte Kontakt auswählen"); return; }
    const form = new FormData(e.currentTarget);
    setLoading(true);

    const result = await createOrder({
      title: form.get("title") as string,
      contactId,
      startDate: form.get("startDate") as string,
      endDate: form.get("endDate") as string,
      notes: form.get("notes") as string,
    });

    setLoading(false);
    if (result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Auftrag erstellt");
    router.push(`/auftraege/${result.order?.id}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link
        href="/auftraege"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zu Aufträge
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Neuer Auftrag</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Allgemeine Angaben */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Allgemeine Angaben</h3>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Titel *</Label>
            <Input
              name="title"
              placeholder="z.B. Poolaushub Familie Muster"
              required
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Kontakt *</Label>
              <Select value={contactId} onValueChange={(v) => v && setContactId(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Kontakt wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Zeitraum */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Zeitraum</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Startdatum *</Label>
              <Input name="startDate" type="datetime-local" required className="h-10" defaultValue={todayAt7()} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Enddatum *</Label>
              <Input name="endDate" type="datetime-local" required className="h-10" defaultValue={todayAt7()} />
            </div>
          </div>
        </div>

        {/* Notizen */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Notizen</h3>
          <Textarea
            name="notes"
            placeholder="Optionale Anmerkungen zum Auftrag..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={loading || !contactId}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-36"
          >
            {loading ? "Wird erstellt..." : "Auftrag erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
