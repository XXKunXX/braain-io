"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContactCombobox } from "./contact-combobox";
import { createRequest } from "@/actions/requests";
import { toast } from "sonner";
import type { Contact } from "@prisma/client";

const statusOptions = [
  { value: "NEU", label: "Neu" },
  { value: "BESICHTIGUNG_GEPLANT", label: "Besichtigung geplant" },
  { value: "ANGEBOT_ERSTELLT", label: "Angebot erstellt" },
  { value: "IN_PROGRESS", label: "In Bearbeitung" },
  { value: "DONE", label: "Erledigt" },
];

const priorityOptions = [
  { value: "LOW", label: "Niedrig" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "Hoch" },
  { value: "URGENT", label: "Dringend" },
];

const statusColors: Record<string, string> = {
  NEU: "border border-blue-300 text-blue-700 bg-blue-50",
  BESICHTIGUNG_GEPLANT: "border border-amber-400 text-amber-700 bg-amber-50",
  ANGEBOT_ERSTELLT: "border border-amber-400 text-amber-700 bg-amber-50",
  IN_PROGRESS: "border border-purple-300 text-purple-700 bg-purple-50",
  DONE: "border border-green-300 text-green-700 bg-green-50",
};

interface NewRequestClientProps {
  contacts: Contact[];
  userNames: string[];
  preselectedContactId?: string;
}

