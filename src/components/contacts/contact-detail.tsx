"use client";

import Link from "next/link";
import { useState } from "react";
import { useTabLabels } from "@/hooks/use-tab-labels";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Building2, User, ChevronLeft, Phone, Mail, MapPin,
  Plus, FileText, Package, Truck, Receipt, FolderOpen,
  MessageSquare, ExternalLink, StickyNote, Clock, Trash2, Paperclip, Upload, Activity,
} from "lucide-react";
import { ContactActivityTab } from "./contact-activity-tab";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Attachment, Contact, ContactNote, Quote, Order, DeliveryNote, Request } from "@prisma/client";
import { EditContactButton } from "./edit-contact-button";
import { createContactNote, deleteContactNote } from "@/actions/contact-notes";
import { deleteAttachment } from "@/actions/attachments";
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
  NEU: "Neu", OPEN: "Offen",
  BESICHTIGUNG_GEPLANT: "Besichtigung geplant",
  BESICHTIGUNG_DURCHGEFUEHRT: "Besichtigung durchgeführt",
  ANGEBOT_ERSTELLT: "Angebot erstellt",
  IN_PROGRESS: "In Bearbeitung",
  DONE: "Erledigt",
};

const requestStatusColors: Record<string, string> = {
  NEU: "bg-blue-50 text-blue-700 border border-blue-200",
  OPEN: "bg-blue-50 text-blue-700 border border-blue-200",
  BESICHTIGUNG_GEPLANT: "bg-amber-50 text-amber-700 border border-amber-200",
  BESICHTIGUNG_DURCHGEFUEHRT: "bg-green-50 text-green-700 border border-green-200",
  ANGEBOT_ERSTELLT: "bg-amber-50 text-amber-700 border border-amber-200",
  IN_PROGRESS: "bg-purple-50 text-purple-700 border border-purple-200",
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
  PLANNED: "Geplant", ACTIVE: "Aktiv", COMPLETED: "Abgeschlossen",
};

