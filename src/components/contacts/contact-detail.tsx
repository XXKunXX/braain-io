"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTabLabels } from "@/hooks/use-tab-labels";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Building2, User, ChevronLeft, ChevronRight, Phone, Mail, MapPin,
  Plus, FileText, Package, Truck, Receipt, FolderOpen,
  MessageSquare, ExternalLink, StickyNote, Clock, Trash2, Paperclip, Upload, Activity,
  CalendarDays, Hand, HardHat, CheckSquare, Square, AlertCircle, Pencil,
} from "lucide-react";
import { ContactActivityTab } from "./contact-activity-tab";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Attachment, Contact, ContactNote, Quote, Order, DeliveryNote, Request } from "@prisma/client";
import { ContactForm } from "./contact-form";
import { createContactNote, deleteContactNote } from "@/actions/contact-notes";
import { deleteAttachment } from "@/actions/attachments";
import { createInvoiceFromDeliveryNotes, deleteInvoice } from "@/actions/invoices";
import { updateContact, updatePaymentTerm, type ContactFormData } from "@/actions/contacts";
import { parseSkontoFromJson, generatePaymentTermText } from "@/lib/payment-terms";
import { deleteRequest } from "@/actions/requests";
import { deleteQuote } from "@/actions/quotes";
import { deleteOrder } from "@/actions/orders";
import { deleteDeliveryNote } from "@/actions/delivery-notes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  COMPANY: "Firma",
  PRIVATE: "Privatkunde",
  SUPPLIER: "Lieferant",
};

const typeBadgeColors: Record<string, string> = {
  COMPANY: "bg-blue-100 text-blue-700",
  PRIVATE: "bg-purple-100 text-purple-700",
  SUPPLIER: "bg-orange-100 text-orange-700",
};

const requestStatusLabels: Record<string, string> = {
  NEU: "Neu",
  BESICHTIGUNG_GEPLANT: "Besichtigung geplant",
  BESICHTIGUNG_DURCHGEFUEHRT: "Besichtigung durchgeführt",
  ANGEBOT_ERSTELLT: "Angebot erstellt",
  DONE: "Erledigt",
};

const requestStatusColors: Record<string, string> = {
  NEU: "bg-blue-50 text-blue-700 border border-blue-200",
  BESICHTIGUNG_GEPLANT: "bg-amber-50 text-amber-700 border border-amber-200",
  BESICHTIGUNG_DURCHGEFUEHRT: "bg-teal-50 text-teal-700 border border-teal-200",
  ANGEBOT_ERSTELLT: "bg-purple-50 text-purple-700 border border-purple-200",
  DONE: "bg-green-50 text-green-700 border border-green-200",
};

const quoteStatusLabels: Record<string, string> = {
  DRAFT: "Entwurf", SENT: "Versendet", ACCEPTED: "Angenommen", REJECTED: "Abgelehnt",
};

const quoteStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
};

const orderStatusLabels: Record<string, string> = {
  OPEN: "Offen", DISPONIERT: "Disponiert", IN_LIEFERUNG: "In Lieferung", VERRECHNET: "Verrechnet", ABGESCHLOSSEN: "Abgeschlossen",
};

const orderStatusColors: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  DISPONIERT: "bg-green-50 text-green-700",
  IN_LIEFERUNG: "bg-amber-50 text-amber-700",
  VERRECHNET: "bg-orange-50 text-orange-700",
  ABGESCHLOSSEN: "bg-gray-100 text-gray-600",
};

type NoteWithRequest = ContactNote & { request: { id: string; title: string } | null };
type AttachmentWithRequest = Attachment & { request: { id: string; title: string } | null };
type DeliveryNoteWithInvoice = Omit<DeliveryNote, "quantity"> & {
  quantity: number;
  invoice: { id: string; invoiceNumber: string; status: string } | null;
};

type ContactInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  status: string;
  totalAmount: number | { toNumber: () => number };
};

type ContactWithRelations = Omit<Contact, "billingMode"> & {
  billingMode: "PRO_LIEFERSCHEIN" | "NACH_PROJEKTENDE" | "PERIODISCH" | "MANUELL";
  billingIntervalDays: number | null;
  paymentTermDays: number | null;
  paymentTermSkonto: unknown;
  paymentTermCustom: string | null;
  requests: Request[];
  quotes: Quote[];
  orders: Order[];
  deliveryNotes: DeliveryNoteWithInvoice[];
  invoices: ContactInvoice[];
  contactNotes: NoteWithRequest[];
  attachments: AttachmentWithRequest[];
};

const TABS = [
  { id: "anfragen", label: "Anfragen", icon: MessageSquare },
  { id: "angebote", label: "Angebote", icon: FileText },
  { id: "auftraege", label: "Aufträge", icon: Package },
  { id: "lieferscheine", label: "Lieferscheine", icon: Truck },
  { id: "rechnungen", label: "Rechnungen", icon: Receipt },
  { id: "dokumente", label: "Dokumente", icon: FolderOpen },
  { id: "notizen", label: "Notizen", icon: StickyNote },
  { id: "aktivitaet", label: "Aktivität", icon: Activity },
] as const;

type TabId = typeof TABS[number]["id"];

