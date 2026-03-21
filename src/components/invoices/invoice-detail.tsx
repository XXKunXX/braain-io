"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft,
  FileText,
  Send,
  CheckCircle,
  Download,
  Trash2,
  Plus,
  Pencil,
  Save,
  X,
  Clock,
  XCircle,
} from "lucide-react";
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
import {
  updateInvoice,
  updateInvoiceItems,
  markInvoicePaid,
  deleteInvoice,
  sendInvoiceEmail,
} from "@/actions/invoices";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const UNITS = ["Stk", "t", "m³", "m²", "m", "Std", "Psch", "Pos"];

type InvoiceItem = {
  id: string;
  position: number;
  description: string;
  note?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  total: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceDate: Date | string;
  dueDate?: Date | string | null;
  headerText?: string | null;
  footerText?: string | null;
  notes?: string | null;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  sentAt?: Date | string | null;
  paidAt?: Date | string | null;
  contact: {
    id: string;
    companyName: string;
    email?: string | null;
    contactPerson?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
  };
  order?: { id: string; orderNumber: string; title: string } | null;
  paymentMilestone?: {
    id: string;
    title: string;
    amount: number;
    status: string;
  } | null;
  items: InvoiceItem[];
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ENTWURF:   { label: "Entwurf",   color: "border border-gray-200 text-gray-500 bg-gray-50",   icon: FileText },
  VERSENDET: { label: "Versendet", color: "border border-blue-200 text-blue-700 bg-blue-50",    icon: Clock },
  BEZAHLT:   { label: "Bezahlt",   color: "border border-green-200 text-green-700 bg-green-50", icon: CheckCircle },
  STORNIERT: { label: "Storniert", color: "border border-red-200 text-red-600 bg-red-50",       icon: XCircle },
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

let nextItemId = 1;
function newEditItem() {
  return { id: `new-${nextItemId++}`, description: "", note: "", quantity: "", unit: "Stk", unitPrice: "" };
}

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  // Details edit state
  const [editDate, setEditDate] = useState(format(new Date(invoice.invoiceDate), "yyyy-MM-dd"));
  const [editDueDate, setEditDueDate] = useState(
    invoice.dueDate ? format(new Date(invoice.dueDate), "yyyy-MM-dd") : ""
  );
  const [editHeader, setEditHeader] = useState(invoice.headerText ?? "");
  const [editFooter, setEditFooter] = useState(invoice.footerText ?? "");
  const [editNotes, setEditNotes] = useState(invoice.notes ?? "");

  // Items edit state
  type EditItem = { id: string; description: string; note: string; quantity: string; unit: string; unitPrice: string };
  const [editItems, setEditItems] = useState<EditItem[]>(
    invoice.items.map((i) => ({
      id: i.id,
      description: i.description,
      note: i.note ?? "",
      quantity: String(i.quantity),
      unit: i.unit,
      unitPrice: String(i.unitPrice),
    }))
  );

  // Email dialog
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState(invoice.contact.email ?? "");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  const vatRate = invoice.vatRate;
  const editTotal = editItems.reduce((sum, i) => {
    const q = parseFloat(i.quantity.replace(",", "."));
    const p = parseFloat(i.unitPrice.replace(",", "."));
    return sum + (isNaN(q) || isNaN(p) ? 0 : q * p);
  }, 0);
  const editVat = editTotal * vatRate;
  const editGross = editTotal + editVat;

  async function handleSaveDetails() {
    setSaving(true);
    const result = await updateInvoice(invoice.id, {
      invoiceDate: editDate,
      dueDate: editDueDate || undefined,
      headerText: editHeader || undefined,
      footerText: editFooter || undefined,
      notes: editNotes || undefined,
    });
    setSaving(false);
    if (result.success) { toast.success("Gespeichert"); setEditingDetails(false); router.refresh(); }
    else toast.error("Fehler beim Speichern");
  }

  async function handleSaveItems() {
    const validItems = editItems.filter((i) => i.description && i.quantity && i.unitPrice);
    if (validItems.length === 0) { toast.error("Mindestens eine Position erforderlich"); return; }
    setSaving(true);
    const result = await updateInvoiceItems(
      invoice.id,
      validItems.map((i) => ({
        description: i.description,
        note: i.note || undefined,
        quantity: parseFloat(i.quantity.replace(",", ".")),
        unit: i.unit,
        unitPrice: parseFloat(i.unitPrice.replace(",", ".")),
      })),
      vatRate
    );
    setSaving(false);
    if (result.success) { toast.success("Positionen gespeichert"); setEditingItems(false); router.refresh(); }
    else toast.error("Fehler beim Speichern");
  }

  async function handleMarkPaid() {
    setSaving(true);
    await markInvoicePaid(invoice.id);
    toast.success("Als bezahlt markiert");
    setSaving(false);
    router.refresh();
  }

  async function handleSendEmail() {
    if (!emailTo) { toast.error("Bitte E-Mail-Adresse eingeben"); return; }
    setSendingEmail(true);
    const result = await sendInvoiceEmail(invoice.id, emailTo);
    setSendingEmail(false);
    if (result.success) {
      toast.success("Rechnung per E-Mail versendet");
      setShowEmailDialog(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Fehler beim Versenden");
    }
  }

  async function handleDelete() {
    await deleteInvoice(invoice.id);
    toast.success("Rechnung gelöscht");
    router.push("/rechnungen");
  }

  const cfg = statusConfig[invoice.status] ?? statusConfig.ENTWURF;
  const StatusIcon = cfg.icon;
  const canEdit = invoice.status !== "BEZAHLT" && invoice.status !== "STORNIERT";

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      {/* Back + header */}
      <div>
        <Link
          href="/rechnungen"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zu Rechnungen
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                <StatusIcon className="h-3 w-3" />
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-500">{invoice.contact.companyName}</p>
            {invoice.order && (
              <Link href={`/auftraege/${invoice.order.id}`} className="text-xs text-blue-600 hover:underline">
                {invoice.order.orderNumber} – {invoice.order.title}
              </Link>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/pdf/invoice/${invoice.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </a>

            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowEmailDialog(true)}
              >
                <Send className="h-3.5 w-3.5" />
                Per E-Mail senden
              </Button>
            )}

            {invoice.status !== "BEZAHLT" && invoice.status !== "STORNIERT" && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                onClick={handleMarkPaid}
                disabled={saving}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Als bezahlt markieren
              </Button>
            )}

            {invoice.status === "ENTWURF" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-700">Rechnung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Abbrechen</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Löschen</Button>
          </div>
        </div>
      )}

      {/* Email dialog */}
      {showEmailDialog && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-900">Rechnung per E-Mail versenden</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-blue-700">E-Mail-Adresse</Label>
              <Input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="empfaenger@beispiel.at"
                type="email"
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={handleSendEmail}
              disabled={sendingEmail}
            >
              <Send className="h-3.5 w-3.5" />
              {sendingEmail ? "Wird gesendet..." : "Senden"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowEmailDialog(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Payment milestone info */}
      {invoice.paymentMilestone && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-0.5">Verknüpfter Zahlungsmeilenstein</p>
          <p className="text-sm text-amber-700">
            {invoice.paymentMilestone.title} –{" "}
            {Number(invoice.paymentMilestone.amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
          </p>
        </div>
      )}

      {/* Details section */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Details</h2>
          {canEdit && !editingDetails && (
            <button
              onClick={() => setEditingDetails(true)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="h-3 w-3" />
              Bearbeiten
            </button>
          )}
        </div>

        {editingDetails ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Rechnungsdatum</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Fälligkeitsdatum</Label>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Kopftext</Label>
              <Textarea value={editHeader} onChange={(e) => setEditHeader(e.target.value)} rows={2} placeholder="Kopftext..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Fußtext / Zahlungsbedingungen</Label>
              <Textarea value={editFooter} onChange={(e) => setEditFooter(e.target.value)} rows={2} placeholder="Zahlungsbedingungen..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Interne Notizen</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Interne Anmerkungen..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={handleSaveDetails} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                Speichern
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingDetails(false)}>Abbrechen</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Rechnungsdatum</p>
              <p className="font-medium text-gray-900">{format(new Date(invoice.invoiceDate), "dd.MM.yyyy", { locale: de })}</p>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Fällig bis</p>
                <p className="font-medium text-gray-900">{format(new Date(invoice.dueDate), "dd.MM.yyyy", { locale: de })}</p>
              </div>
            )}
            {invoice.sentAt && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Versendet am</p>
                <p className="font-medium text-gray-900">{format(new Date(invoice.sentAt), "dd.MM.yyyy", { locale: de })}</p>
              </div>
            )}
            {invoice.paidAt && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Bezahlt am</p>
                <p className="font-medium text-gray-900">{format(new Date(invoice.paidAt), "dd.MM.yyyy", { locale: de })}</p>
              </div>
            )}
            {invoice.headerText && (
              <div className="col-span-full">
                <p className="text-xs text-gray-400 mb-0.5">Kopftext</p>
                <p className="text-gray-700 whitespace-pre-wrap">{invoice.headerText}</p>
              </div>
            )}
            {invoice.footerText && (
              <div className="col-span-full">
                <p className="text-xs text-gray-400 mb-0.5">Fußtext</p>
                <p className="text-gray-700 whitespace-pre-wrap">{invoice.footerText}</p>
              </div>
            )}
            {invoice.notes && (
              <div className="col-span-full">
                <p className="text-xs text-gray-400 mb-0.5">Interne Notizen</p>
                <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items section */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Positionen</h2>
          {canEdit && !editingItems && (
            <button
              onClick={() => setEditingItems(true)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Pencil className="h-3 w-3" />
              Bearbeiten
            </button>
          )}
        </div>

        {editingItems ? (
          <div>
            {/* Edit header */}
            <div className="grid grid-cols-[1fr_80px_80px_110px_100px_32px] gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100">
              {["Beschreibung", "Menge", "Einheit", "Einzelpreis", "Gesamt", ""].map((h) => (
                <span key={h} className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-gray-50">
              {editItems.map((item) => {
                const q = parseFloat(item.quantity.replace(",", "."));
                const p = parseFloat(item.unitPrice.replace(",", "."));
                const t = isNaN(q) || isNaN(p) ? null : q * p;
                return (
                  <div key={item.id} className="px-5 py-2 space-y-1.5">
                    <div className="grid grid-cols-[1fr_80px_80px_110px_100px_32px] gap-2 items-center">
                      <Input
                        value={item.description}
                        onChange={(e) => setEditItems((prev) => prev.map((i) => i.id === item.id ? { ...i, description: e.target.value } : i))}
                        className="h-9 text-sm"
                      />
                      <Input
                        value={item.quantity}
                        onChange={(e) => setEditItems((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: e.target.value } : i))}
                        className="h-9 text-sm text-right"
                      />
                      <Select value={item.unit} onValueChange={(v) => setEditItems((prev) => prev.map((i) => i.id === item.id ? { ...i, unit: v ?? "Stk" } : i))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Input
                          value={item.unitPrice}
                          onChange={(e) => setEditItems((prev) => prev.map((i) => i.id === item.id ? { ...i, unitPrice: e.target.value } : i))}
                          className="h-9 text-sm text-right pr-7"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                      </div>
                      <p className="text-sm text-right text-gray-700 font-medium tabular-nums">
                        {t != null ? fmt(t) : "—"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditItems((prev) => prev.length > 1 ? prev.filter((i) => i.id !== item.id) : prev)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      value={item.note}
                      onChange={(e) => setEditItems((prev) => prev.map((i) => i.id === item.id ? { ...i, note: e.target.value } : i))}
                      placeholder="Optionale Zusatzinfo..."
                      className="h-8 text-xs text-gray-500 bg-gray-50"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setEditItems((prev) => [...prev, newEditItem()])}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                Position hinzufügen
              </button>
              <div className="space-y-0.5 text-right">
                <p className="text-xs text-gray-500">Netto: {fmt(editTotal)} €</p>
                <p className="text-xs text-gray-500">MwSt. ({Math.round(vatRate * 100)} %): {fmt(editVat)} €</p>
                <p className="text-sm font-bold text-gray-900">Gesamt: {fmt(editGross)} €</p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={handleSaveItems} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                Positionen speichern
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingItems(false)}>Abbrechen</Button>
            </div>
          </div>
        ) : (
          <>
            {/* View items */}
            <div className="grid grid-cols-[40px_1fr_80px_70px_110px_110px] gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100">
              {["Pos", "Beschreibung", "Menge", "Einh.", "Einzelpreis", "Gesamt"].map((h) => (
                <span key={h} className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-gray-50">
              {invoice.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[40px_1fr_80px_70px_110px_110px] gap-2 px-5 py-3 items-start">
                  <span className="text-xs text-gray-400 pt-0.5">{item.position}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.description}</p>
                    {item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}
                  </div>
                  <span className="text-sm text-gray-700 text-right">{fmt(item.quantity, 3).replace(/\.?0+$/, "")}</span>
                  <span className="text-sm text-gray-500 text-center">{item.unit}</span>
                  <span className="text-sm text-gray-700 text-right">{fmt(item.unitPrice)} €</span>
                  <span className="text-sm font-semibold text-gray-900 text-right">{fmt(item.total)} €</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="flex justify-end px-5 py-4 border-t border-gray-100 bg-gray-50/30">
              <div className="w-56 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Nettobetrag</span>
                  <span className="font-medium">{fmt(invoice.subtotal)} €</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>MwSt. ({Math.round(invoice.vatRate * 100)} %)</span>
                  <span className="font-medium">{fmt(invoice.vatAmount)} €</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Gesamtbetrag</span>
                  <span>{fmt(invoice.totalAmount)} €</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contact info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Empfänger</h2>
        <div className="space-y-1 text-sm text-gray-700">
          <p className="font-medium">{invoice.contact.companyName}</p>
          {invoice.contact.contactPerson && <p>{invoice.contact.contactPerson}</p>}
          {invoice.contact.address && <p>{invoice.contact.address}</p>}
          {(invoice.contact.postalCode || invoice.contact.city) && (
            <p>{invoice.contact.postalCode} {invoice.contact.city}</p>
          )}
          {invoice.contact.email && (
            <p className="text-blue-600">
              <a href={`mailto:${invoice.contact.email}`}>{invoice.contact.email}</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
