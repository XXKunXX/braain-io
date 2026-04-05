"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  X,
  Search,
  Check,
  ChevronRight,
  Ban,
  Zap,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createRequest } from "@/actions/requests";
import { toast } from "sonner";
import type { Contact } from "@prisma/client";

// German phonetic normalization
function phonetize(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/ck/g, "k")
    .replace(/dt/g, "t")
    .replace(/tz/g, "z")
    .replace(/v/g, "f")
    .replace(/w/g, "f")
    .replace(/c([eiy])/g, "z$1")
    .replace(/c/g, "k")
    .replace(/(.)\1+/g, "$1");
}

function matchContact(c: Contact, query: string): boolean {
  if (!query) return true;
  const q = phonetize(query);
  return [c.companyName, c.firstName, c.lastName, c.city]
    .filter(Boolean)
    .some((f) => phonetize(f!).includes(q));
}

function getContactLabel(c: Contact): string {
  return c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ");
}

const QUICK_TAGS = ["Aushub", "Pflaster", "Transport", "Abbruch", "Sonstiges"];

interface BlitzAnfrageSheetProps {
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
}

type Step = "contact" | "title" | "inspection";

export function BlitzAnfrageSheet({
  open,
  onClose,
  contacts,
}: BlitzAnfrageSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("contact");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [title, setTitle] = useState("");
  const [noInspection, setNoInspection] = useState(false);
  const [inspectionDate, setInspectionDate] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const filteredContacts = contactSearch
    ? contacts.filter((c) => matchContact(c, contactSearch)).slice(0, 8)
    : contacts.slice(0, 6);

  // Reset + focus when opening
  useEffect(() => {
    if (open) {
      setStep("contact");
      setContactSearch("");
      setSelectedContact(null);
      setTitle("");
      setNoInspection(false);
      setInspectionDate("");
      setTimeout(() => searchRef.current?.focus(), 320);
    }
  }, [open]);

  // Focus title when step changes
  useEffect(() => {
    if (step === "title") {
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [step]);

  function handleContactSelect(contact: Contact) {
    setSelectedContact(contact);
    setStep("title");
  }

  function handleQuickTag(tag: string) {
    const newTitle = tag + " – ";
    setTitle(newTitle);
    setTimeout(() => {
      const input = titleRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(newTitle.length, newTitle.length);
      }
    }, 50);
  }

  function handleSave() {
    if (!selectedContact || !title.trim()) return;

    const parts = [
      selectedContact.address,
      selectedContact.postalCode && selectedContact.city
        ? `${selectedContact.postalCode} ${selectedContact.city}`
        : selectedContact.city,
    ].filter(Boolean);
    const siteAddress = parts.join(", ");
    const sitePhone = selectedContact.phone ?? "";

    startTransition(async () => {
      const result = await createRequest({
        title: title.trim(),
        contactId: selectedContact.id,
        siteAddress: siteAddress || undefined,
        sitePhone: sitePhone || undefined,
        noInspectionRequired: noInspection,
        inspectionDate:
          !noInspection && inspectionDate ? inspectionDate : undefined,
        inspectionStatus:
          !noInspection && inspectionDate ? "PLANNED" : undefined,
        status: "NEU",
        priority: "NORMAL",
      });

      if (result.error) {
        toast.error("Fehler beim Erstellen");
        return;
      }

      toast.success("Anfrage erstellt", {
        action: {
          label: "Details öffnen",
          onClick: () => router.push(`/anfragen/${result.request!.id}`),
        },
      });
      onClose();
      router.refresh();
    });
  }

  const canSave = !!selectedContact && !!title.trim();

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          "fixed left-0 right-0 z-50 md:!hidden",
          "bg-white rounded-t-[20px]",
          "transition-transform duration-300 ease-out",
          "shadow-[0_-12px_48px_rgba(0,0,0,0.18)]",
          open ? "translate-y-0" : "translate-y-full"
        )}
        style={{
          bottom: open ? "calc(64px + env(safe-area-inset-bottom))" : 0,
          maxHeight: "78vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Neue Anfrage
              </h2>
              {selectedContact && (
                <button
                  type="button"
                  onClick={() => {
                    setStep("contact");
                    setSelectedContact(null);
                    setTitle("");
                    setTimeout(() => searchRef.current?.focus(), 80);
                  }}
                  className="text-xs text-blue-600 font-medium"
                >
                  {getContactLabel(selectedContact)} &times;
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        {(() => {
          const steps: { key: Step; label: string }[] = [
            { key: "contact",    label: "Kontakt" },
            { key: "title",      label: "Titel" },
            { key: "inspection", label: "Besichtigung" },
          ];
          const currentIndex = steps.findIndex((s) => s.key === step);
          return (
            <div className="flex items-center gap-3 px-5 pb-4 flex-shrink-0">
              {steps.map(({ key, label }, i) => (
                <div key={key} className="flex-1 flex flex-col gap-1.5">
                  <div className={cn(
                    "h-1 rounded-full transition-colors duration-300",
                    i === currentIndex ? "bg-blue-600" : i < currentIndex ? "bg-blue-300" : "bg-gray-100"
                  )} />
                  <span className={cn(
                    "text-[11px] font-medium transition-colors duration-300",
                    i === currentIndex ? "text-blue-600" : i < currentIndex ? "text-blue-300" : "text-gray-300"
                  )}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── STEP 1: Contact ── */}
          {step === "contact" && (
            <div className="px-5 pb-6 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Kunden suchen..."
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>

              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {contactSearch ? "Suchergebnisse" : "Kontakte"}
              </p>

              <div className="space-y-1.5">
                {filteredContacts.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-gray-500 mb-3">
                      Kein Kontakt gefunden
                    </p>
                    <Link
                      href="/kontakte/neu?returnTo=/anfragen"
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium bg-blue-50 px-4 py-2 rounded-xl"
                    >
                      <Plus className="h-4 w-4" />
                      Neuen Kontakt anlegen
                    </Link>
                  </div>
                ) : (
                  filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleContactSelect(c)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 active:bg-blue-50 active:scale-[0.98] transition-all text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getContactLabel(c)}
                        </p>
                        {c.city && (
                          <p className="text-xs text-gray-400">{c.city}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 ml-2" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Title ── */}
          {step === "title" && (
            <div className="px-5 pb-6 space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                  Schnell-Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleQuickTag(tag)}
                      className="px-3.5 py-2 rounded-full bg-gray-100 text-sm font-medium text-gray-700 active:bg-blue-100 active:text-blue-700 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Was geht&apos;s? *
                </p>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Aushub 200m², Besichtigung besprochen…"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim()) setStep("inspection");
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (title.trim()) setStep("inspection");
                }}
                disabled={!title.trim()}
                className="w-full h-12 bg-blue-600 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Weiter →
              </button>
            </div>
          )}

          {/* ── STEP 3: Inspection ── */}
          {step === "inspection" && (
            <div className="px-5 pb-8 space-y-4">
              {/* Summary card */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider mb-1">
                  Anfrage
                </p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {title}
                </p>
                {selectedContact && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getContactLabel(selectedContact)}
                    {selectedContact.city ? ` — ${selectedContact.city}` : ""}
                  </p>
                )}
              </div>

              {/* Inspection toggle */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                  Besichtigung notwendig?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNoInspection(false)}
                    className={cn(
                      "flex-1 h-12 rounded-xl border-2 font-semibold text-sm transition-all",
                      !noInspection
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-400"
                    )}
                  >
                    Ja, nötig
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoInspection(true)}
                    className={cn(
                      "flex-1 h-12 rounded-xl border-2 font-semibold text-sm transition-all",
                      noInspection
                        ? "border-red-500 bg-red-500 text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-400"
                    )}
                  >
                    <Ban className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    Nicht nötig
                  </button>
                </div>
              </div>

              {/* Optional inspection date */}
              {!noInspection && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Termin (optional)
                  </p>
                  <input
                    type="datetime-local"
                    value={inspectionDate}
                    onFocus={() => {
                      if (!inspectionDate) {
                        const d = new Date();
                        const p = (n: number) => String(n).padStart(2, "0");
                        setInspectionDate(
                          `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T07:00`
                        );
                      }
                    }}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave || isPending}
                className="w-full h-13 bg-blue-600 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-xl font-semibold text-[15px] transition-colors flex items-center justify-center gap-2 mt-2"
                style={{ height: "52px" }}
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Anfrage speichern
              </button>

              <button
                type="button"
                onClick={() => setStep("title")}
                className="w-full text-sm text-gray-400 py-1 text-center"
              >
                ← Zurück
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