export function ContactDetail({ contact, userNames = [], currentUserName, activity = [] }: { contact: ContactWithRelations; userNames?: string[]; currentUserName?: string; activity?: import("@/actions/activity").ActivityEvent[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId | null) ?? "anfragen";
  const fromUrl = searchParams.get("from");
  const fromLabel = searchParams.get("fromLabel");
  const backLink = fromUrl ?? "/kontakte";
  const backLabel = fromUrl
    ? fromUrl.startsWith("/angebote") ? `Zum Angebot${fromLabel ? ` ${fromLabel}` : ""}`
    : fromUrl.startsWith("/anfragen") ? `Zur Anfrage${fromLabel ? ` · ${fromLabel}` : ""}`
    : fromUrl.startsWith("/auftraege") ? `Zum Auftrag${fromLabel ? ` · ${fromLabel}` : ""}`
    : "Zurück"
    : "Alle Kontakte";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const { containerRef: tabContainerRef, showLabels } = useTabLabels();
  const isCompany = contact.type !== "PRIVATE";
  const [notes, setNotes] = useState<NoteWithRequest[]>(contact.contactNotes);
  const [noteAdding, setNoteAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentWithRequest[]>(contact.attachments);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [dnFilter, setDnFilter] = useState<"all" | "open" | "billed">("all");
  const [confirmDeleteInvoiceId, setConfirmDeleteInvoiceId] = useState<string | null>(null);
  const [editingBilling, setEditingBilling] = useState(false);
  const [billingMode, setBillingMode] = useState(contact.billingMode);
  const [billingIntervalDays, setBillingIntervalDays] = useState(contact.billingIntervalDays);
  const [billingIntervalValue, setBillingIntervalValue] = useState(() => {
    const d = contact.billingIntervalDays;
    if (!d) return 1;
    if (d % 30 === 0) return d / 30;
    if (d % 7 === 0) return d / 7;
    return d;
  });
  const [billingIntervalUnit, setBillingIntervalUnit] = useState<"days" | "weeks" | "months">(() => {
    const d = contact.billingIntervalDays;
    if (!d) return "weeks";
    if (d % 30 === 0) return "months";
    if (d % 7 === 0) return "weeks";
    return "days";
  });
  const [savingBilling, setSavingBilling] = useState(false);
  const [ptDays, setPtDays] = useState<number | null>(contact.paymentTermDays ?? 14);

  async function handleSaveBilling() {
    setSavingBilling(true);
    await Promise.all([
      updateContact(contact.id, {
        type: contact.type as ContactFormData["type"],
        companyName: contact.companyName ?? "",
        billingMode: billingMode as ContactFormData["billingMode"],
        billingIntervalDays: billingMode === "PERIODISCH" ? billingIntervalDays : null,
      }),
      updatePaymentTerm(contact.id, {
        paymentTermDays: ptDays,
        paymentTermSkonto: parseSkontoFromJson(contact.paymentTermSkonto) as { days: number; percent: number }[],
        paymentTermCustom: contact.paymentTermCustom || null,
      }),
    ]);
    setSavingBilling(false);
    setEditingBilling(false);
    toast.success("Abrechnung gespeichert");
    router.refresh();
  }

  async function handleDeleteInvoice() {
    if (!confirmDeleteInvoiceId) return;
    await deleteInvoice(confirmDeleteInvoiceId);
    toast.success("Rechnung gelöscht — Lieferscheine wieder offen");
    router.refresh();
  }
  const [selectionMode, setSelectionMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "request" | "quote" | "order" | "deliveryNote"; id: string } | null>(null);

  // Quick-edit Kontaktdaten
  const [quickEditContact, setQuickEditContact] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [qPhone, setQPhone] = useState(contact.phone ?? "");
  const [qEmail, setQEmail] = useState(contact.email ?? "");
  const [qAddress, setQAddress] = useState(contact.address ?? "");
  const [qPostalCode, setQPostalCode] = useState(contact.postalCode ?? "");
  const [qCity, setQCity] = useState(contact.city ?? "");
  const [qCountry, setQCountry] = useState(contact.country ?? "Österreich");
  const [qOwner, setQOwner] = useState(contact.owner ?? "");

  function openQuickEdit() {
    setQPhone(contact.phone ?? "");
    setQEmail(contact.email ?? "");
    setQAddress(contact.address ?? "");
    setQPostalCode(contact.postalCode ?? "");
    setQCity(contact.city ?? "");
    setQCountry(contact.country ?? "Österreich");
    setQOwner(contact.owner ?? "");
    setQuickEditContact(true);
  }

  async function handleQuickSave() {
    setQuickSaving(true);
    await updateContact(contact.id, {
      type: contact.type as ContactFormData["type"],
      companyName: contact.companyName ?? "",
      firstName: contact.firstName ?? undefined,
      lastName: contact.lastName ?? undefined,
      phone: qPhone,
      email: qEmail,
      address: qAddress,
      postalCode: qPostalCode,
      city: qCity,
      country: qCountry,
      owner: qOwner,
      billingMode: contact.billingMode,
      billingIntervalDays: contact.billingIntervalDays,
    });
    setQuickSaving(false);
    setQuickEditContact(false);
    toast.success("Kontaktdaten gespeichert");
    router.refresh();
  }

  useEscapeKey(() => {
    if (deleteConfirm) { setDeleteConfirm(null); return; }
    if (quickEditContact) { setQuickEditContact(false); return; }
    if (isEditing) { setIsEditing(false); return; }
    if (editingBilling) { setEditingBilling(false); return; }
    if (selectionMode) { exitSelectionMode(); }
  }, !!(deleteConfirm || quickEditContact || isEditing || editingBilling || selectionMode));

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    setDeleteConfirm(null);
    if (type === "request") await deleteRequest(id);
    else if (type === "quote") await deleteQuote(id);
    else if (type === "order") await deleteOrder(id);
    else if (type === "deliveryNote") {
      const result = await deleteDeliveryNote(id);
      if (!result.success) {
        toast.error(result.error ?? "Lieferschein konnte nicht gelöscht werden.");
        return;
      }
    }
    toast.success("Gelöscht");
    router.refresh();
  }

  async function handleEditSubmit(data: ContactFormData) {
    setEditLoading(true);
    const result = await updateContact(contact.id, data);
    setEditLoading(false);
    if (result.error) { toast.error("Fehler beim Speichern"); return; }
    toast.success("Kontakt gespeichert");
    setIsEditing(false);
    router.refresh();
  }

  // Abrechnung state
  const openDeliveryNotes = contact.deliveryNotes.filter((dn) => !dn.invoice);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelectedIds(new Set(openDeliveryNotes.map((dn) => dn.id)));
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleCreateInvoice() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast.error("Keine Lieferscheine ausgewählt"); return; }
    setCreatingInvoice(true);
    const result = await createInvoiceFromDeliveryNotes(contact.id, ids);
    setCreatingInvoice(false);
    if ("invoice" in result && result.invoice) {
      toast.success("Sammelrechnung erstellt");
      const contactName = encodeURIComponent(contact.companyName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" "));
      router.push(`/rechnungen/${result.invoice.id}?contactId=${contact.id}&contactName=${contactName}`);
    } else {
      toast.error("Fehler beim Erstellen der Rechnung");
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    let successCount = 0;
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("contactId", contact.id);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (res.ok) {
            const { attachment } = await res.json();
            setAttachments((prev) => [attachment, ...prev]);
            successCount++;
          } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error ?? "Upload fehlgeschlagen");
          }
        } catch {
          toast.error(`Upload fehlgeschlagen: ${file.name}`);
        }
      }
    } finally {
      setUploading(false);
    }
    if (successCount > 0) toast.success("Datei(en) hochgeladen");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }

  async function handleDeleteAttachment(id: string) {
    await deleteAttachment(id, undefined, contact.id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    toast.success("Datei gelöscht");
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    const result = await createContactNote({ content: noteText, contactId: contact.id, createdBy: currentUserName });
    setNoteSaving(false);
    if (result.note) {
      setNotes((prev) => [{ ...result.note!, request: null }, ...prev]);
      setNoteText("");
      setNoteAdding(false);
      toast.success("Notiz gespeichert");
    }
  }

  async function handleDeleteNote(id: string) {
    await deleteContactNote(id, contact.id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notiz gelöscht");
  }

  const tabCounts: Partial<Record<TabId, number>> = {
    anfragen: contact.requests.length,
    angebote: contact.quotes.length,
    auftraege: contact.orders.length,
    lieferscheine: contact.deliveryNotes.length,
    rechnungen: contact.invoices.length,
    dokumente: attachments.length,
    notizen: notes.length,
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <Link href={backLink} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ChevronLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
              {isCompany ? <Building2 className="h-5 w-5 text-white" /> : <User className="h-5 w-5 text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-semibold text-gray-900">{contact.companyName}</h1>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${typeBadgeColors[contact.type]}`}>
                  {typeLabels[contact.type]}
                </span>
              </div>
              {(contact.firstName || contact.lastName) && (
                <p className="text-sm text-gray-500 mt-0.5">{[contact.firstName, contact.lastName].filter(Boolean).join(" ")}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <Link
              href={`/anfragen/neu?contactId=${contact.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />Neue Anfrage
            </Link>
          )}
        </div>
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <div className="flex-1 p-4 md:p-6">
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <ContactForm
                defaultValues={{
                  type: contact.type as ContactFormData["type"],
                  companyName: contact.companyName ?? undefined,
                  firstName: contact.firstName ?? undefined,
                  lastName: contact.lastName ?? undefined,
                  email: contact.email ?? "",
                  phone: contact.phone ?? "",
                  address: contact.address ?? "",
                  postalCode: contact.postalCode ?? "",
                  city: contact.city ?? "",
                  country: contact.country ?? "Österreich",
                  notes: contact.notes ?? "",
                  owner: contact.owner ?? "",
                  billingMode: contact.billingMode,
                  billingIntervalDays: contact.billingIntervalDays ?? null,
                  paymentTermDays: contact.paymentTermDays ?? 14,
                  paymentTermSkonto: contact.paymentTermSkonto as { days: number; percent: number }[] ?? [],
                  paymentTermCustom: contact.paymentTermCustom ?? "",
                }}
                onSubmit={handleEditSubmit}
                onCancel={() => setIsEditing(false)}
                isLoading={editLoading}
                userNames={userNames}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab bar + body (hidden when editing) */}
      {!isEditing && <>
      <div className="px-4 md:px-6 pt-4 pb-0">
        <div className="overflow-x-auto">
          <div ref={tabContainerRef} className="flex items-center gap-1 min-w-max md:min-w-0">
            {TABS.map((tab) => {
              const count = tabCounts[tab.id];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    isActive ? "bg-white border-gray-300 text-gray-900 shadow-sm" : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5 shrink-0" />
                  <span data-tab-label className={showLabels ? "inline" : "hidden"}>{tab.label}</span>
                  {count !== undefined && count > 0 && (
                    <span data-tab-label className={showLabels ? "inline text-xs text-gray-400" : "hidden"}>({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 md:gap-6 max-w-6xl">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Kontaktdaten</h2>
                {!quickEditContact && (
                  <button onClick={openQuickEdit} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5" title="Bearbeiten">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {!quickEditContact ? (
                /* ── View ── */
                <div className="px-5 py-4 space-y-4">
                  {contact.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Telefon</p>
                        <a href={`tel:${contact.phone}`} className="text-sm text-blue-600 hover:underline">{contact.phone}</a>
                      </div>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">E-Mail</p>
                        <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline truncate block">{contact.email}</a>
                      </div>
                    </div>
                  )}
                  {(contact.address || contact.postalCode || contact.city) && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Adresse</p>
                        {contact.address && <p className="text-sm text-gray-900">{contact.address}</p>}
                        {(contact.postalCode || contact.city) && (
                          <p className="text-sm text-gray-900">{[contact.postalCode, contact.city].filter(Boolean).join(" ")}</p>
                        )}
                        {contact.country && <p className="text-xs text-gray-400 mt-0.5">{contact.country}</p>}
                      </div>
                    </div>
                  )}
                  {contact.owner && (
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Owner</p>
                        <p className="text-sm text-gray-900">{contact.owner}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Quick Edit ── */
                <div className="px-5 py-4 space-y-3">
                  {/* Telefon */}
                  <div>
                    <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Telefon</label>
                    <input value={qPhone} onChange={(e) => setQPhone(e.target.value)}
                      className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-blue-400 bg-white"
                      placeholder="+43 ..." />
                  </div>
                  {/* E-Mail */}
                  <div>
                    <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">E-Mail</label>
                    <input value={qEmail} onChange={(e) => setQEmail(e.target.value)} type="email"
                      className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-blue-400 bg-white"
                      placeholder="mail@example.com" />
                  </div>
                  {/* Straße */}
                  <div>
                    <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Straße</label>
                    <input value={qAddress} onChange={(e) => setQAddress(e.target.value)}
                      className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-blue-400 bg-white"
                      placeholder="Straße und Hausnummer" />
                  </div>
                  {/* PLZ + Stadt */}
                  <div className="grid grid-cols-[80px_1fr] gap-2">
                    <div>
                      <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">PLZ</label>
                      <input value={qPostalCode} onChange={(e) => setQPostalCode(e.target.value)}
                        className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-blue-400 bg-white"
                        placeholder="1010" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Stadt</label>
                      <input value={qCity} onChange={(e) => setQCity(e.target.value)}
                        className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-blue-400 bg-white"
                        placeholder="Wien" />
                    </div>
                  </div>
                  {/* Owner */}
                  <div>
                    <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Owner</label>
                    <select value={qOwner} onChange={(e) => setQOwner(e.target.value)}
                      className="w-full h-9 text-sm border border-gray-200 rounded-lg px-3 focus:outline-none focus:border-blue-400 bg-white">
                      <option value="">–</option>
                      {userNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1 border-t border-gray-100">
                    <Button size="sm" onClick={handleQuickSave} disabled={quickSaving} className="flex-1 h-8 text-xs rounded-lg bg-blue-600 hover:bg-blue-700">
                      {quickSaving ? "Speichert…" : "Speichern"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setQuickEditContact(false)} className="h-8 text-xs rounded-lg px-3">
                      Abbrechen
                    </Button>
                  </div>

                  {/* Full form link */}
                  <button
                    onClick={() => { setQuickEditContact(false); setIsEditing(true); }}
                    className="w-full text-center text-xs text-gray-400 hover:text-blue-600 transition-colors pt-1"
                  >
                    Alle Felder bearbeiten →
                  </button>
                </div>
              )}
            </div>

            {(() => {
                const mode = billingModeLabels[billingMode] ?? billingModeLabels.MANUELL;
                const ModeIcon = mode.icon;
                const openCount = contact.deliveryNotes.filter((dn) => !dn.invoice).length;
                const totalCount = contact.deliveryNotes.length;
                const billedCount = totalCount - openCount;
                const savedSkonto = parseSkontoFromJson(contact.paymentTermSkonto) as { days: number; percent: number }[];
                const paymentText = generatePaymentTermText({
                  paymentTermDays: contact.paymentTermDays ?? null,
                  paymentTermSkonto: savedSkonto,
                  paymentTermCustom: contact.paymentTermCustom,
                });
                const DAY_PRESETS = [
                  { label: "Sofort fällig", days: null as number | null },
                  { label: "14 Tage", days: 14 },
                  { label: "30 Tage", days: 30 },
                  { label: "60 Tage", days: 60 },
                ];
                return (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Abrechnung</h2>
                      {!editingBilling && (
                        <button onClick={() => setEditingBilling(true)} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5" title="Bearbeiten">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {!editingBilling ? (
                      <>
                        {/* Row 1: clickable counters */}
                        <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
                          <button
                            className="px-4 py-4 text-center hover:bg-gray-50 transition-colors"
                            onClick={() => { setActiveTab("lieferscheine"); setDnFilter("open"); setSelectionMode(false); }}
                          >
                            <p className={`text-2xl font-bold tabular-nums ${openCount > 0 ? "text-orange-500" : "text-gray-200"}`}>{openCount}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-wide">Offen</p>
                          </button>
                          <button
                            className="px-4 py-4 text-center hover:bg-gray-50 transition-colors"
                            onClick={() => { setActiveTab("lieferscheine"); setDnFilter("billed"); setSelectionMode(false); }}
                          >
                            <p className={`text-2xl font-bold tabular-nums ${billedCount > 0 ? "text-green-500" : "text-gray-200"}`}>{billedCount}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-wide">Verrechnet</p>
                          </button>
                        </div>
                        {/* Row 2: config info only */}
                        <div className="grid grid-cols-2 divide-x divide-gray-100 bg-gray-50/60">
                          <div className="px-4 py-2.5 flex items-center justify-center gap-1.5">
                            <ModeIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="text-xs font-medium text-gray-600">
                              {mode.label}
                              {billingMode === "PERIODISCH" && billingIntervalDays && (
                                <span className="font-normal text-gray-400"> · {formatIntervalDays(billingIntervalDays)}</span>
                              )}
                            </span>
                          </div>
                          <div className="px-4 py-2.5 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">
                              {contact.paymentTermDays === null ? "Sofort fällig" : `${contact.paymentTermDays} Tage`}
                              {savedSkonto.map((s, i) => (
                                <span key={i} className="font-normal text-gray-400"> · {s.percent}%</span>
                              ))}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="px-5 py-4 space-y-5">
                        {/* Section 1: Abrechnungsmodus */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Abrechnungsmodus</p>
                          <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
                            {Object.entries(billingModeLabels).map(([value, info]) => {
                              const Icon = info.icon;
                              const selected = billingMode === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setBillingMode(value as typeof billingMode)}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${selected ? "bg-blue-50" : "bg-white hover:bg-gray-50"}`}
                                >
                                  <Icon className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-blue-500" : "text-gray-400"}`} />
                                  <span className={`flex-1 text-xs font-medium ${selected ? "text-blue-700" : "text-gray-700"}`}>{info.label}</span>
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-blue-500" : "border-gray-300"}`}>
                                    {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {billingMode === "PERIODISCH" && (
                            <div className="flex items-center gap-2 mt-2 px-0.5">
                              <span className="text-xs text-gray-500 shrink-0">Alle</span>
                              <input
                                type="number" min={1} value={billingIntervalValue}
                                onChange={(e) => {
                                  const v = Math.max(1, parseInt(e.target.value) || 1);
                                  setBillingIntervalValue(v);
                                  const d = billingIntervalUnit === "days" ? v : billingIntervalUnit === "weeks" ? v * 7 : v * 30;
                                  setBillingIntervalDays(d);
                                }}
                                className="w-14 h-8 text-xs text-center border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
                              />
                              <select
                                value={billingIntervalUnit}
                                onChange={(e) => {
                                  const u = e.target.value as "days" | "weeks" | "months";
                                  setBillingIntervalUnit(u);
                                  const d = u === "days" ? billingIntervalValue : u === "weeks" ? billingIntervalValue * 7 : billingIntervalValue * 30;
                                  setBillingIntervalDays(d);
                                }}
                                className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-600 focus:outline-none focus:border-blue-400"
                              >
                                <option value="days">Tage</option>
                                <option value="weeks">Wochen</option>
                                <option value="months">Monate</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-100" />

                        {/* Section 2: Zahlungsziel */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Zahlungsziel</p>
                          <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
                            {DAY_PRESETS.map((preset) => {
                              const selected = ptDays === preset.days;
                              return (
                                <button
                                  key={String(preset.days)}
                                  type="button"
                                  onClick={() => setPtDays(preset.days)}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${selected ? "bg-blue-50" : "bg-white hover:bg-gray-50"}`}
                                >
                                  <span className={`text-xs font-medium ${selected ? "text-blue-700" : "text-gray-700"}`}>{preset.label}</span>
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-blue-500" : "border-gray-300"}`}>
                                    {selected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {savedSkonto.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 px-0.5">
                              {savedSkonto.map((s, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-xs font-medium text-blue-700">
                                  {s.percent}% bei {s.days}T
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => { setEditingBilling(false); setBillingMode(contact.billingMode); setBillingIntervalDays(contact.billingIntervalDays); setIsEditing(true); }}
                            className="mt-2 text-[11px] text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            + Skonto &amp; weitere Optionen
                          </button>
                        </div>

                        {/* Save / Cancel */}
                        <div className="flex gap-2 pt-1 border-t border-gray-100">
                          <Button size="sm" className="flex-1 h-8 text-xs rounded-lg bg-blue-600 hover:bg-blue-700" onClick={handleSaveBilling} disabled={savingBilling}>
                            {savingBilling ? "Speichert…" : "Speichern"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg px-3" onClick={() => {
                            setBillingMode(contact.billingMode);
                            setBillingIntervalDays(contact.billingIntervalDays);
                            setPtDays(contact.paymentTermDays ?? 14);
                            setEditingBilling(false);
                          }}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            <p className="text-xs text-gray-300 flex items-center gap-1 px-1">
              <Clock className="h-3 w-3" />
              Erstellt {format(new Date(contact.createdAt), "dd. MMMM yyyy", { locale: de })}
            </p>
          </div>

          <ConfirmDialog
            open={!!confirmDeleteInvoiceId}
            onOpenChange={(open) => { if (!open) setConfirmDeleteInvoiceId(null); }}
            title="Rechnung löschen"
            description="Die Rechnung wird unwiderruflich gelöscht. Alle verknüpften Lieferscheine werden wieder auf offen gesetzt."
            onConfirm={handleDeleteInvoice}
          />

          {/* Tab content */}
          <div className="min-w-0">

            {/* Anfragen */}
            {activeTab === "anfragen" && (
              <TabContent empty={contact.requests.length === 0} emptyText="Noch keine Anfragen vorhanden"
                action={<Link href={`/anfragen/neu?contactId=${contact.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"><Plus className="h-3.5 w-3.5" />Neue Anfrage</Link>}
              >
                <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                  <div className="grid grid-cols-[1fr_180px_120px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                    <ColHead>Titel</ColHead><ColHead>Status</ColHead><ColHead>Erstellt</ColHead><span />
                  </div>
                  {contact.requests.map((req, i) => (
                    <Link key={req.id} href={`/anfragen/${req.id}`} className={`grid grid-cols-[1fr_180px_120px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i < contact.requests.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="text-sm font-medium text-gray-900 truncate pr-3">{req.title}</span>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full w-fit ${requestStatusColors[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {requestStatusLabels[req.status] ?? req.status}
                      </span>
                      <span className="text-sm text-gray-400">{format(new Date(req.createdAt), "dd.MM.yyyy", { locale: de })}</span>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm({ type: "request", id: req.id }); }} className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </TabContent>
            )}

            {/* Angebote */}
            {activeTab === "angebote" && (
              <TabContent empty={contact.quotes.length === 0} emptyText="Noch keine Angebote vorhanden"
                action={<Link href={`/angebote/neu?contactId=${contact.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"><Plus className="h-3.5 w-3.5" />Neues Angebot</Link>}
              >
                <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                  <div className="grid grid-cols-[80px_1fr_130px_90px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                    <ColHead>Nr.</ColHead><ColHead>Titel</ColHead><ColHead>Betrag</ColHead><ColHead>Status</ColHead><span />
                  </div>
                  {contact.quotes.map((q, i) => (
                    <Link key={q.id} href={`/angebote/${q.id}`} className={`grid grid-cols-[80px_1fr_130px_90px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i < contact.quotes.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="font-mono text-xs text-gray-400">{q.quoteNumber}</span>
                      <span className="text-sm font-medium text-gray-900 truncate pr-3">{q.title}</span>
                      <span className="text-sm font-mono text-gray-700">{Number(q.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${quoteStatusColors[q.status]}`}>{quoteStatusLabels[q.status]}</span>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm({ type: "quote", id: q.id }); }} className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </TabContent>
            )}

            {/* Aufträge */}
            {activeTab === "auftraege" && (
              <TabContent empty={contact.orders.length === 0} emptyText="Noch keine Aufträge vorhanden">
                <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                  <div className="grid grid-cols-[80px_1fr_160px_90px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                    <ColHead>Nr.</ColHead><ColHead>Titel</ColHead><ColHead>Zeitraum</ColHead><ColHead>Status</ColHead><span />
                  </div>
                  {contact.orders.map((o, i) => (
                    <Link key={o.id} href={`/auftraege/${o.id}`} className={`grid grid-cols-[80px_1fr_160px_90px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i < contact.orders.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="font-mono text-xs text-gray-400">{o.orderNumber}</span>
                      <span className="text-sm font-medium text-gray-900 truncate pr-3">{o.title}</span>
                      <span className="text-xs text-gray-400">{format(new Date(o.startDate), "dd.MM.yy", { locale: de })} – {format(new Date(o.endDate), "dd.MM.yy", { locale: de })}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${orderStatusColors[o.status]}`}>{orderStatusLabels[o.status]}</span>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm({ type: "order", id: o.id }); }} className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </TabContent>
            )}

            {/* Lieferscheine */}
            {activeTab === "lieferscheine" && (() => {
              const openNotes = contact.deliveryNotes.filter((dn) => !dn.invoice);
              const billedNotes = contact.deliveryNotes.filter((dn) => dn.invoice);
              const filtered = dnFilter === "open" ? openNotes : dnFilter === "billed" ? billedNotes : contact.deliveryNotes;
              const modeInfo = billingModeLabels[contact.billingMode] ?? billingModeLabels.MANUELL;
              const ModeIcon = modeInfo.icon;

              // Gruppen für PERIODISCH
              type Group = { label: string; notes: DeliveryNoteWithInvoice[] };
              let groups: Group[] = [];
              if (contact.billingMode === "PERIODISCH" && contact.billingIntervalDays && openNotes.length > 0) {
                const map = new Map<string, DeliveryNoteWithInvoice[]>();
                for (const dn of openNotes) {
                  const key = getPeriodLabel(new Date(dn.date), contact.billingIntervalDays!);
                  if (!map.has(key)) map.set(key, []);
                  map.get(key)!.push(dn);
                }
                groups = Array.from(map.entries()).map(([label, notes]) => ({ label, notes }));
              } else if (openNotes.length > 0) {
                groups = [{ label: "", notes: openNotes }];
              }

              return (
                <div className="space-y-3">

                  {/* ── SELECTION MODE ── */}
                  {selectionMode ? (
                    <>
                      {/* Action-Bar */}
                      <div className="flex items-center gap-3 bg-white border border-blue-200 rounded-xl px-4 py-3 shadow-sm">
                        <button onClick={exitSelectionMode} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0">
                          <ChevronLeft className="h-4 w-4" />
                          Abbrechen
                        </button>
                        <div className="flex-1 text-center">
                          <span className="text-sm font-medium text-gray-700">
                            {selectedIds.size === 0
                              ? "Keine Lieferscheine ausgewählt"
                              : `${selectedIds.size} von ${openNotes.length} ausgewählt`}
                          </span>
                        </div>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 flex-shrink-0"
                          onClick={handleCreateInvoice} disabled={creatingInvoice || selectedIds.size === 0}>
                          <Receipt className="h-3.5 w-3.5" />
                          {creatingInvoice ? "Wird erstellt…" : `Rechnung erstellen (${selectedIds.size})`}
                        </Button>
                      </div>

                      {/* Checkbox-Liste */}
                      {openNotes.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-2 text-center">
                          <Truck className="h-8 w-8 text-gray-200" />
                          <p className="text-sm text-gray-400">Keine offenen Lieferscheine</p>
                        </div>
                      ) : (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                          {groups.map((group) => {
                            const groupIds = group.notes.map((n) => n.id);
                            const allGroupSelected = groupIds.every((id) => selectedIds.has(id));
                            return (
                              <div key={group.label}>
                                {group.label && (
                                  <div className="flex items-center justify-between px-5 py-2 bg-gray-50/80 border-b border-gray-100">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.label}</span>
                                    <button onClick={() => toggleAll(groupIds)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                                      {allGroupSelected ? "Alle abwählen" : "Alle auswählen"}
                                    </button>
                                  </div>
                                )}
                                <div className="divide-y divide-gray-100">
                                  {group.notes.map((dn) => {
                                    const isSelected = selectedIds.has(dn.id);
                                    return (
                                      <div key={dn.id}
                                        className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-gray-50"}`}
                                        onClick={() => toggleSelect(dn.id)}>
                                        <div className="flex-shrink-0">
                                          {isSelected
                                            ? <CheckSquare className="h-4 w-4 text-blue-500" />
                                            : <Square className="h-4 w-4 text-gray-300" />}
                                        </div>
                                        <div className="flex-1 min-w-0 grid grid-cols-[80px_1fr_100px_90px] gap-3 items-center">
                                          <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                                          <span className="text-sm text-gray-700 truncate">{dn.material}</span>
                                          <span className="text-xs text-gray-400">{format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}</span>
                                          <span className="text-sm font-semibold text-gray-900 text-right tabular-nums">{dn.quantity.toLocaleString("de-DE")} {dn.unit}</span>
                                        </div>
                                        <Link href={`/lieferscheine/${dn.id}?contactId=${contact.id}`}
                                          onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                                          <ChevronRight className="h-4 w-4 text-gray-200" />
                                        </Link>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {!groups[0]?.label && (
                            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/30">
                              <button onClick={() => toggleAll(openNotes.map((dn) => dn.id))} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                                {openNotes.every((dn) => selectedIds.has(dn.id)) ? "Alle abwählen" : "Alle auswählen"}
                              </button>
                              <span className="text-xs text-gray-400">{selectedIds.size} von {openNotes.length} ausgewählt</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* ── BROWSE MODE ── */}
                      {/* Billing mode badge + Filter + Rechnung-Button */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border ${modeInfo.color}`}>
                          <ModeIcon className="h-3 w-3 flex-shrink-0" />
                          {modeInfo.label}
                          {contact.billingMode === "PERIODISCH" && contact.billingIntervalDays && (
                            <span className="opacity-60">· {formatIntervalDays(contact.billingIntervalDays)}</span>
                          )}
                        </div>
                        <div className="flex-1" />
                        {(["all", "open", "billed"] as const).map((f) => {
                          const labels = { all: `Alle (${contact.deliveryNotes.length})`, open: `Offen (${openNotes.length})`, billed: `Verrechnet (${billedNotes.length})` };
                          return (
                            <button key={f} onClick={() => setDnFilter(f)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${dnFilter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                              {labels[f]}
                            </button>
                          );
                        })}
                        {openNotes.length > 0 && (
                          <button onClick={enterSelectionMode}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
                            <Receipt className="h-3.5 w-3.5" />
                            Rechnung erstellen
                          </button>
                        )}
                      </div>

                      {/* Grid-Liste */}
                      <TabContent empty={filtered.length === 0} emptyText="Keine Lieferscheine in dieser Ansicht">
                        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                          <div className="grid grid-cols-[80px_1fr_110px_100px_90px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                            <ColHead>Nr.</ColHead><ColHead>Material</ColHead><ColHead>Datum</ColHead><ColHead>Menge</ColHead><ColHead>Status</ColHead><span />
                          </div>
                          {filtered.map((dn, i) => (
                            <Link key={dn.id} href={`/lieferscheine/${dn.id}?contactId=${contact.id}`}
                              className={`grid grid-cols-[80px_1fr_110px_100px_90px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i < filtered.length - 1 ? "border-b border-gray-100" : ""}`}>
                              <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                              <span className="text-sm font-medium text-gray-900 truncate pr-3">{dn.material}</span>
                              <span className="text-sm text-gray-400">{format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}</span>
                              <span className="text-sm text-gray-500 font-mono">{Number(dn.quantity).toLocaleString("de-DE")} {dn.unit}</span>
                              {dn.invoice
                                ? <span className="text-xs font-medium text-green-600 truncate">{dn.invoice.invoiceNumber}</span>
                                : <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full w-fit">Offen</span>
                              }
                              <div className="flex items-center justify-end gap-1">
                                {(() => {
                                  const blocked = dn.invoice?.status === "VERSENDET" || dn.invoice?.status === "BEZAHLT";
                                  return (
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!blocked) setDeleteConfirm({ type: "deliveryNote", id: dn.id }); }}
                                      className={`transition-colors p-0.5 ${blocked ? "text-gray-200 cursor-not-allowed" : "text-gray-300 hover:text-red-400"}`}
                                      title={blocked ? "Rechnung bereits versendet oder bezahlt" : "Löschen"}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  );
                                })()}
                                <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      </TabContent>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Rechnungen */}
            {activeTab === "rechnungen" && (
              <TabContent empty={contact.invoices.length === 0} emptyText="Noch keine Rechnungen vorhanden">
                <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                  <div className="grid grid-cols-[100px_120px_1fr_100px_56px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                    <ColHead>Nr.</ColHead><ColHead>Datum</ColHead><ColHead>Betrag</ColHead><ColHead>Status</ColHead><span />
                  </div>
                  {contact.invoices.map((inv, i) => {
                    const amount = typeof inv.totalAmount === "object" ? inv.totalAmount.toNumber() : inv.totalAmount;
                    const statusColors: Record<string, string> = {
                      ENTWURF: "bg-gray-100 text-gray-600",
                      VERSENDET: "bg-blue-50 text-blue-700",
                      BEZAHLT: "bg-green-50 text-green-700",
                      STORNIERT: "bg-red-50 text-red-600",
                    };
                    const statusLabels: Record<string, string> = {
                      ENTWURF: "Entwurf", VERSENDET: "Versendet", BEZAHLT: "Bezahlt", STORNIERT: "Storniert",
                    };
                    const href = `/rechnungen/${inv.id}?contactId=${contact.id}&contactName=${encodeURIComponent(contact.companyName ?? [contact.firstName, contact.lastName].filter(Boolean).join(" "))}`;
                    return (
                      <Link key={inv.id} href={href} className={`grid grid-cols-[100px_120px_1fr_100px_56px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors group ${i < contact.invoices.length - 1 ? "border-b border-gray-100" : ""}`}>
                        <span className="font-mono text-xs text-gray-400">{inv.invoiceNumber}</span>
                        <span className="text-sm text-gray-400">{format(new Date(inv.invoiceDate), "dd.MM.yyyy", { locale: de })}</span>
                        <span className="text-sm font-medium text-gray-900">{amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${statusColors[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {statusLabels[inv.status] ?? inv.status}
                        </span>
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === "ENTWURF" ? (
                            <button
                              onClick={(e) => { e.preventDefault(); setConfirmDeleteInvoiceId(inv.id); }}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                              title="Rechnung löschen"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="p-1 cursor-not-allowed" title="Nur Entwürfe können gelöscht werden">
                              <Trash2 className="h-3.5 w-3.5 text-gray-200" />
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </TabContent>
            )}

            {activeTab === "dokumente" && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                      <FolderOpen className="h-4 w-4 text-gray-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Dokumente</h3>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />Hochladen
                    <input type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
                  </label>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`transition-colors ${isDragging ? "bg-blue-50" : ""}`}
                >
                  {attachments.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center py-10 text-center px-4 border-2 border-dashed mx-4 my-4 rounded-xl transition-colors ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                      {uploading ? (
                        <div className="flex items-center gap-2 text-blue-600">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm">Wird hochgeladen…</span>
                        </div>
                      ) : (
                        <>
                          <FolderOpen className="h-8 w-8 text-gray-200 mb-2" />
                          <p className="text-sm text-gray-400">Dateien hier ablegen oder</p>
                          <label className="mt-1 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                            Datei auswählen
                            <input type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
                          </label>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {uploading && (
                        <div className="px-5 py-3 flex items-center gap-2 text-blue-600 text-sm">
                          <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          Wird hochgeladen…
                        </div>
                      )}
                      {attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-3 px-5 py-3.5 group hover:bg-gray-50 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-base">
                            <ContactFileIcon mimeType={att.mimeType} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <a href={att.url} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors truncate block">
                              {att.fileName}
                            </a>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{formatFileSize(att.fileSize)}</span>
                              {att.request && (
                                <Link href={`/anfragen/${att.request.id}`} className="text-xs text-blue-500 hover:underline truncate max-w-[200px]">
                                  {att.request.title}
                                </Link>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{format(new Date(att.createdAt), "dd.MM.yyyy", { locale: de })}</span>
                            <button onClick={() => handleDeleteAttachment(att.id)} className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <label className={`flex items-center justify-center gap-2 px-4 py-3 cursor-pointer transition-colors ${isDragging ? "bg-blue-50 text-blue-600" : "text-gray-300 hover:text-gray-400 hover:bg-gray-50"}`}>
                        <Upload className="h-3.5 w-3.5" />
                        <span className="text-xs">Weitere Dateien hinzufügen</span>
                        <input type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "notizen" && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                      <StickyNote className="h-4 w-4 text-gray-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Notizen</h3>
                  </div>
                  {!noteAdding && (
                    <button
                      onClick={() => setNoteAdding(true)}
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />Notiz
                    </button>
                  )}
                </div>

                {noteAdding && (
                  <div className="px-5 py-4 border-b border-gray-100 space-y-3">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Notiz eingeben…"
                      rows={6}
                      className="rounded-lg border-gray-200 resize-none text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-lg"
                        onClick={handleSaveNote}
                        disabled={noteSaving || !noteText.trim()}
                      >
                        {noteSaving ? "Speichert..." : "Speichern"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => { setNoteAdding(false); setNoteText(""); }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )}

                {notes.length === 0 && !noteAdding ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-2">
                    <StickyNote className="h-8 w-8 text-gray-200" />
                    <p className="text-sm text-gray-400">Noch keine Notizen vorhanden</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notes.map((note) => (
                      <div key={note.id} className="px-5 py-4 group">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap flex-1">{note.content}</p>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors p-0.5 flex-shrink-0 mt-0.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {note.createdBy && (
                            <span className="text-xs font-medium text-gray-500">{note.createdBy}</span>
                          )}
                          <p className="text-xs text-gray-400">
                            {format(new Date(note.createdAt), "dd. MMMM yyyy, HH:mm", { locale: de })} Uhr
                          </p>
                          {note.request && (
                            <Link href={`/anfragen/${note.request.id}`} className="text-xs text-blue-500 hover:underline truncate max-w-[200px]">
                              {note.request.title}
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "aktivitaet" && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-gray-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Aktivitätshistorie</h3>
                  <span className="ml-auto text-xs text-gray-400">{activity.length} Einträge</span>
                </div>
                <div className="px-5 py-5">
                  <ContactActivityTab events={activity} />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      </>}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Eintrag löschen"
        description="Dieser Eintrag wird unwiderruflich gelöscht."
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

const billingModeLabels: Record<string, { label: string; description: string; icon: React.ElementType; color: string }> = {
  PRO_LIEFERSCHEIN: { label: "Pro Lieferschein", description: "Jeder LS wird sofort als Rechnungs-Entwurf erstellt", icon: FileText, color: "text-blue-600 bg-blue-50 border-blue-200" },
  NACH_PROJEKTENDE: { label: "Nach Projektende", description: "Alle LS werden beim Auftragsabschluss gebündelt", icon: HardHat, color: "text-amber-600 bg-amber-50 border-amber-200" },
  PERIODISCH: { label: "Periodisch", description: "Alle LS werden nach einem Zeitraum gebündelt", icon: CalendarDays, color: "text-purple-600 bg-purple-50 border-purple-200" },
  MANUELL: { label: "Manuell", description: "Abrechnung wird manuell angestoßen", icon: Hand, color: "text-gray-600 bg-gray-50 border-gray-200" },
};

function formatIntervalDays(days: number | null): string {
  if (!days) return "";
  if (days % 30 === 0) return `alle ${days / 30} Monat${days / 30 !== 1 ? "e" : ""}`;
  if (days % 7 === 0) return `alle ${days / 7} Woche${days / 7 !== 1 ? "n" : ""}`;
  return `alle ${days} Tage`;
}

function getPeriodLabel(date: Date, intervalDays: number): string {
  const epoch = new Date(0);
  const diffDays = Math.floor((date.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
  const periodIndex = Math.floor(diffDays / intervalDays);
  const periodStart = new Date(epoch.getTime() + periodIndex * intervalDays * 24 * 60 * 60 * 1000);
  const periodEnd = new Date(periodStart.getTime() + intervalDays * 24 * 60 * 60 * 1000 - 1);
  if (intervalDays % 30 === 0) {
    return format(periodStart, "MMMM yyyy", { locale: de });
  }
  if (intervalDays % 7 === 0) {
    return `${format(periodStart, "dd.MM.")} – ${format(periodEnd, "dd.MM.yyyy")}`;
  }
  return `${format(periodStart, "dd.MM.")} – ${format(periodEnd, "dd.MM.yyyy")}`;
}

function ColHead({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{children}</span>;
}

function TabContent({ empty, emptyText, action, children }: {
  empty: boolean; emptyText: string; action?: React.ReactNode; children?: React.ReactNode;
}) {
  if (empty) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-gray-400">{emptyText}</p>
        {action}
      </div>
    );
  }
  return <>{children}</>;
}

function EmptyTab({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-14 flex flex-col items-center gap-3 text-center">
      {icon}
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ContactFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <span>🖼️</span>;
  if (mimeType === "application/pdf") return <span>📄</span>;
  if (mimeType.includes("word") || mimeType.includes("document")) return <span>📝</span>;
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return <span>📊</span>;
  return <Paperclip className="h-4 w-4 text-gray-400" />;
}