const orderStatusColors: Record<string, string> = {
  PLANNED: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

type NoteWithRequest = ContactNote & { request: { id: string; title: string } | null };
type AttachmentWithRequest = Attachment & { request: { id: string; title: string } | null };

type ContactWithRelations = Contact & {
  requests: Request[];
  quotes: Quote[];
  orders: Order[];
  deliveryNotes: DeliveryNote[];
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
  const [activeTab, setActiveTab] = useState<TabId>("anfragen");
  const { containerRef: tabContainerRef, showLabels } = useTabLabels();
  const isCompany = contact.type !== "PRIVATE";
  const [notes, setNotes] = useState<NoteWithRequest[]>(contact.contactNotes);
  const [noteAdding, setNoteAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentWithRequest[]>(contact.attachments);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    dokumente: attachments.length,
    notizen: notes.length,
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <Link href="/kontakte" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ChevronLeft className="h-3.5 w-3.5" />
            Alle Kontakte
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
              {contact.contactPerson && (
                <p className="text-sm text-gray-500 mt-0.5">{contact.contactPerson}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/anfragen/neu?contactId=${contact.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />Neue Anfrage
          </Link>
          <EditContactButton contact={contact} userNames={userNames} />
        </div>
      </div>

      {/* Tab bar – full content width, above the sidebar grid */}
      <div className="px-6 pt-4 pb-0">
        <div className="overflow-hidden">
          <div ref={tabContainerRef} className="flex items-center gap-1">
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
      <div className="flex-1 p-6">
        <div className="grid grid-cols-[260px_1fr] gap-6 max-w-6xl">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-4">Kontaktdaten</h2>
              <div className="space-y-4">
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
                      <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline break-all">{contact.email}</a>
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
                        <p className="text-sm text-gray-900">
                          {[contact.postalCode, contact.city].filter(Boolean).join(" ")}
                        </p>
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
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">Übersicht</h2>
              <div className="divide-y divide-gray-50">
                {[
                  { label: "Anfragen", value: contact.requests.length },
                  { label: "Angebote", value: contact.quotes.length },
                  { label: "Aufträge", value: contact.orders.length },
                  { label: "Lieferscheine", value: contact.deliveryNotes.length },
                  { label: "Rechnungen", value: 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500">{item.label}</span>
                    <span className={`text-sm font-semibold ${item.value > 0 ? "text-gray-900" : "text-gray-300"}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-300 flex items-center gap-1 px-1">
              <Clock className="h-3 w-3" />
              Erstellt {format(new Date(contact.createdAt), "dd. MMMM yyyy", { locale: de })}
            </p>
          </div>

          {/* Tab content */}
          <div className="min-w-0">

            {/* Anfragen */}
            {activeTab === "anfragen" && (
              <TabContent empty={contact.requests.length === 0} emptyText="Noch keine Anfragen vorhanden"
                action={<Link href={`/anfragen/neu?contactId=${contact.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"><Plus className="h-3.5 w-3.5" />Neue Anfrage</Link>}
              >
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_180px_120px_36px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                    <ColHead>Titel</ColHead><ColHead>Status</ColHead><ColHead>Erstellt</ColHead><span />
                  </div>
                  {contact.requests.map((req, i) => (
                    <div key={req.id} className={`grid grid-cols-[1fr_180px_120px_36px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < contact.requests.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="text-sm font-medium text-gray-900 truncate pr-3">{req.title}</span>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full w-fit ${requestStatusColors[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {requestStatusLabels[req.status] ?? req.status}
                      </span>
                      <span className="text-sm text-gray-400">{format(new Date(req.createdAt), "dd.MM.yyyy", { locale: de })}</span>
                      <Link href={`/anfragen/${req.id}`} className="flex items-center justify-center">
                        <ExternalLink className="h-3.5 w-3.5 text-gray-300 hover:text-gray-600 transition-colors" />
                      </Link>
                    </div>
                  ))}
                </div>
              </TabContent>
            )}

            {/* Angebote */}
            {activeTab === "angebote" && (
              <TabContent empty={contact.quotes.length === 0} emptyText="Noch keine Angebote vorhanden"
                action={<Link href={`/angebote/neu?contactId=${contact.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"><Plus className="h-3.5 w-3.5" />Neues Angebot</Link>}
              >
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[80px_1fr_130px_90px_36px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                    <ColHead>Nr.</ColHead><ColHead>Titel</ColHead><ColHead>Betrag</ColHead><ColHead>Status</ColHead><span />
                  </div>
                  {contact.quotes.map((q, i) => (
                    <div key={q.id} className={`grid grid-cols-[80px_1fr_130px_90px_36px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < contact.quotes.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="font-mono text-xs text-gray-400">{q.quoteNumber}</span>
                      <span className="text-sm font-medium text-gray-900 truncate pr-3">{q.title}</span>
                      <span className="text-sm font-mono text-gray-700">{Number(q.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${quoteStatusColors[q.status]}`}>{quoteStatusLabels[q.status]}</span>
                      <Link href={`/angebote/${q.id}`} className="flex items-center justify-center">
                        <ExternalLink className="h-3.5 w-3.5 text-gray-300 hover:text-gray-600 transition-colors" />
                      </Link>
                    </div>
                  ))}
                </div>
              </TabContent>
            )}

            {/* Aufträge */}
            {activeTab === "auftraege" && (
              <TabContent empty={contact.orders.length === 0} emptyText="Noch keine Aufträge vorhanden">
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[80px_1fr_160px_90px_36px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                    <ColHead>Nr.</ColHead><ColHead>Titel</ColHead><ColHead>Zeitraum</ColHead><ColHead>Status</ColHead><span />
                  </div>
                  {contact.orders.map((o, i) => (
                    <div key={o.id} className={`grid grid-cols-[80px_1fr_160px_90px_36px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < contact.orders.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="font-mono text-xs text-gray-400">{o.orderNumber}</span>
                      <span className="text-sm font-medium text-gray-900 truncate pr-3">{o.title}</span>
                      <span className="text-xs text-gray-400">{format(new Date(o.startDate), "dd.MM.yy", { locale: de })} – {format(new Date(o.endDate), "dd.MM.yy", { locale: de })}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${orderStatusColors[o.status]}`}>{orderStatusLabels[o.status]}</span>
                      <Link href={`/auftraege/${o.id}`} className="flex items-center justify-center">
                        <ExternalLink className="h-3.5 w-3.5 text-gray-300 hover:text-gray-600 transition-colors" />
                      </Link>
                    </div>
                  ))}
                </div>
              </TabContent>
            )}

            {/* Lieferscheine */}
            {activeTab === "lieferscheine" && (
              <TabContent empty={contact.deliveryNotes.length === 0} emptyText="Noch keine Lieferscheine vorhanden">
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[80px_1fr_110px_100px_36px] px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                    <ColHead>Nr.</ColHead><ColHead>Material</ColHead><ColHead>Datum</ColHead><ColHead>Menge</ColHead><span />
                  </div>
                  {contact.deliveryNotes.map((dn, i) => (
                    <div key={dn.id} className={`grid grid-cols-[80px_1fr_110px_100px_36px] px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i < contact.deliveryNotes.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <span className="font-mono text-xs text-gray-400">{dn.deliveryNumber}</span>
                      <span className="text-sm font-medium text-gray-900 truncate pr-3">{dn.material}</span>
                      <span className="text-sm text-gray-400">{format(new Date(dn.date), "dd.MM.yyyy", { locale: de })}</span>
                      <span className="text-sm text-gray-500 font-mono">{Number(dn.quantity).toLocaleString("de-DE")} {dn.unit}</span>
                      <Link href={`/lieferscheine/${dn.id}`} className="flex items-center justify-center">
                        <ExternalLink className="h-3.5 w-3.5 text-gray-300 hover:text-gray-600 transition-colors" />
                      </Link>
                    </div>
                  ))}
                </div>
              </TabContent>
            )}

            {activeTab === "rechnungen" && (
              <EmptyTab icon={<Receipt className="h-8 w-8 text-gray-200" />} text="Rechnungen folgen in einer späteren Version" />
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
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-gray-400">{format(new Date(att.createdAt), "dd.MM.yyyy", { locale: de })}</span>
                            <button onClick={() => handleDeleteAttachment(att.id)} className="text-gray-300 hover:text-red-500 transition-colors">
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
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
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
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0 mt-0.5"
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
    </div>
  );
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
