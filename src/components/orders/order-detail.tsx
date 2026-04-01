"use client";

import { useState, useEffect, Suspense } from "react";
import { useTabLabels } from "@/hooks/use-tab-labels";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, Pencil, FileUp, Receipt, User, MapPin, Euro, CalendarDays, ClipboardList, HardHat, Plus, CheckCircle, Trash2, Activity, FileText } from "lucide-react";
import { OrderActivityTab } from "./order-activity-tab";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrderStatus, updateOrder } from "@/actions/orders";
import { createPaymentMilestone, updatePaymentMilestone, markPaymentMilestonePaid, markPaymentMilestoneUnpaid, deletePaymentMilestone } from "@/actions/payment-milestones";
import type { Contact, Order, Quote, QuoteItem } from "@prisma/client";

type BaustelleSummary = {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  address: string | null;
  city: string | null;
};

type PaymentMilestoneSummary = {
  id: string;
  title: string;
  type: string;
  amount: number;
  dueDate: Date | null;
  status: string;
  paidAt: Date | null;
  assignedTo: string | null;
  notes: string | null;
  invoiceNumber: string | null;
  skontoPercent: number | null;
  skontoDays: number | null;
};

type OrderWithRelations = Order & {
  contact: Contact;
  quote: (Quote & { items: QuoteItem[] }) | null;
  baustellen: BaustelleSummary[];
  paymentMilestones: PaymentMilestoneSummary[];
};

const statusLabels: Record<string, string> = {
  PLANNED: "Geplant",
  ACTIVE: "Aktiv",
  PENDING: "Ausstehend",
  INVOICED: "In Abrechnung",
  COMPLETED: "Abgeschlossen",
};

const statusColors: Record<string, string> = {
  PLANNED: "border border-blue-200 text-blue-700 bg-blue-50",
  ACTIVE: "border border-green-300 text-green-700 bg-green-50",
  PENDING: "border border-red-300 text-red-700 bg-red-50",
  INVOICED: "border border-orange-300 text-orange-700 bg-orange-50",
  COMPLETED: "border border-gray-200 text-gray-500 bg-gray-50",
};

const TABS = [
  { key: "Details" as const, label: "Details", icon: ClipboardList },
  { key: "Baustellen" as const, label: "Baustellen", icon: HardHat },
  { key: "Leistungen" as const, label: "Leistungen", icon: Receipt },
  { key: "Zahlungen" as const, label: "Zahlungen", icon: Euro },
  { key: "Aktivität" as const, label: "Aktivität", icon: Activity },
];

function getEasterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function isAustrianHoliday(date: Date): boolean {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const fixed = [[1,1],[1,6],[5,1],[8,15],[10,26],[11,1],[12,8],[12,25],[12,26]];
  if (fixed.some(([fm, fd]) => m === fm && d === fd)) return true;
  const easter = getEasterSunday(y);
  const addDays = (base: Date, n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const movable = [addDays(easter, 1), addDays(easter, 39), addDays(easter, 49), addDays(easter, 60)];
  return movable.some(md => md.getFullYear() === y && md.getMonth() + 1 === m && md.getDate() === d);
}

function nextWorkingDay(date: Date): Date {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6 || isAustrianHoliday(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

const typeLabels: Record<string, string> = {
  ANZAHLUNG: "Anzahlung",
  ZWISCHENRECHNUNG: "Zwischenrechnung",
  SCHLUSSRECHNUNG: "Schlussrechnung",
};
type Tab = typeof TABS[number]["key"];

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{children}</p>
      </div>
    </div>
  );
}

type UserSummary = { id: string; firstName: string; lastName: string };

export function OrderDetail({
  order,
  contacts,
  users = [],
  activity = [],
}: {
  order: OrderWithRelations;
  contacts: Contact[];
  users?: UserSummary[];
  activity?: import("@/actions/activity").ActivityEvent[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { containerRef: tabContainerRef, showLabels } = useTabLabels();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    const tabs: Tab[] = ["Details", "Leistungen", "Baustellen", "Zahlungen", "Aktivität"];
    return (tabs.includes(tab as Tab) ? tab : "Details") as Tab;
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(order.title);
  const [editStart, setEditStart] = useState(format(new Date(order.startDate), "yyyy-MM-dd'T'HH:mm"));
  const [editEnd, setEditEnd] = useState(format(new Date(order.endDate), "yyyy-MM-dd"));
  const [editNotes, setEditNotes] = useState(order.notes ?? "");
  const [editStatus, setEditStatus] = useState(order.status);

  // Payment milestone state
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMilestone, setEditMilestone] = useState<{ title: string; type: "ANZAHLUNG" | "ZWISCHENRECHNUNG" | "SCHLUSSRECHNUNG"; amount: string; dueDate: string; assignedTo: string; notes: string; invoiceNumber: string; skontoPercent: string; skontoDays: string } | null>(null);
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(() => searchParams.get("neu") === "1");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneType, setMilestoneType] = useState<"ANZAHLUNG" | "ZWISCHENRECHNUNG" | "SCHLUSSRECHNUNG">("ANZAHLUNG");
  const [milestoneAmount, setMilestoneAmount] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [milestoneAssignedTo, setMilestoneAssignedTo] = useState("");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [milestonePercent, setMilestonePercent] = useState("");
  const [milestoneInvoiceNumber, setMilestoneInvoiceNumber] = useState("");
  const [milestoneSkontoPercent, setMilestoneSkontoPercent] = useState("");
  const [milestoneSkontoDays, setMilestoneSkontoDays] = useState("");
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [payingMilestoneId, setPayingMilestoneId] = useState<string | null>(null);
  const [payingDate, setPayingDate] = useState("");

  useEffect(() => {
    if (searchParams.get("neu") === "1" && totalPrice) {
      setMilestoneAmount(String(Math.round(totalPrice * 0.2 * 100) / 100));
      setMilestonePercent("20");
      const base = new Date();
      base.setDate(base.getDate() + 14);
      setMilestoneDueDate(format(nextWorkingDay(base), "yyyy-MM-dd"));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true);
    await updateOrder(order.id, {
      title: editTitle,
      contactId: order.contactId,
      startDate: editStart,
      endDate: editEnd,
      notes: editNotes,
    });
    if (editStatus !== order.status) {
      await updateOrderStatus(order.id, editStatus as "PLANNED" | "ACTIVE" | "COMPLETED");
    }
    toast.success("Auftrag gespeichert");
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleAddMilestone() {
    if (!milestoneTitle || !milestoneAmount) return;
    setAddingMilestone(true);
    await createPaymentMilestone(order.id, {
      title: milestoneTitle,
      type: milestoneType,
      amount: parseFloat(milestoneAmount.replace(",", ".")),
      dueDate: milestoneDueDate || undefined,
      notes: milestoneNotes || undefined,
      invoiceNumber: milestoneInvoiceNumber || undefined,
      skontoPercent: milestoneSkontoPercent ? parseFloat(milestoneSkontoPercent) : undefined,
      skontoDays: milestoneSkontoDays ? parseInt(milestoneSkontoDays) : undefined,
    });
    toast.success("Zahlungsmeilenstein hinzugefügt");
    setMilestoneTitle("");
    setMilestoneAmount("");
    setMilestoneDueDate("");
    setMilestoneAssignedTo("");
    setMilestoneNotes("");
    setMilestoneType("ANZAHLUNG");
    setMilestonePercent("");
    setMilestoneInvoiceNumber("");
    setMilestoneSkontoPercent("");
    setMilestoneSkontoDays("");
    setShowAddMilestone(false);
    setAddingMilestone(false);
    router.refresh();
  }

  function startEditMilestone(m: PaymentMilestoneSummary) {
    setEditingMilestoneId(m.id);
    setEditMilestone({
      title: m.title,
      type: m.type as "ANZAHLUNG" | "ZWISCHENRECHNUNG" | "SCHLUSSRECHNUNG",
      amount: String(m.amount),
      dueDate: m.dueDate ? format(new Date(m.dueDate), "yyyy-MM-dd") : "",
      assignedTo: m.assignedTo ?? "",
      notes: m.notes ?? "",
      invoiceNumber: m.invoiceNumber ?? "",
      skontoPercent: m.skontoPercent != null ? String(m.skontoPercent) : "",
      skontoDays: m.skontoDays != null ? String(m.skontoDays) : "",
    });
  }

  async function handleSaveMilestone(milestoneId: string) {
    if (!editMilestone) return;
    setSavingMilestone(true);
    await updatePaymentMilestone(milestoneId, order.id, {
      title: editMilestone.title,
      type: editMilestone.type,
      amount: parseFloat(editMilestone.amount.replace(",", ".")),
      dueDate: editMilestone.dueDate || undefined,
      assignedTo: editMilestone.assignedTo || undefined,
      notes: editMilestone.notes || undefined,
      invoiceNumber: editMilestone.invoiceNumber || undefined,
      skontoPercent: editMilestone.skontoPercent ? parseFloat(editMilestone.skontoPercent) : undefined,
      skontoDays: editMilestone.skontoDays ? parseInt(editMilestone.skontoDays) : undefined,
    });
    toast.success("Meilenstein gespeichert");
    setEditingMilestoneId(null);
    setEditMilestone(null);
    setSavingMilestone(false);
    router.refresh();
  }

  async function handleMarkPaid(milestoneId: string, date: string) {
    await markPaymentMilestonePaid(milestoneId, order.id, date);
    toast.success("Als bezahlt markiert");
    setPayingMilestoneId(null);
    setPayingDate("");
    router.refresh();
  }

  async function handleMarkUnpaid(milestoneId: string) {
    await markPaymentMilestoneUnpaid(milestoneId, order.id);
    toast.success("Status auf Offen zurückgesetzt");
    router.refresh();
  }

  async function handleDeleteMilestone(milestoneId: string) {
    await deletePaymentMilestone(milestoneId, order.id);
    toast.success("Meilenstein gelöscht");
    router.refresh();
  }

  async function handleApplyTemplate(template: "30/70" | "30/40/30") {
    if (!totalPrice) return;
    setAddingTemplate(true);
    const today = new Date();
    const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
    const due1 = format(nextWorkingDay(addDays(14)), "yyyy-MM-dd");
    const due2 = format(nextWorkingDay(addDays(45)), "yyyy-MM-dd");
    const due3 = format(nextWorkingDay(addDays(90)), "yyyy-MM-dd");
    if (template === "30/70") {
      await createPaymentMilestone(order.id, { title: "Anzahlung 30%", type: "ANZAHLUNG", amount: Math.round(totalPrice * 0.3 * 100) / 100, dueDate: due1 });
      await createPaymentMilestone(order.id, { title: "Schlussrechnung 70%", type: "SCHLUSSRECHNUNG", amount: Math.round(totalPrice * 0.7 * 100) / 100, dueDate: due3 });
    } else {
      await createPaymentMilestone(order.id, { title: "Anzahlung 30%", type: "ANZAHLUNG", amount: Math.round(totalPrice * 0.3 * 100) / 100, dueDate: due1 });
      await createPaymentMilestone(order.id, { title: "Zwischenrechnung 40%", type: "ZWISCHENRECHNUNG", amount: Math.round(totalPrice * 0.4 * 100) / 100, dueDate: due2 });
      await createPaymentMilestone(order.id, { title: "Schlussrechnung 30%", type: "SCHLUSSRECHNUNG", amount: Math.round(totalPrice * 0.3 * 100) / 100, dueDate: due3 });
    }
    toast.success("Zahlungsplan angelegt");
    setAddingTemplate(false);
    router.refresh();
  }

  const totalPrice = order.quote ? Number(order.quote.totalPrice) : null;
  const paidAmount = order.paymentMilestones.filter(m => m.status === "BEZAHLT").reduce((s, m) => s + m.amount, 0);
  const milestoneTotal = order.paymentMilestones.reduce((s, m) => s + m.amount, 0);
  const openAmount = milestoneTotal - paidAmount;
  const unplannedAmount = totalPrice != null ? totalPrice - milestoneTotal : null;
  const sortedMilestones = [...order.paymentMilestones].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
  const overdueCount = order.paymentMilestones.filter(m => m.status === "OFFEN" && m.dueDate && new Date(m.dueDate) < new Date()).length;

  const quoteItems = order.quote?.items ?? [];

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <Link href="/auftraege" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />Zurück zu Aufträge
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{order.title}</h1>
              <StatusBadge status={order.status} />
            </div>
            <Link href={`/kontakte/${order.contact.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors mt-1">
              <User className="h-3.5 w-3.5" />
              {order.contact.companyName}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {editing && (
              <>
                <Button variant="outline" className="rounded-lg" onClick={() => setEditing(false)}>Abbrechen</Button>
                <LoadingButton className="rounded-lg" onClick={handleSave} loading={saving}>
                  Speichern
                </LoadingButton>
              </>
            )}
            {order.quote && (
              <Button
                variant="outline"
                className="rounded-lg gap-1.5"
                onClick={() => window.open(`/api/pdf/quote/${order.quote!.id}`, "_blank")}
              >
                <FileUp className="h-3.5 w-3.5" />Dokument
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-lg gap-1.5"
              onClick={() => { setActiveTab("Zahlungen"); setShowAddMilestone(true); }}
            >
              <Receipt className="h-3.5 w-3.5" />Zahlungsplan
            </Button>
            <Button
              className="rounded-lg gap-1.5"
              onClick={() => router.push(`/rechnungen/neu?orderId=${order.id}`)}
            >
              <FileText className="h-3.5 w-3.5" />Rechnung erstellen
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4 border-b border-gray-100 bg-gray-50/60">
        <StatCard label="Status">
          <StatusBadge status={order.status} />
        </StatCard>
        <StatCard label="Auftragssumme">
          <span className="text-xl font-bold text-gray-900">
            {totalPrice !== null
              ? totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
              : "–"}
          </span>
        </StatCard>
      </div>

      {/* ── Tabs ── */}
      <div className="overflow-x-auto border-b border-gray-200 bg-white">
      <div ref={tabContainerRef} className="px-4 md:px-6 flex gap-1 min-w-max md:min-w-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            title={label}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span data-tab-label className={showLabels ? "inline" : "hidden"}>{label}</span>
            {key === "Zahlungen" && overdueCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            )}
          </button>
        ))}
      </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 p-6">
        {activeTab === "Details" && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl">
            {/* Auftragsinformationen */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">Auftragsinformationen</h3>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-gray-600 transition-colors" title="Bearbeiten">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              {editing ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Projektname</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</Label>
                    <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                      <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                        <SelectValue>{statusLabels[editStatus]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
                    <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="h-10 rounded-lg border-gray-200" />
                  </div>
                </div>
              ) : (
                <div>
                  <InfoItem icon={ClipboardList} label="Projektname">{order.title}</InfoItem>
                  <InfoItem icon={User} label="Kontakt">
                    <Link href={`/kontakte/${order.contact.id}`} className="text-blue-600 hover:underline">
                      {order.contact.companyName}
                    </Link>
                  </InfoItem>
                  <InfoItem icon={MapPin} label="Baustellenadresse">
                    {order.quote?.siteAddress ?? "–"}
                  </InfoItem>
                  <InfoItem icon={Euro} label="Auftragssumme">
                    {totalPrice !== null
                      ? totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                      : "–"}
                  </InfoItem>
                  {order.notes && (
                    <InfoItem icon={ClipboardList} label="Notizen">{order.notes}</InfoItem>
                  )}
                </div>
              )}
            </div>

            {order.quote && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Verknüpftes Angebot</h3>
                <Link href={`/angebote/${order.quote.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                  {order.quote.quoteNumber}
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "Leistungen" && (
          <div className="max-w-4xl">
            {order.quote && order.quote.items.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-100 bg-gray-50/80">
                      <th className="text-left px-5 py-2.5">Pos.</th>
                      <th className="text-left px-5 py-2.5">Beschreibung</th>
                      <th className="text-right px-5 py-2.5">Menge</th>
                      <th className="text-left px-5 py-2.5">Einh.</th>
                      <th className="text-right px-5 py-2.5">EP €</th>
                      <th className="text-right px-5 py-2.5">GP €</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.quote.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-400 font-mono text-xs">{item.position}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">{item.description}</td>
                        <td className="px-5 py-3 text-right font-mono">{Number(item.quantity).toLocaleString("de-DE")}</td>
                        <td className="px-5 py-3 text-gray-500">{item.unit}</td>
                        <td className="px-5 py-3 text-right font-mono">{Number(item.unitPrice).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">{Number(item.total).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={4} />
                      <td className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gesamt (netto)</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-gray-900">
                        {Number(order.quote.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-400">
                <p className="text-sm">Keine Leistungen verknüpft</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "Baustellen" && (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                Baustellen ({order.baustellen.length})
              </h3>
              <Link href={`/baustellen/neu?orderId=${order.id}`}>
                <Button className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Neue Baustelle
                </Button>
              </Link>
            </div>
            {order.baustellen.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <HardHat className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm font-medium text-gray-500">Noch keine Baustellen</p>
                <p className="text-xs text-gray-400 mt-1">Erstelle die erste Baustelle für diesen Auftrag.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_80px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  {["Baustellenname", "Status", "Start", "Ende", ""].map((h) => (
                    <span key={h} className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{h}</span>
                  ))}
                </div>
                {order.baustellen.map((b, i) => {
                  const statusColors: Record<string, string> = {
                    PLANNED: "bg-gray-100 text-gray-600",
                    ACTIVE: "bg-blue-50 text-blue-700",
                    PENDING: "bg-red-50 text-red-700",
                    INVOICED: "bg-orange-50 text-orange-700",
                    COMPLETED: "bg-green-50 text-green-700",
                  };
                  const statusLabelsB: Record<string, string> = {
                    PLANNED: "Geplant", ACTIVE: "Aktiv", PENDING: "Ausstehend", INVOICED: "In Abrechnung", COMPLETED: "Abgeschlossen",
                  };
                  return (
                    <div key={b.id} className={`grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_80px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${i !== order.baustellen.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                        {(b.address || b.city) && (
                          <p className="text-xs text-gray-400 truncate">{[b.address, b.city].filter(Boolean).join(", ")}</p>
                        )}
                      </div>
                      <span className={`inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[b.status]}`}>
                        {statusLabelsB[b.status]}
                      </span>
                      <span className="text-sm text-gray-500">{format(new Date(b.startDate), "dd.MM.yyyy", { locale: de })}</span>
                      <span className="text-sm text-gray-500">{b.endDate ? format(new Date(b.endDate), "dd.MM.yyyy", { locale: de }) : "–"}</span>
                      <div className="flex justify-end">
                        <Link href={`/baustellen/${b.id}`} className="text-gray-300 hover:text-blue-600 transition-colors" title="Bearbeiten">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "Zahlungen" && (
          <div className="max-w-4xl space-y-5">

            {/* ── Summary ── */}
            {order.paymentMilestones.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-1">Geplant</p>
                    <p className="text-2xl font-bold text-gray-900">{milestoneTotal.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-1">Eingegangen</p>
                    <p className="text-2xl font-bold text-green-600">{paidAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-1">Ausstehend</p>
                    <p className="text-2xl font-bold text-amber-500">{openAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: milestoneTotal > 0 ? `${Math.round((paidAmount / milestoneTotal) * 100)}%` : "0%" }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {milestoneTotal > 0 ? Math.round((paidAmount / milestoneTotal) * 100) : 0}% bezahlt
                </p>
                {totalPrice != null && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all duration-500"
                        style={{ width: totalPrice > 0 ? `${Math.min(Math.round((milestoneTotal / totalPrice) * 100), 100)}%` : "0%" }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {milestoneTotal.toLocaleString("de-DE", { style: "currency", currency: "EUR" })} von {totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })} Auftragswert verplant ({totalPrice > 0 ? Math.round((milestoneTotal / totalPrice) * 100) : 0}%)
                    </p>
                  </div>
                )}
              </div>
            )}

            {order.paymentMilestones.length === 0 && totalPrice != null && (
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-5 py-3.5 flex items-center gap-3">
                <Euro className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  Auftragswert: <span className="font-semibold text-gray-900">{totalPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                  <span className="text-gray-400 ml-2">· Noch nichts verplant</span>
                </p>
              </div>
            )}

            {/* ── Card ── */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Zahlungsplan</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{order.paymentMilestones.length} Meilenstein{order.paymentMilestones.length !== 1 ? "e" : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {totalPrice && (
                    <>
                      <button
                        onClick={() => handleApplyTemplate("30/70")}
                        disabled={addingTemplate}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        30/70 ⚡
                      </button>
                      <button
                        onClick={() => handleApplyTemplate("30/40/30")}
                        disabled={addingTemplate}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        30/40/30 ⚡
                      </button>
                      <div className="w-px h-4 bg-gray-200" />
                    </>
                  )}
                  <Button
                    size="sm"
                    className="rounded-lg gap-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 h-9 px-3.5 text-sm font-semibold shadow-sm"
                    onClick={() => {
                      if (!showAddMilestone) {
                        if (totalPrice) {
                          setMilestoneAmount(String(Math.round(totalPrice * 0.2 * 100) / 100));
                          setMilestonePercent("20");
                        }
                        const base = new Date();
                        base.setDate(base.getDate() + 14);
                        setMilestoneDueDate(format(nextWorkingDay(base), "yyyy-MM-dd"));
                      }
                      setShowAddMilestone(!showAddMilestone);
                    }}
                  >
                    <Plus className="h-4 w-4" />Hinzufügen
                  </Button>
                </div>
              </div>

              {/* Add form */}
              {showAddMilestone && (
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/40 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Bezeichnung *</Label>
                      <Input value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} placeholder="z.B. Anzahlung 30%" className="h-10 rounded-lg border-gray-200 bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Typ</Label>
                      <Select value={milestoneType} onValueChange={(v) => {
                        const t = v as typeof milestoneType;
                        setMilestoneType(t);
                        if (t === "ANZAHLUNG" && totalPrice) {
                          setMilestoneAmount(String(Math.round(totalPrice * 0.2 * 100) / 100));
                          setMilestonePercent("20");
                        } else if ((t === "ZWISCHENRECHNUNG" || t === "SCHLUSSRECHNUNG") && unplannedAmount != null && unplannedAmount > 0) {
                          setMilestoneAmount(String(Math.round(unplannedAmount * 100) / 100));
                          if (totalPrice) setMilestonePercent(String(Math.round(unplannedAmount / totalPrice * 1000) / 10));
                        }
                      }}>
                        <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-white w-full"><SelectValue>{typeLabels[milestoneType]}</SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ANZAHLUNG">Anzahlung</SelectItem>
                          <SelectItem value="ZWISCHENRECHNUNG">Zwischenrechnung</SelectItem>
                          <SelectItem value="SCHLUSSRECHNUNG">Schlussrechnung</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Betrag *</Label>
                      <div className="flex h-10 rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                        <input
                          type="number"
                          value={milestoneAmount}
                          onChange={(e) => {
                            setMilestoneAmount(e.target.value);
                            if (totalPrice && e.target.value) setMilestonePercent(String(Math.round(parseFloat(e.target.value) / totalPrice * 1000) / 10));
                            else setMilestonePercent("");
                          }}
                          placeholder="0.00"
                          className="flex-1 min-w-0 px-3 text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        {totalPrice && (
                          <div className="flex items-center border-l border-gray-200 px-2.5 gap-1 flex-shrink-0">
                            <input
                              type="number"
                              value={milestonePercent}
                              onChange={(e) => {
                                setMilestonePercent(e.target.value);
                                if (totalPrice && e.target.value) setMilestoneAmount(String(Math.round(totalPrice * parseFloat(e.target.value) / 100 * 100) / 100));
                              }}
                              placeholder="—"
                              className="w-9 text-sm text-gray-500 bg-transparent outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-sm text-gray-400">%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Fällig am</Label>
                      <Input type="date" value={milestoneDueDate} onChange={(e) => setMilestoneDueDate(e.target.value)} className="h-10 rounded-lg border-gray-200 bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Zugewiesen an</Label>
                      <Select value={milestoneAssignedTo} onValueChange={(v) => setMilestoneAssignedTo(v === "_none" ? "" : (v ?? ""))}>
                        <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-white w-full"><SelectValue placeholder="Niemand" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Niemand</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={`${u.firstName} ${u.lastName}`.trim()}>{u.firstName} {u.lastName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Rechnungs-Nr.</Label>
                      <Input value={milestoneInvoiceNumber} onChange={(e) => setMilestoneInvoiceNumber(e.target.value)} placeholder="z.B. RE-2024-001" className="h-10 rounded-lg border-gray-200 bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Skonto</Label>
                      <div className="flex h-10 rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                        <input type="number" value={milestoneSkontoPercent} onChange={(e) => setMilestoneSkontoPercent(e.target.value)} placeholder="z.B. 2" className="flex-1 min-w-0 px-3 text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="flex items-center pr-3 text-sm text-gray-400 flex-shrink-0">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Skonto Frist</Label>
                      <div className="flex h-10 rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                        <input type="number" value={milestoneSkontoDays} onChange={(e) => setMilestoneSkontoDays(e.target.value)} placeholder="z.B. 10" className="flex-1 min-w-0 px-3 text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="flex items-center pr-3 text-sm text-gray-400 flex-shrink-0 whitespace-nowrap">Tage</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notiz</Label>
                    <Input value={milestoneNotes} onChange={(e) => setMilestoneNotes(e.target.value)} placeholder="Optionale Anmerkung zur Zahlung..." className="h-10 rounded-lg border-gray-200 bg-white" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button className="rounded-lg h-10 px-4" onClick={handleAddMilestone} disabled={addingMilestone || !milestoneTitle || !milestoneAmount}>
                      {addingMilestone ? "Speichert..." : "Meilenstein speichern"}
                    </Button>
                    <Button variant="outline" className="rounded-lg h-10 px-4" onClick={() => setShowAddMilestone(false)}>Abbrechen</Button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {order.paymentMilestones.length === 0 && !showAddMilestone && (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Euro className="h-6 w-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Kein Zahlungsplan</p>
                  <p className="text-xs text-gray-400 mt-1">Füge Anzahlungen, Zwischenrechnungen oder eine Schlussrechnung hinzu.</p>
                </div>
              )}

              {/* Milestone list */}
              {order.paymentMilestones.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {sortedMilestones.map((m) => {
                    const isOverdue = m.status === "OFFEN" && m.dueDate && new Date(m.dueDate) < new Date();
                    return (
                      <div key={m.id} className="px-6 py-4">
                        {editingMilestoneId === m.id && editMilestone ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Bezeichnung</Label>
                                <Input value={editMilestone.title} onChange={(e) => setEditMilestone({ ...editMilestone, title: e.target.value })} className="h-10 rounded-lg border-gray-200" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Typ</Label>
                                <Select value={editMilestone.type} onValueChange={(v) => setEditMilestone({ ...editMilestone, type: v as typeof editMilestone.type })}>
                                  <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full"><SelectValue>{typeLabels[editMilestone.type]}</SelectValue></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ANZAHLUNG">Anzahlung</SelectItem>
                                    <SelectItem value="ZWISCHENRECHNUNG">Zwischenrechnung</SelectItem>
                                    <SelectItem value="SCHLUSSRECHNUNG">Schlussrechnung</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Betrag €</Label>
                                <Input type="number" value={editMilestone.amount} onChange={(e) => setEditMilestone({ ...editMilestone, amount: e.target.value })} className="h-10 rounded-lg border-gray-200" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Fällig am</Label>
                                <Input type="date" value={editMilestone.dueDate} onChange={(e) => setEditMilestone({ ...editMilestone, dueDate: e.target.value })} className="h-10 rounded-lg border-gray-200" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Zugewiesen an</Label>
                                <Select value={editMilestone.assignedTo} onValueChange={(v) => setEditMilestone({ ...editMilestone, assignedTo: v === "_none" ? "" : (v ?? "") })}>
                                  <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full"><SelectValue placeholder="Niemand" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="_none">Niemand</SelectItem>
                                    {users.map((u) => (
                                      <SelectItem key={u.id} value={`${u.firstName} ${u.lastName}`.trim()}>{u.firstName} {u.lastName}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Rechnungs-Nr.</Label>
                                <Input value={editMilestone.invoiceNumber} onChange={(e) => setEditMilestone({ ...editMilestone, invoiceNumber: e.target.value })} placeholder="z.B. RE-2024-001" className="h-10 rounded-lg border-gray-200" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Skonto</Label>
                                <div className="flex h-10 rounded-lg border border-gray-200 overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                                  <input type="number" value={editMilestone.skontoPercent} onChange={(e) => setEditMilestone({ ...editMilestone, skontoPercent: e.target.value })} placeholder="z.B. 2" className="flex-1 min-w-0 px-3 text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                  <span className="flex items-center pr-3 text-sm text-gray-400 flex-shrink-0">%</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Skonto Frist</Label>
                                <div className="flex h-10 rounded-lg border border-gray-200 overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                                  <input type="number" value={editMilestone.skontoDays} onChange={(e) => setEditMilestone({ ...editMilestone, skontoDays: e.target.value })} placeholder="z.B. 10" className="flex-1 min-w-0 px-3 text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                  <span className="flex items-center pr-3 text-sm text-gray-400 flex-shrink-0 whitespace-nowrap">Tage</span>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notiz</Label>
                              <Input value={editMilestone.notes} onChange={(e) => setEditMilestone({ ...editMilestone, notes: e.target.value })} placeholder="Optionale Anmerkung..." className="h-10 rounded-lg border-gray-200" />
                            </div>
                            <div className="flex gap-2">
                              <Button className="rounded-lg h-10 px-4" onClick={() => handleSaveMilestone(m.id)} disabled={savingMilestone}>
                                {savingMilestone ? "Speichert..." : "Änderungen speichern"}
                              </Button>
                              <Button variant="outline" className="rounded-lg h-10 px-4" onClick={() => { setEditingMilestoneId(null); setEditMilestone(null); }}>Abbrechen</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-4">
                            {/* Status dot */}
                            <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.status === "BEZAHLT" ? "bg-green-500" : isOverdue ? "bg-red-500" : "bg-amber-400"}`} />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                      m.type === "ANZAHLUNG" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                      m.type === "ZWISCHENRECHNUNG" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                      "bg-gray-50 text-gray-600 border-gray-200"
                                    }`}>{typeLabels[m.type]}</span>
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                      m.status === "BEZAHLT" ? "bg-green-50 text-green-700 border-green-200" :
                                      isOverdue ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}>
                                      {m.status === "BEZAHLT" ? "✓ Bezahlt" : isOverdue ? "Überfällig" : "Offen"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    {m.dueDate && (
                                      <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                                        Fällig: {format(new Date(m.dueDate), "dd. MMMM yyyy", { locale: de })}
                                      </span>
                                    )}
                                    {m.assignedTo && (
                                      <span className="text-xs text-gray-400">· {m.assignedTo}</span>
                                    )}
                                    {m.paidAt && (
                                      <span className="text-xs text-gray-400">· Bezahlt am {format(new Date(m.paidAt), "dd.MM.yyyy", { locale: de })}</span>
                                    )}
                                  </div>
                                  {m.notes && (
                                    <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded-lg px-3 py-1.5 italic">{m.notes}</p>
                                  )}
                                  {(m.invoiceNumber || (m.skontoPercent && m.skontoDays)) && (
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                      {m.invoiceNumber && (
                                        <span className="text-xs text-gray-500 font-mono">#{m.invoiceNumber}</span>
                                      )}
                                      {m.skontoPercent && m.skontoDays && (
                                        <span className="text-xs text-blue-600">{m.skontoPercent}% Skonto / {m.skontoDays} Tage</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <p className="text-base font-bold text-gray-900 font-mono">{m.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => startEditMilestone(m)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors" title="Bearbeiten">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    {!m.invoiceNumber && (
                                      <Link href={`/rechnungen/neu?orderId=${order.id}&milestoneId=${m.id}`} className="w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors" title="Rechnung erstellen">
                                        <FileText className="h-3.5 w-3.5" />
                                      </Link>
                                    )}
                                    {m.status === "OFFEN" ? (
                                      <button onClick={() => { setPayingMilestoneId(m.id); setPayingDate(format(new Date(), "yyyy-MM-dd")); }} className="w-7 h-7 rounded-lg hover:bg-green-50 flex items-center justify-center text-gray-400 hover:text-green-600 transition-colors" title="Als bezahlt markieren">
                                        <CheckCircle className="h-4 w-4" />
                                      </button>
                                    ) : (
                                      <button onClick={() => handleMarkUnpaid(m.id)} className="w-7 h-7 rounded-lg hover:bg-amber-50 flex items-center justify-center text-green-500 hover:text-amber-600 transition-colors" title="Zahlung rückgängig">
                                        <CheckCircle className="h-4 w-4" />
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteMilestone(m.id)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors" title="Löschen">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {payingMilestoneId === m.id && (
                                <div className="mt-3 flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                  <span className="text-xs font-medium text-green-800">Zahlungseingang:</span>
                                  <Input
                                    type="date"
                                    value={payingDate}
                                    onChange={(e) => setPayingDate(e.target.value)}
                                    className="h-8 rounded-lg border-gray-200 bg-white w-40 text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    className="rounded-lg bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs"
                                    onClick={() => handleMarkPaid(m.id, payingDate)}
                                  >
                                    Bestätigen
                                  </Button>
                                  <button
                                    onClick={() => { setPayingMilestoneId(null); setPayingDate(""); }}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    Abbrechen
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "Aktivität" && (
          <OrderActivityTab events={activity} />
        )}
      </div>
    </div>
  );
}
