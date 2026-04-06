"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Check, Pencil, X, Mail, Truck, Receipt, CalendarCheck, Circle, CheckCircle2, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ProcessStepperProps {
  onQuoteSendEmail?: () => void;
  // Anfrage
  requestId?: string | null;
  requestCreatedAt?: string | null;
  // Besichtigung
  inspectionDone?: boolean;
  inspectionPlanned?: boolean;
  inspectionDate?: string | null;
  noInspectionRequired?: boolean;
  // Angebot
  quoteId?: string | null;
  quoteCreatedAt?: string | null;
  quoteStatus?: string | null;
  contactId?: string | null;
  onQuoteStatusChange?: (status: "SENT" | "ACCEPTED" | "REJECTED") => Promise<void>;
  // Auftrag
  orderId?: string | null;
  orderCreatedAt?: string | null;
  orderStatus?: string | null;
  onOrderStatusChange?: (status: "OPEN" | "DISPONIERT" | "IN_LIEFERUNG" | "VERRECHNET" | "ABGESCHLOSSEN") => Promise<void>;
}

function fmt(date: string | null | undefined) {
  if (!date) return "–";
  return format(new Date(date), "dd. MMM", { locale: de });
}

// ── Quote Step ────────────────────────────────────────────────────────────────

function QuoteStepCircle({ status }: { status: string | null | undefined }) {
  if (!status || status === "DRAFT") {
    return (
      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
        <Pencil className="h-3 w-3 text-gray-500" />
      </div>
    );
  }
  if (status === "SENT") {
    return (
      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
        <Mail className="h-3 w-3 text-white" />
      </div>
    );
  }
  if (status === "ACCEPTED") {
    return (
      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
        <Check className="h-3 w-3 text-white" />
      </div>
    );
  }
  // REJECTED
  return (
    <div className="w-6 h-6 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
      <X className="h-3 w-3 text-white" />
    </div>
  );
}

function QuoteStepLabel({
  status,
  quoteId,
  quoteCreatedAt,
  onStatusChange,
  onSendEmail,
}: {
  status: string | null | undefined;
  quoteId: string;
  quoteCreatedAt: string | null | undefined;
  onStatusChange?: (status: "SENT" | "ACCEPTED" | "REJECTED") => Promise<void>;
  onSendEmail?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDone = status === "ACCEPTED" || status === "REJECTED";

  async function handleSelect(newStatus: "SENT" | "ACCEPTED" | "REJECTED") {
    if (!onStatusChange) return;
    setLoading(true);
    setOpen(false);
    await onStatusChange(newStatus);
    setLoading(false);
  }

  const statusLabel: Record<string, string> = {
    DRAFT: "Entwurf",
    SENT: "Versendet",
    ACCEPTED: "Angenommen",
    REJECTED: "Abgelehnt",
  };

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      {onStatusChange && !isDone ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] font-semibold text-gray-700 mt-1.5 whitespace-nowrap hover:text-blue-600 transition-colors"
          disabled={loading}
        >
          Angebot
        </button>
      ) : (
        <Link
          href={`/angebote/${quoteId}`}
          className={`text-[11px] font-semibold mt-1.5 whitespace-nowrap hover:text-blue-600 transition-colors ${status === "REJECTED" ? "line-through text-red-400" : "text-gray-700"}`}
        >
          Angebot
        </Link>
      )}

      <span className={`text-[10px] whitespace-nowrap ${status === "REJECTED" ? "text-red-400" : "text-gray-400"}`}>
        {status ? statusLabel[status] : fmt(quoteCreatedAt)}
      </span>

      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
          {status === "DRAFT" && (
            <button
              onClick={() => { setOpen(false); onSendEmail?.(); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Per E-Mail senden
            </button>
          )}
          <button
            onClick={() => handleSelect("ACCEPTED")}
            className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors"
          >
            Angenommen
          </button>
          <button
            onClick={() => handleSelect("REJECTED")}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Abgelehnt
          </button>
        </div>
      )}
    </div>
  );
}

// ── Order Step ────────────────────────────────────────────────────────────────

