"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Clock, Users } from "lucide-react";
import { createFahrerTagesrapport } from "@/actions/tagesbericht";
import { deleteTagesrapport } from "@/actions/baustellen";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Baustelle = { id: string; name: string };

type Rapport = {
  id: string;
  baustelleId: string;
  date: Date;
  driverName: string | null;
  machineName: string | null;
  hours: number | null;
  employees: number | null;
  description: string | null;
  baustelle: { id: string; name: string };
};

export function TagesberichtShell({
  clerkUserId,
  userName,
  today,
  baustellen,
  history,
}: {
  clerkUserId: string;
  userName: string;
  today: string;
  baustellen: Baustelle[];
  history: Rapport[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [baustelleId, setBaustelleId] = useState(baustellen[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [machineName, setMachineName] = useState("");
  const [hours, setHours] = useState("");
  const [employees, setEmployees] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit() {
    if (!baustelleId) {
      toast.error("Bitte Baustelle auswählen");
      return;
    }
    startTransition(async () => {
      const result = await createFahrerTagesrapport({
        baustelleId,
        date,
        driverName: userName,
        machineName: machineName || undefined,
        hours: hours ? parseFloat(hours) : null,
        employees: employees ? parseInt(employees) : null,
        description: description || undefined,
      });
      if ("error" in result) {
        toast.error("Fehler beim Speichern");
      } else {
        toast.success("Tagesbericht gespeichert");
        setMachineName("");
        setHours("");
        setEmployees("");
        setDescription("");
        router.refresh();
      }
    });
  }

  function handleDelete(id: string, baustelleId: string) {
    startTransition(async () => {
      await deleteTagesrapport(id, baustelleId);
      toast.success("Gelöscht");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Tagesbericht</p>
          <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Neuer Bericht</h3>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Datum</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
          </div>

          {baustellen.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Baustelle</Label>
              <Select value={baustelleId} onValueChange={(v) => setBaustelleId(v ?? "")}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Baustelle wählen" />
                </SelectTrigger>
                <SelectContent>
                  {baustellen.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-400 text-center">
              Keine Baustellen zugeteilt
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Stunden</Label>
              <Input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="z.B. 8"
                className="h-10"
                min={0}
                step={0.5}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Mitarbeiter</Label>
              <Input
                type="number"
                value={employees}
                onChange={(e) => setEmployees(e.target.value)}
                placeholder="z.B. 3"
                className="h-10"
                min={0}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Maschine (optional)</Label>
            <Input
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder="z.B. Bagger CAT 320"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Beschreibung der Arbeiten</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Was wurde heute erledigt?"
              rows={3}
              className="resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={pending || !baustelleId}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Bericht speichern
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="px-5 py-4 text-sm font-semibold text-gray-900 border-b border-gray-100">Letzte Berichte</p>
            <div className="divide-y divide-gray-50">
              {history.map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {format(new Date(r.date), "EEE, dd. MMM yyyy", { locale: de })}
                      </p>
                      <p className="text-xs text-indigo-600 font-medium mt-0.5">{r.baustelle.name}</p>
                      {(r.hours != null || r.employees != null) && (
                        <div className="flex items-center gap-3 mt-1.5">
                          {r.hours != null && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />{r.hours}h
                            </span>
                          )}
                          {r.employees != null && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Users className="h-3 w-3" />{r.employees} MA
                            </span>
                          )}
                          {r.machineName && (
                            <span className="text-xs text-gray-400">{r.machineName}</span>
                          )}
                        </div>
                      )}
                      {r.description && (
                        <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">{r.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(r.id, r.baustelleId)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