export function NewRequestClient({ contacts, userNames, preselectedContactId }: NewRequestClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState(preselectedContactId ?? "");
  const [status, setStatus] = useState("NEU");
  const [priority, setPriority] = useState("NORMAL");
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [sitePhone, setSitePhone] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [noInspectionRequired, setNoInspectionRequired] = useState(false);

  // Auto-fill when contact is preselected on mount
  useEffect(() => {
    if (preselectedContactId) {
      applyContactData(preselectedContactId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedContactId]);

  const selectedContact = contacts.find((c) => c.id === contactId);

  function applyContactData(id: string) {
    const contact = contacts.find((c) => c.id === id);
    if (!contact) return;
    // Auto-fill address from contact
    const parts = [contact.address, contact.postalCode && contact.city ? `${contact.postalCode} ${contact.city}` : contact.city].filter(Boolean);
    if (parts.length > 0) setSiteAddress(parts.join(", "));
    // Auto-fill phone
    if (contact.phone) setSitePhone(contact.phone);
    // Auto-fill owner if contact has owner
    if ((contact as Contact & { owner?: string }).owner) setOwner((contact as Contact & { owner?: string }).owner!);
  }

  function handleContactChange(id: string) {
    setContactId(id);
    applyContactData(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId || !title) return;
    setLoading(true);
    const result = await createRequest({
      title,
      description,
      contactId,
      assignedTo: owner || undefined,
      status: status as "NEU",
      priority,
      siteAddress,
      sitePhone,
      inspectionDate: noInspectionRequired ? undefined : (inspectionDate || undefined),
      inspectionStatus: (!noInspectionRequired && inspectionDate) ? "PLANNED" : undefined,
      noInspectionRequired,
    });
    setLoading(false);
    if (result.error) {
      toast.error("Fehler beim Erstellen");
      return;
    }
    toast.success("Anfrage erstellt");
    router.push(`/anfragen/${result.request!.id}`);
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <Link href="/anfragen" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          Alle Anfragen
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{title || "Neue Anfrage"}</h1>
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[status]}`}>
            {statusOptions.find((s) => s.value === status)?.label}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
          {selectedContact && <span>{selectedContact.companyName}</span>}
          {owner && <span>{owner}</span>}
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="flex-1 p-6">
        <div className="grid grid-cols-[1fr_320px] gap-6 max-w-5xl">
          {/* Left column */}
          <div className="space-y-5">
            {/* Anfrageinformationen */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2 pb-1">
                <span className="text-gray-400">📋</span>
                <h2 className="text-sm font-semibold text-gray-900">Anfrageinformationen</h2>
              </div>

              {/* Titel */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Titel *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-lg border-gray-200" required />
              </div>

              {/* Kontakt + Owner */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakt *</Label>
                  <ContactCombobox
                    contacts={contacts}
                    value={contactId}
                    onChange={handleContactChange}
                  />
                  {/* Neuer Kontakt link */}
                  <Link
                    href="/kontakte/neu?returnTo=/anfragen/neu"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                  >
                    <Plus className="h-3 w-3" />
                    Neuer Kontakt anlegen
                  </Link>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Owner</Label>
                  <Select value={owner} onValueChange={(v) => setOwner(v == null || v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                      <SelectValue>{owner || <span className="text-gray-400">Kein Owner</span>}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kein Owner</SelectItem>
                      {userNames.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Kontakt-Info wenn ausgewählt */}
              {selectedContact && (selectedContact.phone || selectedContact.email || selectedContact.firstName || selectedContact.lastName) && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm space-y-1">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Kontaktdaten</p>
                  {(selectedContact.firstName || selectedContact.lastName) && (
                    <p className="text-gray-700"><span className="text-gray-400">Ansprechpartner:</span> {[selectedContact.firstName, selectedContact.lastName].filter(Boolean).join(" ")}</p>
                  )}
                  {selectedContact.phone && (
                    <p className="text-gray-700"><span className="text-gray-400">Telefon:</span> {selectedContact.phone}</p>
                  )}
                  {selectedContact.email && (
                    <p className="text-gray-700"><span className="text-gray-400">E-Mail:</span> {selectedContact.email}</p>
                  )}
                  {(selectedContact.address || selectedContact.postalCode || selectedContact.city) && (
                    <p className="text-gray-700"><span className="text-gray-400">Adresse:</span> {[selectedContact.address, [selectedContact.postalCode, selectedContact.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
                  )}
                </div>
              )}

              {/* Status + Priorität */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</Label>
                  <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                    <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                      <SelectValue>{statusOptions.find((s) => s.value === status)?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Priorität</Label>
                  <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
                    <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                      <SelectValue>{priorityOptions.find((p) => p.value === priority)?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Beschreibung */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Beschreibung</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="rounded-lg border-gray-200 resize-none"
                />
              </div>

              {/* Baustellenadresse + Telefon */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Baustellenadresse</Label>
                  <Input
                    value={siteAddress}
                    onChange={(e) => setSiteAddress(e.target.value)}
                    className="h-10 rounded-lg border-gray-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakttelefon</Label>
                  <Input
                    value={sitePhone}
                    onChange={(e) => setSitePhone(e.target.value)}
                    type="tel"
                    className="h-10 rounded-lg border-gray-200"
                  />
                </div>
              </div>

            </div>

            {/* Besichtigung */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">📅</span>
                  <h2 className="text-sm font-semibold text-gray-900">Besichtigung</h2>
                </div>
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setNoInspectionRequired(false)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      !noInspectionRequired
                        ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Termin festlegen
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoInspectionRequired(true)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      noInspectionRequired
                        ? "bg-red-50 text-red-700 shadow-sm border border-red-200"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Ban className="h-3 w-3" />
                    Keine Besichtigung
                  </button>
                </div>
              </div>
              {noInspectionRequired ? (
                <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
                  Es wird keine Besichtigungsaufgabe erstellt.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Besichtigungstermin</Label>
                    <Input
                      type="datetime-local"
                      value={inspectionDate}
                      onFocus={() => { if (!inspectionDate) { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); setInspectionDate(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T07:00`); }}}
                      onChange={(e) => setInspectionDate(e.target.value)}
                      className="h-10 rounded-lg border-gray-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Zugewiesen an</Label>
                    <Select value={owner} onValueChange={(v) => setOwner(v == null || v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                        <SelectValue>{owner || <span className="text-gray-400">Niemand</span>}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Niemand</SelectItem>
                        {userNames.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Link href="/anfragen">
                <Button type="button" variant="outline" className="rounded-lg">Abbrechen</Button>
              </Link>
              <LoadingButton
                onClick={handleSubmit as unknown as React.MouseEventHandler}
                loading={loading}
                disabled={!contactId || !title}
                className="rounded-lg"
              >
                Anfrage speichern
              </LoadingButton>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-400">📎</span>
                <h3 className="text-sm font-semibold text-gray-900">Anhänge</h3>
              </div>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <span className="text-3xl text-gray-200 mb-2">📎</span>
                <p className="text-sm text-gray-400">Keine Anhänge</p>
                <p className="text-xs text-gray-300 mt-0.5">Nach dem Speichern verfügbar</p>
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