const ORDER_STEPS: { key: string; label: string; shortLabel: string; icon: LucideIcon; color: string }[] = [
  { key: "OPEN",          label: "Offen",         shortLabel: "Offen",    icon: Circle,       color: "text-zinc-500" },
  { key: "DISPONIERT",    label: "Disponiert",    shortLabel: "Dispo",    icon: CalendarCheck, color: "text-blue-600" },
  { key: "IN_LIEFERUNG",  label: "In Lieferung",  shortLabel: "Liefer.",  icon: Truck,        color: "text-emerald-600" },
  { key: "VERRECHNET",    label: "Verrechnet",    shortLabel: "Verrech.", icon: Receipt,      color: "text-emerald-700" },
  { key: "ABGESCHLOSSEN", label: "Abgeschlossen", shortLabel: "Fertig",   icon: CheckCircle2, color: "text-green-700" },
];

function orderStatusCircleClass(status: string | null | undefined) {
  switch (status) {
    case "OPEN":          return "bg-zinc-400";
    case "DISPONIERT":    return "bg-blue-500";
    case "IN_LIEFERUNG":  return "bg-emerald-400";
    case "VERRECHNET":    return "bg-emerald-600";
    case "ABGESCHLOSSEN": return "bg-green-600";
    default:              return "bg-zinc-400";
  }
}

