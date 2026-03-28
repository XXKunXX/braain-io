"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, ClipboardCheck, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import { createFahrzeugCheck, type CheckItem } from "@/actions/fahrer-features";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_CHECKS: CheckItem[] = [
  { label: "Beleuchtung (Scheinwerfer, Rück-, Bremslichter)", checked: false },
  { label: "Blinker vorne und hinten", checked: false },
  { label: "Reifendruck und Profiltiefe", checked: false },
  { label: "Ölstand geprüft", checked: false },
  { label: "Kühlwasserstand geprüft", checked: false },
  { label: "Bremsflüssigkeitsstand geprüft", checked: false },
  { label: "Windschutzscheibe / Wischer", checked: false },
  { label: "Spiegel sauber und eingestellt", checked: false },
  { label: "Fahrzeugpapiere vorhanden", checked: false },
  { label: "Verbandkasten / Warndreieck vorhanden", checked: false },
];

type HistoryEntry = {
  id: string;
  date: string;
  vehicleName: string | null;
  items: CheckItem[];
  notes: string | null;
  createdAt: string;
};

export function FahrzeugCheckShell({
  clerkUserId,
  userName,
  today,
  history,
}: {
  clerkUserId: string;
  userName: string;
  today: string;
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [vehicleName, setVehicleName] = useState("");
  const [items, setItems] = useState<CheckItem[]>(DEFAULT_CHECKS);
  const [notes, setNotes] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  function toggleItem(index: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  }

  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = checkedCount === items.length;

  function handleSubmit() {
    startTransition(async () => {
      await createFahrzeugCheck({
        clerkUserId,
        date,
        vehicleName: vehicleName || undefined,
        items,
        notes: notes || undefined,
      });
      toast.success("Fahrzeugcheck gespeichert");
      setItems(DEFAULT_CHECKS.map((i) => ({ ...i, checked: false })));
      setVehicleName("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Fahrzeug-Check</p>
          <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Tägliche Inspektion</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Datum</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Fahrzeug</Label>
              <Input
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder="z.B. LKW 01"
                className="h-10"
              />
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-500">Checkliste</Label>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                allChecked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {checkedCount}/{items.length}
              </span>
            </div>
            <div className="space-y-1">
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => toggleItem(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                    item.checked
                      ? "bg-green-50 text-green-800"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.checked ? (
                    <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Bemerkungen (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Auffälligkeiten, Mängel..."
              rows={2}
              className="resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={pending}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            <ClipboardCheck className="h-4 w-4" />
            Check speichern
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="px-5 py-4 text-sm font-semibold text-gray-900 border-b border-gray-100">Letzte Checks</p>
            <div className="divide-y divide-gray-50">
              {history.map((entry) => {
                const items = entry.items as CheckItem[];
                const checked = items.filter((i) => i.checked).length;
                const ok = checked === items.length;
                const isOpen = expandedEntry === entry.id;
                return (
                  <div key={entry.id}>
                    <button
                      onClick={() => setExpandedEntry(isOpen ? null : entry.id)}
                      className="w-full flex items-center px-5 py-3 gap-3 hover:bg-gray-50 transition-colors"
                    >
                      {ok ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {format(parseISO(entry.date), "EEE, dd. MMM yyyy", { locale: de })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {entry.vehicleName ?? "Kein Fahrzeug"} · {checked}/{items.length} OK
                        </p>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 space-y-1">
                        {items.map((item, i) => (
                          <div key={i} className={`flex items-center gap-2 text-xs py-1 ${item.checked ? "text-green-700" : "text-red-600"}`}>
                            {item.checked ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {item.label}
                          </div>
                        ))}
                        {entry.notes && (
                          <p className="text-xs text-gray-500 italic mt-2">{entry.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
