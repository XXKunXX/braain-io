"use client";

import { useState, useTransition } from "react";
import { format, parseISO, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Play, Square, Trash2, ChevronDown } from "lucide-react";
import { clockIn, clockOut, deleteZeiterfassung } from "@/actions/zeiterfassung";
import { calcNettoStunden } from "@/lib/zeiterfassung-utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Eintrag = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  pauseMinutes: number;
  notes: string | null;
  baustelleId?: string | null;
  baustelleName?: string | null;
};

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatH(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}min`;
}

export function ZeiterfassungShell({
  clerkUserId,
  selectedDate,
  today,
  eintrag,
  history,
  baustellenOptions,
  userName,
}: {
  clerkUserId: string;
  selectedDate: string;
  today: string;
  eintrag: Eintrag | null;
  history: Eintrag[];
  baustellenOptions: { id: string; name: string }[];
  userName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [startTime, setStartTime] = useState(eintrag?.startTime ?? nowHHMM());
  const [endTime, setEndTime] = useState(eintrag?.endTime ?? nowHHMM());
  const [pause, setPause] = useState(String(eintrag?.pauseMinutes ?? 30));
  const [notes, setNotes] = useState(eintrag?.notes ?? "");
  const [baustelleId, setBaustelleId] = useState(
    eintrag?.baustelleId ?? baustellenOptions[0]?.id ?? ""
  );

  const date = parseISO(selectedDate);
  const isToday = selectedDate === today;

  function navigate(delta: number) {
    const newDate = addDays(date, delta);
    router.push(`/fahrer/zeiterfassung?date=${format(newDate, "yyyy-MM-dd")}`);
  }

  const nettoH = calcNettoStunden(
    eintrag?.startTime ?? null,
    eintrag?.endTime ?? null,
    eintrag?.pauseMinutes ?? 0
  );

  function handleClockIn() {
    startTransition(async () => {
      await clockIn(clerkUserId, selectedDate, startTime, baustelleId || undefined);
      toast.success("Eingestempelt");
      router.refresh();
    });
  }

  function handleClockOut() {
    startTransition(async () => {
      await clockOut(clerkUserId, selectedDate, endTime, parseInt(pause) || 0, notes);
      toast.success("Ausgestempelt");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteZeiterfassung(id);
      toast.success("Gelöscht");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Zeiterfassung</p>
          <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
        </div>

        {/* Date nav */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 mb-5">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">{format(date, "EEEE, dd. MMMM yyyy", { locale: de })}</p>
            {isToday && <p className="text-xs text-blue-500 font-medium">Heute</p>}
          </div>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Status card */}
        {eintrag && (nettoH !== null || eintrag.startTime) && (
          <div className="bg-white rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Arbeitszeit heute</p>
                <p className="text-2xl font-bold text-gray-900">
                  {nettoH !== null ? formatH(nettoH) : "—"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs text-gray-500">
              <div className="bg-gray-50 rounded-xl py-2">
                <p className="font-semibold text-gray-900 text-sm">{eintrag.startTime ?? "—"}</p>
                <p>Beginn</p>
              </div>
              <div className="bg-gray-50 rounded-xl py-2">
                <p className="font-semibold text-gray-900 text-sm">{eintrag.pauseMinutes} min</p>
                <p>Pause</p>
              </div>
              <div className="bg-gray-50 rounded-xl py-2">
                <p className="font-semibold text-gray-900 text-sm">{eintrag.endTime ?? "—"}</p>
                <p>Ende</p>
              </div>
            </div>
            {eintrag.baustelleName && (
              <p className="text-xs text-gray-400 mt-3">📍 {eintrag.baustelleName}</p>
            )}
            {eintrag.notes && (
              <p className="text-xs text-gray-500 mt-1 italic">{eintrag.notes}</p>
            )}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {eintrag ? "Eintrag bearbeiten" : "Tag erfassen"}
          </h3>

          {baustellenOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Baustelle</Label>
              <div className="relative">
                <select
                  value={baustelleId || "_none"}
                  onChange={(e) => setBaustelleId(e.target.value === "_none" ? "" : e.target.value)}
                  className="w-full h-12 pl-4 pr-10 rounded-xl border border-input bg-white text-[15px] font-medium text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="_none">Keine Baustelle</option>
                  {baustellenOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Beginn</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Ende</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Pause (Minuten)</Label>
            <Input
              type="number"
              value={pause}
              onChange={(e) => setPause(e.target.value)}
              placeholder="30"
              className="h-10"
              min={0}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Notiz (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. Sonderfahrt, Wartung..." className="h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleClockIn}
              disabled={pending}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Einstempeln
            </button>
            <button
              onClick={handleClockOut}
              disabled={pending || !eintrag?.startTime}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm transition-colors disabled:opacity-40"
            >
              <Square className="h-4 w-4" />
              Ausstempeln
            </button>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="px-5 py-4 text-sm font-semibold text-gray-900 border-b border-gray-100">Letzte 14 Tage</p>
            <div className="divide-y divide-gray-50">
              {history.map((e) => {
                const h = calcNettoStunden(e.startTime, e.endTime, e.pauseMinutes);
                return (
                  <div key={e.id} className="flex items-center px-5 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {format(parseISO(e.date), "EEE, dd. MMM", { locale: de })}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {e.startTime ?? "—"} – {e.endTime ?? "—"}
                        {e.pauseMinutes > 0 && ` · ${e.pauseMinutes} min Pause`}
                        {e.baustelleName && ` · ${e.baustelleName}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-3">
                      <p className="text-sm font-bold text-gray-900">
                        {h !== null ? formatH(h) : "—"}
                      </p>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
