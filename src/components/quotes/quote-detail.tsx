"use client";

import { useState, useRef, useEffect } from "react";
import { useEscapeKey } from "@/hooks/use-escape-key";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, FileText, Mail, Pencil, Trash2, CheckCircle, Activity, Plus, Package, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { StatusBadge } from "@/components/ui/status-badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateQuote, updateQuoteStatus, deleteQuote, acceptQuoteAndCreateOrder } from "@/actions/quotes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { sendQuoteEmail } from "@/actions/send-quote-email";
import type { Contact, Quote, QuoteItem, Request } from "@prisma/client";
import type { MachineRow } from "@/actions/machines";

type QuoteWithRelations = Quote & {
  contact: Contact;
  request: Request | null;
  items: QuoteItem[];
};

const statusLabels: Record<string, string> = {
  DRAFT: "Entwurf",
  SENT: "Versendet",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 border border-zinc-200",
  SENT: "bg-blue-50 text-blue-700 border border-blue-200",
  ACCEPTED: "bg-green-50 text-green-700 border border-green-200",
  REJECTED: "bg-red-50 text-red-600 border border-red-200",
};

const UNITS = ["t", "m³", "m²", "m", "Stk", "Std", "Psch"];

interface EditItem {
  itemType: "produkt" | "maschine";
  description: string;
  note: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{label}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

export function QuoteDetail({
  quote,
  userNames = [],
  machines = [],
}: {
  quote: QuoteWithRelations;
  userNames?: string[];
  machines?: MachineRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEscapeKey(() => setEditing(false), editing);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(quote.contact?.email ?? "");
  const [emailSending, setEmailSending] = useState(false);

  const [title, setTitle] = useState(quote.title);
  const [siteAddress, setSiteAddress] = useState(quote.siteAddress ?? "");
  const [assignedTo, setAssignedTo] = useState(quote.assignedTo ?? "");
  const [validUntil, setValidUntil] = useState(
    quote.validUntil ? format(new Date(quote.validUntil), "yyyy-MM-dd") : ""
  );
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [items, setItems] = useState<EditItem[]>(
    quote.items.map((i) => ({
      itemType: "produkt" as const,
      description: i.description,
      note: i.note ?? "",
      quantity: Number(i.quantity),
      unit: i.unit,
      unitPrice: Number(i.unitPrice),
    }))
  );

  const editTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function addItem() {
    setItems([...items, { itemType: "produkt", description: "", note: "", quantity: 1, unit: "t", unitPrice: 0 }]);
  }
  function removeItem(idx: number) {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, field: keyof EditItem, value: string | number) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function switchItemType(idx: number, type: "produkt" | "maschine") {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      if (type === "maschine") {
        return { ...item, itemType: type, description: "", unit: "Std", unitPrice: 0 };
      }
      return { ...item, itemType: type, description: "", unit: "t", unitPrice: 0 };
    }));
    setOpenMachineIdx(null);
  }

  // ── Machine combobox per position ─────────────────────────────────────────
  const [openMachineIdx, setOpenMachineIdx] = useState<number | null>(null);
  const machineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (openMachineIdx === null) return;
      const ref = machineRefs.current[openMachineIdx];
      if (ref && !ref.contains(e.target as Node)) setOpenMachineIdx(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMachineIdx]);

  function getFilteredMachines(search: string) {
    if (!search) return machines;
    const q = search.toLowerCase();
    return machines.filter((m) =>
      m.name.toLowerCase().includes(q) || m.machineType.toLowerCase().includes(q)
    );
  }

  function selectMachine(idx: number, machine: MachineRow) {
    const description = `${machine.name} (${machine.machineType})`;
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, description, unit: "Std", unitPrice: machine.hourlyRate ?? 0 };
    }));
    setOpenMachineIdx(null);
  }

  async function handleSave() {
    setSaving(true);
    const submitItems = items.map(({ itemType: _itemType, ...rest }) => rest);
    await updateQuote(quote.id, {
      title,
      contactId: quote.contactId,
      requestId: quote.requestId ?? undefined,
      siteAddress: siteAddress || undefined,
      assignedTo: assignedTo || undefined,
      validUntil: validUntil || undefined,
      notes: notes || undefined,
      items: submitItems,
    });
    toast.success("Angebot gespeichert");
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleStatusChange(status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED") {
    await updateQuoteStatus(quote.id, status);
    toast.success("Status geändert");
    router.refresh();
  }

  async function handleAccept() {
    const result = await acceptQuoteAndCreateOrder(quote.id);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Angebot angenommen – Auftrag wurde erstellt");
    router.push(`/auftraege/${result.order!.id}`);
  }

  async function handleSendEmail() {
    if (!emailTo) return;
    setEmailSending(true);
    try {
      const result = await sendQuoteEmail(quote.id, emailTo);
      if (result.error) {
        toast.error("Fehler beim Senden: " + result.error);
        return;
      }
      toast.success("Angebot per E-Mail versendet");
      setEmailOpen(false);
      await handleStatusChange("SENT");
    } catch (e) {
      toast.error("Fehler beim Senden: " + (e instanceof Error ? e.message : "Unbekannter Fehler"));
    } finally {
      setEmailSending(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    await deleteQuote(quote.id);
    toast.success("Angebot gelöscht");
    router.push("/angebote");
  }

  const activities = [
    { label: "Angebot erstellt", date: quote.createdAt, color: "bg-blue-500" },
    ...(quote.status === "SENT" ? [{ label: "Angebot versendet", date: quote.updatedAt, color: "bg-blue-500" }] : []),
    ...(quote.status === "ACCEPTED" ? [{ label: "Angebot angenommen", date: quote.updatedAt, color: "bg-green-500" }] : []),
    ...(quote.status === "REJECTED" ? [{ label: "Angebot abgelehnt", date: quote.updatedAt, color: "bg-red-500" }] : []),
  ];

  return (
    <>
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <Link href="/angebote" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Alle Angebote
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{quote.quoteNumber}</h1>
            <StatusBadge status={quote.status} />
          </div>
          <Link href={`/kontakte/${quote.contact.id}`} className="text-sm text-gray-500 hover:text-blue-600 transition-colors mt-0.5 block">
            {quote.contact.companyName}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* PDF */}
          <Button
            variant="outline"
            className="rounded-lg gap-1.5"
            onClick={() => window.open(`/api/pdf/quote/${quote.id}`, "_blank")}
          >
            <FileText className="h-3.5 w-3.5" />PDF
          </Button>

          {/* Per E-Mail senden */}
          <Button
            variant="outline"
            className="rounded-lg gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
            onClick={() => setEmailOpen(true)}
          >
            <Mail className="h-3.5 w-3.5" />Per E-Mail senden
          </Button>
          {quote.status !== "ACCEPTED" && quote.status !== "REJECTED" && (
            <>
              <Button
                variant="outline"
                className="rounded-lg gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
                onClick={handleAccept}
              >
                <CheckCircle className="h-3.5 w-3.5" />Angenommen
              </Button>
              <Button
                variant="outline"
                className="rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => handleStatusChange("REJECTED")}
              >
                Abgelehnt
              </Button>
            </>
          )}

          {/* Bearbeiten / Speichern */}
          {editing ? (
            <>
              <Button variant="outline" className="rounded-lg" onClick={() => setEditing(false)}>Abbrechen</Button>
              <LoadingButton className="rounded-lg" onClick={handleSave} loading={saving}>
                Speichern
              </LoadingButton>
            </>
          ) : (
            <Button variant="outline" className="rounded-lg gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />Bearbeiten
            </Button>
          )}

          {/* Löschen */}
          <Button
            variant="outline"
            className="rounded-lg gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />{deleting ? "..." : "Löschen"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-[1fr_300px] gap-6 max-w-5xl">
          {/* Left */}
          <div className="space-y-5">
            {/* Anfrage als Referenz */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Anfrage als Referenz</h2>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Anfrage wählen</p>
                {quote.request ? (
                  <Link
                    href={`/anfragen/${quote.request.id}`}
                    className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-blue-900">
                      {quote.contact.companyName} – {quote.request.title}
                    </span>
                  </Link>
                ) : (
                  <div className="text-sm text-gray-400 italic">Keine Anfrage verknüpft</div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Beim Auswählen einer Anfrage werden relevante Daten automatisch übernommen.
                </p>
              </div>
            </div>

            {/* Angebotsinformationen */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <h2 className="text-base font-semibold text-gray-900">Angebotsinformationen</h2>
              <div className="border-t border-gray-100 pt-4">
                {editing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Projektname</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Owner</Label>
                        <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v == null || v === "__none__" ? "" : v)}>
                          <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                            <SelectValue>{assignedTo || <span className="text-gray-400">Kein Owner</span>}</SelectValue>
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
                        <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Baustellenadresse</Label>
                        <Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Gültig bis</Label>
                        <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-lg border-gray-200 resize-none" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                    <InfoRow label="Projektname">{quote.title}</InfoRow>
                    <InfoRow label="Angebotsnummer">{quote.quoteNumber}</InfoRow>
                    <InfoRow label="Kontakt">
                      <Link href={`/kontakte/${quote.contact.id}`} className="text-blue-600 hover:underline">
                        {quote.contact.companyName}
                      </Link>
                    </InfoRow>
                    <InfoRow label="Baustellenadresse">{quote.siteAddress ?? "–"}</InfoRow>
                    <InfoRow label="Angebotsdatum">
                      {format(new Date(quote.createdAt), "dd. MMMM yyyy", { locale: de })}
                    </InfoRow>
                    <InfoRow label="Gültig bis">
                      {quote.validUntil ? format(new Date(quote.validUntil), "dd. MMMM yyyy", { locale: de }) : "–"}
                    </InfoRow>
                    <InfoRow label="Owner">{quote.assignedTo ?? "–"}</InfoRow>
                    {quote.notes && <InfoRow label="Notizen">{quote.notes}</InfoRow>}
                  </div>
                )}
              </div>
            </div>

            {/* Positionen */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Positionen</h3>
                {editing && (
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />Position
                  </button>
                )}
              </div>

              {editing ? (
                <div className="px-4 pb-4 pt-2">
                  <div className="grid grid-cols-[32px_1fr_100px_100px_100px_112px] gap-x-3 pb-2 border-b-2 border-gray-100 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                    <div>#</div>
                    <div>Beschreibung</div>
                    <div className="text-right">Menge</div>
                    <div className="text-right">Einheit</div>
                    <div className="text-right">EP (€)</div>
                    <div className="text-right">GP (€)</div>
                  </div>
                  {items.map((item, idx) => {
                    const isProdukt = item.itemType === "produkt";
                    const isMaschine = item.itemType === "maschine";
                    const fm = getFilteredMachines(item.description);
                    const showMachineDrop = isMaschine && openMachineIdx === idx;
                    return (
                    <div key={idx} className="group border-b border-gray-100 py-3 space-y-1.5">
                      {/* Eingabe-Zeile */}
                      <div className="grid grid-cols-[32px_1fr_100px_100px_100px_112px] gap-x-3 items-center">
                        <div className="h-9 flex items-center justify-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div
                          className="relative"
                          ref={(el) => { machineRefs.current[idx] = el; }}
                        >
                          <button
                            type="button"
                            title={isProdukt ? "Zu Maschine wechseln" : "Zu Produkt wechseln"}
                            className={`absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors z-10 ${isProdukt ? "text-blue-400 hover:text-blue-600" : "text-orange-400 hover:text-orange-600"}`}
                            onClick={() => switchItemType(idx, isProdukt ? "maschine" : "produkt")}
                          >
                            {isProdukt ? <Package className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                          </button>
                          <input
                            type="text"
                            className={`w-full h-9 rounded-md border border-gray-200 pl-8 pr-8 text-sm focus:outline-none focus:ring-1 focus:border-blue-400 ${isProdukt ? "focus:ring-blue-400" : "focus:ring-orange-400 focus:border-orange-400"} min-w-0`}
                            placeholder={isProdukt ? "Beschreibung..." : "Maschine suchen..."}
                            value={item.description}
                            onChange={(e) => {
                              updateItem(idx, "description", e.target.value);
                              if (isMaschine) setOpenMachineIdx(idx);
                            }}
                            onFocus={() => {
                              if (isMaschine) setOpenMachineIdx(idx);
                            }}
                          />
                          {item.description && (
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                              onClick={() => {
                                updateItem(idx, "description", "");
                                if (isMaschine) setOpenMachineIdx(idx);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {showMachineDrop && (
                            <div className="absolute z-50 top-full mt-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                              {fm.length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-400">Keine Maschine gefunden</div>
                              )}
                              {fm.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex items-center gap-2"
                                  onMouseDown={() => selectMachine(idx, m)}
                                >
                                  <Wrench className="h-3.5 w-3.5 text-orange-300 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-gray-900">{m.name}</span>
                                    <span className="text-xs text-gray-400 ml-1.5">· {m.machineType}</span>
                                  </div>
                                  {m.hourlyRate != null && (
                                    <span className="text-xs text-orange-600 font-mono flex-shrink-0">
                                      {m.hourlyRate.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}/Std
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Input className="text-sm h-9 text-right" type="number" min="0" step={["Std", "Stk", "Psch"].includes(item.unit) ? "1" : "0.001"} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} />
                        <Select value={item.unit} onValueChange={(v) => v && updateItem(idx, "unit", v)}>
                          <SelectTrigger className="text-sm h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input className="text-sm h-9 text-right" type="number" min="0" step="1" value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} />
                        <div className="h-9 flex items-center justify-end px-3 text-sm font-mono text-gray-900 bg-gray-50 rounded-md border border-gray-100">
                          {(item.quantity * item.unitPrice).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      {/* Notiz-Zeile — bündig mit Beschreibungs-Spalte bis Ende GP */}
                      <div className="pl-[44px]">
                        <textarea
                          rows={item.note ? 2 : 1}
                          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 resize-none"
                          placeholder="Positionsbeschreibung hinzufügen..."
                          value={item.note}
                          onChange={(e) => updateItem(idx, "note", e.target.value)}
                        />
                      </div>
                    </div>
                    );
                  })}
                  <div className="flex flex-col items-end gap-1.5 pt-3 mt-1">
                    <div className="flex items-center gap-8 text-sm text-gray-500">
                      <span className="w-32 text-right">Netto</span>
                      <span className="font-mono w-28 text-right">{editTotal.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                    </div>
                    <div className="flex items-center gap-8 text-sm text-gray-400">
                      <span className="w-32 text-right">+ 20 % MwSt.</span>
                      <span className="font-mono w-28 text-right">{(editTotal * 0.2).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                    </div>
                    <div className="flex items-center gap-8 text-sm font-semibold text-gray-900 border-t border-gray-200 pt-2 mt-0.5">
                      <span className="w-32 text-right">Gesamt (brutto)</span>
                      <span className="font-mono w-28 text-right text-base">{(editTotal * 1.2).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-5 py-2.5">Pos.</th>
                      <th className="text-left px-5 py-2.5">Beschreibung</th>
                      <th className="text-right px-5 py-2.5">Menge</th>
                      <th className="text-right px-5 py-2.5">Einheit</th>
                      <th className="text-right px-5 py-2.5">EP €</th>
                      <th className="text-right px-5 py-2.5">GP €</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quote.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-400 font-mono text-xs">{item.position}</td>
                        <td className="px-5 py-3">
                          <span className="font-medium text-gray-900">{item.description}</span>
                          {item.note && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{item.note}</p>}
                        </td>
                        <td className="px-5 py-3 text-right font-mono">{Number(item.quantity).toLocaleString("de-DE")}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{item.unit}</td>
                        <td className="px-5 py-3 text-right font-mono">{Number(item.unitPrice).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3 text-right font-mono">{Number(item.total).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100">
                      <td colSpan={4} />
                      <td className="px-5 py-2 text-right text-xs text-gray-400">Netto</td>
                      <td className="px-5 py-2 text-right font-mono text-gray-700">
                        {Number(quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} />
                      <td className="px-5 py-2 text-right text-xs text-gray-400">+ 20 % MwSt.</td>
                      <td className="px-5 py-2 text-right font-mono text-gray-700">
                        {(Number(quote.totalPrice) * 0.2).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={4} />
                      <td className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gesamt (brutto)</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-gray-900">
                        {(Number(quote.totalPrice) * 1.2).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Aktivität</h3>
              </div>
              <div className="space-y-3">
                {activities.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.color}`} />
                    <div>
                      <p className="text-sm text-gray-700">{a.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(a.date), "dd. MMMM yyyy", { locale: de })}
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

    {/* ConfirmDialog: Angebot löschen */}
    <ConfirmDialog
      open={confirmDeleteOpen}
      onOpenChange={setConfirmDeleteOpen}
      title="Angebot löschen"
      description="Dieses Angebot wird unwiderruflich gelöscht."
      onConfirm={confirmDelete}
    />

    {/* E-Mail Dialog */}

    <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Angebot per E-Mail senden</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Empfänger</Label>
            <Input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="email@beispiel.de"
              className="h-10 rounded-lg border-gray-200"
              autoFocus
            />
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 space-y-0.5">
            <p className="font-medium text-gray-800">Betreff: Angebot {quote.quoteNumber} – {quote.title}</p>
            <p className="text-xs text-gray-400">Anhang: {quote.quoteNumber}.pdf</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" className="rounded-lg" onClick={() => setEmailOpen(false)}>
              Abbrechen
            </Button>
            <Button
              className="rounded-lg"
              disabled={emailSending || !emailTo}
              onClick={handleSendEmail}
            >
              {emailSending ? "Wird gesendet..." : "E-Mail senden"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
