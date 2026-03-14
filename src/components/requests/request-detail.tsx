"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Pencil, FileText, User, Clock, Paperclip, Upload, Activity, CheckCircle2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateRequest } from "@/actions/requests";
import { createContactNote, deleteContactNote } from "@/actions/contact-notes";
import { deleteAttachment } from "@/actions/attachments";
import type { Attachment, Contact, ContactNote, Quote, QuoteItem, Request } from "@prisma/client";

type RequestWithRelations = Request & {
  contact: Contact;
  quotes: (Quote & { items: QuoteItem[] })[];
  contactNotes: ContactNote[];
  attachments: Attachment[];
};

const statusOptions = [
  { value: "NEU", label: "Neu" },
  { value: "OPEN", label: "Offen" },
  { value: "BESICHTIGUNG_GEPLANT", label: "Besichtigung geplant" },
  { value: "BESICHTIGUNG_DURCHGEFUEHRT", label: "Besichtigung durchgeführt" },
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

const statusBadgeColors: Record<string, string> = {
  NEU: "border border-blue-300 text-blue-700 bg-blue-50",
  OPEN: "border border-blue-300 text-blue-700 bg-blue-50",
  BESICHTIGUNG_GEPLANT: "border border-amber-400 text-amber-700 bg-amber-50",
  BESICHTIGUNG_DURCHGEFUEHRT: "border border-green-300 text-green-700 bg-green-50",
  ANGEBOT_ERSTELLT: "border border-amber-400 text-amber-700 bg-amber-50",
  IN_PROGRESS: "border border-purple-300 text-purple-700 bg-purple-50",
  DONE: "border border-green-300 text-green-700 bg-green-50",
};

const priorityColors: Record<string, string> = {
  LOW: "text-gray-500",
  NORMAL: "text-blue-600",
  HIGH: "text-orange-600",
  URGENT: "text-red-600",
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{label}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

export function RequestDetail({
  request,
  userNames,
  currentUserName,
}: {
  request: RequestWithRelations;
  userNames: string[];
  currentUserName?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(request.title);
  const [description, setDescription] = useState(request.description ?? "");
  const [status, setStatus] = useState(request.status);
  const [priority, setPriority] = useState(request.priority ?? "NORMAL");
  const [owner, setOwner] = useState(request.assignedTo ?? "");
  const [siteAddress, setSiteAddress] = useState(request.siteAddress ?? "");
  const [sitePhone, setSitePhone] = useState(request.sitePhone ?? "");
  const [inspectionDate, setInspectionDate] = useState(
    request.inspectionDate
      ? format(new Date(request.inspectionDate), "yyyy-MM-dd'T'HH:mm")
      : ""
  );
  const [inspectionStatus, setInspectionStatus] = useState(request.inspectionStatus ?? "PLANNED");
  const [inspectionEditing, setInspectionEditing] = useState(false);
  const [inspectionDateEdit, setInspectionDateEdit] = useState(
    request.inspectionDate ? format(new Date(request.inspectionDate), "yyyy-MM-dd'T'HH:mm") : ""
  );
  const [inspectionSaving, setInspectionSaving] = useState(false);
  const [inspectionJustSaved, setInspectionJustSaved] = useState(false);

  const [notes, setNotes] = useState<ContactNote[]>(request.contactNotes);
  const [noteAdding, setNoteAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [attachments, setAttachments] = useState<Attachment[]>(request.attachments);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSaveInspection() {
    if (!inspectionDateEdit) return;
    setInspectionSaving(true);
    const newStatus = ["NEU", "OPEN"].includes(request.status) ? "BESICHTIGUNG_GEPLANT" : request.status;
    await updateRequest(request.id, {
      inspectionDate: inspectionDateEdit,
      inspectionStatus: "PLANNED",
      status: newStatus as "NEU",
    });
    setInspectionStatus("PLANNED");
    setInspectionEditing(false);
    setInspectionSaving(false);
    setInspectionJustSaved(true);
    toast.success("Besichtigungstermin gespeichert");
    router.refresh();
  }

  async function handleSave() {
    setSaving(true);
    await updateRequest(request.id, {
      title,
      description,
      status: status as "NEU",
      priority,
      assignedTo: owner || undefined,
      siteAddress,
      sitePhone,
      inspectionDate: inspectionDate || undefined,
      inspectionStatus,
    });
    toast.success("Gespeichert");
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleInspectionDone() {
    await updateRequest(request.id, { inspectionStatus: "DONE", status: "BESICHTIGUNG_DURCHGEFUEHRT" as "NEU" });
    toast.success("Besichtigung durchgeführt");
    router.refresh();
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    const result = await createContactNote({
      content: noteText,
      contactId: request.contact.id,
      requestId: request.id,
      createdBy: currentUserName,
    });
    setNoteSaving(false);
    if (result.note) {
      setNotes((prev) => [result.note!, ...prev]);
      setNoteText("");
      setNoteAdding(false);
      toast.success("Notiz gespeichert");
    }
  }

  async function handleDeleteNote(id: string) {
    await deleteContactNote(id, request.contact.id, request.id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notiz gelöscht");
  }

  async function uploadFiles(files: FileList | File[]) {
    console.log("[upload] uploadFiles called", files.length, "files");
    const fileArray = Array.from(files);
    setUploading(true);
    let successCount = 0;
    try {
      for (const file of fileArray) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("requestId", request.id);
        fd.append("contactId", request.contact.id);
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

  async function handleDeleteAttachment(id: string) {
    await deleteAttachment(id, request.id, request.contact.id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    toast.success("Datei gelöscht");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }

  const activities = [
    { icon: "📋", label: "Anfrage erstellt", date: request.createdAt, color: "bg-blue-100 text-blue-600" },
    ...(["BESICHTIGUNG_GEPLANT", "ANGEBOT_ERSTELLT", "DONE"].includes(request.status)
      ? [{ icon: "📅", label: `Besichtigung geplant${request.assignedTo ? ` · ${request.assignedTo}` : ""}`, date: request.inspectionDate ?? request.updatedAt, color: "bg-amber-100 text-amber-600" }]
      : []),
    ...(["ANGEBOT_ERSTELLT", "DONE"].includes(request.status)
      ? [{ icon: "📄", label: "Angebot erstellt", date: request.updatedAt, color: "bg-amber-100 text-amber-700" }]
      : []),
  ].reverse();

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <Link href="/anfragen" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Alle Anfragen
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{request.title}</h1>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadgeColors[request.status]}`}>
              {statusOptions.find((s) => s.value === request.status)?.label ?? request.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{request.contact.companyName}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{format(new Date(request.createdAt), "dd. MMMM yyyy", { locale: de })}</span>
            {request.assignedTo && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{request.assignedTo}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" className="rounded-lg" onClick={() => setEditing(false)}>Abbrechen</Button>
              <Button className="rounded-lg bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                {saving ? "Speichert..." : "Speichern"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="rounded-lg gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />Bearbeiten
              </Button>
              {request.quotes.length === 0 ? (
                <Link href={`/angebote/neu?requestId=${request.id}&contactId=${request.contact.id}`}>
                  <Button className="rounded-lg bg-blue-600 hover:bg-blue-700 gap-1.5">
                    <FileText className="h-3.5 w-3.5" />Angebot erstellen
                  </Button>
                </Link>
              ) : (
                <Link href={`/angebote/${request.quotes[0].id}`}>
                  <Button className="rounded-lg bg-blue-600 hover:bg-blue-700 gap-1.5">
                    <FileText className="h-3.5 w-3.5" />Zum Angebot
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-[1fr_320px] gap-6 max-w-5xl">
          {/* Left */}
          <div className="space-y-5">
            {/* Anfrageinformationen */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <span className="text-base">📋</span>
                <h2 className="text-sm font-semibold text-gray-900">Anfrageinformationen</h2>
              </div>

              {editing ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Titel</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakt</Label>
                      <p className="text-sm text-gray-900 py-2">{request.contact.companyName}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Owner</Label>
                      <Select value={owner} onValueChange={(v) => setOwner(v == null || v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                          <SelectValue>{owner || <span className="text-gray-400">Kein Owner</span>}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Kein Owner</SelectItem>
                          {userNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</Label>
                      <Select value={status} onValueChange={(v) => v && setStatus(v as typeof status)}>
                        <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                          <SelectValue>{statusOptions.find((s) => s.value === status)?.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
                          {priorityOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Beschreibung</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-lg border-gray-200 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Baustellenadresse</Label>
                      <Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kontakttelefon</Label>
                      <Input value={sitePhone} onChange={(e) => setSitePhone(e.target.value)} type="tel" className="h-10 rounded-lg border-gray-200" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label="Titel">{request.title}</InfoRow>
                  <div className="grid grid-cols-2 gap-6">
                    <InfoRow label="Kontakt">
                      <Link href={`/kontakte/${request.contact.id}`} className="text-blue-600 hover:underline">
                        {request.contact.companyName}
                      </Link>
                    </InfoRow>
                    <InfoRow label="Owner">{request.assignedTo ?? "–"}</InfoRow>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <InfoRow label="Status">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadgeColors[request.status]}`}>
                        {statusOptions.find((s) => s.value === request.status)?.label ?? request.status}
                      </span>
                    </InfoRow>
                    <InfoRow label="Priorität">
                      <span className={priorityColors[request.priority ?? "NORMAL"]}>
                        {priorityOptions.find((p) => p.value === (request.priority ?? "NORMAL"))?.label ?? "Normal"}
                      </span>
                    </InfoRow>
                  </div>
                  {request.description && (
                    <InfoRow label="Beschreibung">
                      <p className="whitespace-pre-wrap text-gray-700">{request.description}</p>
                    </InfoRow>
                  )}
                  <div className="grid grid-cols-2 gap-6">
                    <InfoRow label="Baustellenadresse">{request.siteAddress ?? "–"}</InfoRow>
                    <InfoRow label="Kontakttelefon">{request.sitePhone ?? "–"}</InfoRow>
                  </div>
                </>
              )}
            </div>

            {/* Besichtigung */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <span className="text-base">📅</span>
                <h2 className="text-sm font-semibold text-gray-900">Besichtigung</h2>
              </div>
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Besichtigungstermin</Label>
                    <Input type="datetime-local" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Zugewiesen an</Label>
                    <Select value={owner} onValueChange={(v) => setOwner(v == null || v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                        <SelectValue>{owner || <span className="text-gray-400">Niemand</span>}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Niemand</SelectItem>
                        {userNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Besichtigungstermin</p>
                    {inspectionEditing ? (
                      <div className="flex items-center gap-2 pt-0.5">
                        <Input
                          type="datetime-local"
                          value={inspectionDateEdit}
                          onChange={(e) => setInspectionDateEdit(e.target.value)}
                          className="h-9 rounded-lg border-gray-200 text-sm flex-1"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white h-9 px-3"
                          onClick={handleSaveInspection}
                          disabled={inspectionSaving || !inspectionDateEdit}
                        >
                          {inspectionSaving ? "..." : "Speichern"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg h-9 px-3"
                          onClick={() => { setInspectionEditing(false); setInspectionDateEdit(request.inspectionDate ? format(new Date(request.inspectionDate), "yyyy-MM-dd'T'HH:mm") : ""); }}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span
                          className="text-sm text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => { if (!inspectionDateEdit) { const d = new Date(); d.setHours(7, 0, 0, 0); setInspectionDateEdit(format(d, "yyyy-MM-dd'T'HH:mm")); } setInspectionEditing(true); }}
                        >
                          {request.inspectionDate
                            ? `${format(new Date(request.inspectionDate), "dd.MM.yyyy HH:mm", { locale: de })} Uhr`
                            : <span className="text-gray-400 hover:text-blue-500">Termin festlegen…</span>}
                        </span>
                        {request.inspectionDate && (
                          <>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                              inspectionStatus === "DONE"
                                ? "border border-green-300 text-green-700 bg-green-50"
                                : "border border-amber-400 text-amber-700 bg-amber-50"
                            }`}>
                              <Clock className="h-3 w-3" />
                              {inspectionStatus === "DONE" ? "Erledigt" : "Geplant"}
                            </span>
                            <button onClick={() => setInspectionEditing(true)} className="text-gray-300 hover:text-gray-500 transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <InfoRow label="Zugewiesen an">{request.assignedTo ?? "–"}</InfoRow>
                  {request.inspectionDate && (
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {request.inspectionStatus !== "DONE" && (
                        <Button className="rounded-lg bg-green-600 hover:bg-green-700 gap-1.5" onClick={handleInspectionDone}>
                          <CheckCircle2 className="h-3.5 w-3.5" />Besichtigung abschließen
                        </Button>
                      )}
                      {(inspectionJustSaved || request.inspectionDate) && (
                        <a
                          href={`webcal://${typeof window !== "undefined" ? window.location.host : ""}/api/ical/inspection/${request.id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 h-9 transition-colors"
                        >
                          <span>📅</span> Zum Kalender hinzufügen
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notizen */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-gray-500" />
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
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <MessageSquare className="h-8 w-8 text-gray-200" />
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
                      <p className="text-xs text-gray-400 mt-1.5">
                        {format(new Date(note.createdAt), "dd. MMMM yyyy, HH:mm", { locale: de })} Uhr
                        {note.createdBy && ` · ${note.createdBy}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quotes */}
            {request.quotes.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <span>📄</span>
                  <h3 className="text-sm font-semibold text-gray-900">Angebote ({request.quotes.length})</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {request.quotes.map((quote) => (
                    <Link key={quote.id} href={`/angebote/${quote.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                      <span className="font-mono text-xs text-gray-400">{quote.quoteNumber}</span>
                      <span className="text-sm font-medium text-gray-900">{quote.title}</span>
                      <span className="text-sm font-mono text-gray-700">
                        {Number(quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="space-y-5">
            {/* Anhänge */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">Anhänge</h3>
                  {attachments.length > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{attachments.length}</span>
                  )}
                </div>
                <label className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />Hochladen
                  <input type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
                </label>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`transition-colors ${isDragging ? "bg-blue-50" : ""}`}
              >
                {attachments.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center py-8 text-center px-4 border-2 border-dashed mx-4 my-4 rounded-xl transition-colors ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                    {uploading ? (
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Wird hochgeladen…</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-7 w-7 text-gray-300 mb-2" />
                        <p className="text-sm text-gray-400">Dateien hier ablegen</p>
                        <p className="text-xs text-gray-300 mt-0.5">oder oben auf „Hochladen" klicken · max. 20 MB</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {uploading && (
                      <div className="px-4 py-3 flex items-center gap-2 text-blue-600 text-sm">
                        <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        Wird hochgeladen…
                      </div>
                    )}
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <FileIcon mimeType={att.mimeType} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors truncate block"
                          >
                            {att.fileName}
                          </a>
                          <p className="text-xs text-gray-400">{formatFileSize(att.fileSize)}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {/* Drop area at bottom when files exist */}
                    <label className={`flex items-center justify-center gap-2 px-4 py-3 cursor-pointer transition-colors ${isDragging ? "bg-blue-50 text-blue-600" : "text-gray-300 hover:text-gray-400 hover:bg-gray-50"}`}>
                      <Upload className="h-3.5 w-3.5" />
                      <span className="text-xs">Weitere Dateien hinzufügen</span>
                      <input type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Aktivität */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Aktivität</h3>
              </div>
              <div className="space-y-3">
                {activities.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${activity.color}`}>
                      {activity.icon}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm text-gray-700">{activity.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(activity.date), "dd. MMMM yyyy", { locale: de })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <span className="text-base">🖼️</span>;
  if (mimeType === "application/pdf") return <span className="text-base">📄</span>;
  if (mimeType.includes("word") || mimeType.includes("document")) return <span className="text-base">📝</span>;
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return <span className="text-base">📊</span>;
  return <Paperclip className="h-4 w-4 text-gray-400" />;
}