function OrderStepCircle({ status }: { status: string | null | undefined }) {
  const colorClass = orderStatusCircleClass(status);
  const icon = () => {
    switch (status) {
      case "IN_LIEFERUNG":  return <Truck className="h-3 w-3 text-white" />;
      case "VERRECHNET":    return <Receipt className="h-3 w-3 text-white" />;
      case "ABGESCHLOSSEN": return <Check className="h-3 w-3 text-white" />;
      case "DISPONIERT":    return <CalendarCheck className="h-3 w-3 text-white" />;
      default:              return <span className="text-xs font-semibold text-white">4</span>;
    }
  };
  return (
    <div className={`w-6 h-6 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
      {icon()}
    </div>
  );
}

function OrderStepLabel({
  orderId,
  orderCreatedAt,
  status,
  onStatusChange,
}: {
  orderId: string;
  orderCreatedAt: string | null | undefined;
  status: string | null | undefined;
  onStatusChange?: (status: "OPEN" | "DISPONIERT" | "IN_LIEFERUNG" | "VERRECHNET" | "ABGESCHLOSSEN") => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSelect(newStatus: "OPEN" | "DISPONIERT" | "IN_LIEFERUNG" | "VERRECHNET" | "ABGESCHLOSSEN") {
    if (!onStatusChange || newStatus === status) return;
    setLoading(true);
    setOpen(false);
    await onStatusChange(newStatus);
    setLoading(false);
  }

  const currentIdx = ORDER_STEPS.findIndex((s) => s.key === status);
  const currentLabel = ORDER_STEPS[currentIdx]?.label ?? "Offen";

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      {onStatusChange ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] font-semibold text-gray-700 mt-1.5 whitespace-nowrap hover:text-blue-600 transition-colors flex items-center gap-0.5"
          disabled={loading}
        >
          Auftrag
          <ChevronDown className="h-3 w-3 text-gray-400" />
        </button>
      ) : (
        <Link
          href={`/auftraege/${orderId}`}
          className="text-[11px] font-semibold text-gray-700 mt-1.5 whitespace-nowrap hover:text-blue-600 transition-colors"
        >
          Auftrag
        </Link>
      )}

      <span className="text-[10px] text-gray-400 whitespace-nowrap">
        {status ? currentLabel : fmt(orderCreatedAt)}
      </span>

      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px]">
          {ORDER_STEPS.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const StepIcon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => handleSelect(step.key as "OPEN" | "DISPONIERT" | "IN_LIEFERUNG" | "VERRECHNET" | "ABGESCHLOSSEN")}
                disabled={active}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  active ? "text-gray-400 cursor-default" :
                  done ? "text-gray-500 hover:bg-gray-50" :
                  "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <StepIcon className={`h-3.5 w-3.5 flex-shrink-0 ${done ? "text-green-500" : active ? step.color : "text-gray-300"}`} />
                {step.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const doneCircle = "w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0";
const activeCircle = "w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0";
const warnCircle = "w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0";
const skipCircle = "w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0";
const futureCircle = "w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0";

export function ProcessStepper({
  requestId,
  requestCreatedAt,
  inspectionDone = false,
  inspectionPlanned = false,
  inspectionDate,
  noInspectionRequired = false,
  quoteId,
  quoteCreatedAt,
  quoteStatus,
  contactId,
  onQuoteStatusChange,
  onQuoteSendEmail,
  orderId,
  orderCreatedAt,
  orderStatus,
  onOrderStatusChange,
}: ProcessStepperProps) {
  const hasRequest = !!requestId;
  const inspectionComplete = inspectionDone || noInspectionRequired;
  const hasQuote = !!quoteId;
  const hasOrder = !!orderId;
  const quoteRejected = quoteStatus === "REJECTED";

  return (
    <div className="flex items-start">

      {/* Step 1: Anfrage */}
      <div className="flex flex-col items-center">
        <div className={hasRequest ? doneCircle : activeCircle}>
          {hasRequest
            ? <Check className="h-3 w-3 text-white" />
            : <span className="text-xs font-semibold text-white">1</span>}
        </div>
        {requestId ? (
          <Link href={`/anfragen/${requestId}`} className="text-[11px] font-semibold text-gray-700 mt-1.5 whitespace-nowrap hover:text-blue-600 transition-colors">
            Anfrage
          </Link>
        ) : (
          <span className="text-[11px] font-semibold text-gray-700 mt-1.5 whitespace-nowrap">Anfrage</span>
        )}
        <span className="text-[10px] text-gray-400">{fmt(requestCreatedAt)}</span>
      </div>

      <div className={`flex-1 h-px mt-3 mx-3 ${inspectionComplete || inspectionPlanned ? "bg-green-300" : "bg-gray-200"}`} />

      {/* Step 2: Besichtigung */}
      <div className="flex flex-col items-center">
        <div className={inspectionDone ? doneCircle : inspectionPlanned ? warnCircle : noInspectionRequired ? skipCircle : futureCircle}>
          {inspectionDone
            ? <Check className="h-3 w-3 text-white" />
            : <span className={`text-xs font-semibold ${inspectionPlanned ? "text-white" : "text-gray-400"}`}>2</span>}
        </div>
        <span className="text-[11px] font-semibold text-gray-700 mt-1.5 whitespace-nowrap">Besichtigung</span>
        <span className="text-[10px] text-gray-400 whitespace-nowrap">
          {noInspectionRequired ? "Nicht nötig" : fmt(inspectionDate)}
        </span>
      </div>

      <div className={`flex-1 h-px mt-3 mx-3 ${quoteRejected ? "bg-red-200" : hasQuote ? "bg-green-300" : "bg-gray-200"}`} />

      {/* Step 3: Angebot */}
      <div className="flex flex-col items-center">
        <QuoteStepCircle status={hasQuote ? quoteStatus : null} />
        {hasQuote ? (
          <QuoteStepLabel
            status={quoteStatus}
            quoteId={quoteId}
            quoteCreatedAt={quoteCreatedAt}
            onStatusChange={onQuoteStatusChange}
            onSendEmail={onQuoteSendEmail}
          />
        ) : (
          <>
            <span className="text-[11px] font-semibold text-gray-700 mt-1.5 whitespace-nowrap">Angebot</span>
            {inspectionComplete && requestId && contactId ? (
              <Link href={`/angebote/neu?requestId=${requestId}&contactId=${contactId}`} className="text-[10px] text-blue-600 font-semibold hover:underline whitespace-nowrap">
                + Erstellen
              </Link>
            ) : (
              <span className="text-[10px] text-gray-400">–</span>
            )}
          </>
        )}
      </div>

      <div className={`flex-1 h-px mt-3 mx-3 ${quoteRejected ? "bg-red-200" : hasOrder ? "bg-green-300" : "bg-gray-200"}`} />

      {/* Step 4: Auftrag */}
      <div className="flex flex-col items-center">
        {hasOrder && !quoteRejected ? (
          <>
            <OrderStepCircle status={orderStatus} />
            <OrderStepLabel
              orderId={orderId}
              orderCreatedAt={orderCreatedAt}
              status={orderStatus}
              onStatusChange={onOrderStatusChange}
            />
          </>
        ) : (
          <>
            <div className={quoteRejected ? "w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 opacity-40" : futureCircle}>
              <span className={`text-xs font-semibold ${hasQuote && !quoteRejected ? "text-white" : "text-gray-400"}`}>4</span>
            </div>
            <span className={`text-[11px] font-semibold mt-1.5 whitespace-nowrap ${quoteRejected ? "text-gray-300" : "text-gray-700"}`}>
              Auftrag
            </span>
            <span className="text-[10px] text-gray-400">–</span>
          </>
        )}
      </div>

    </div>
  );
}
