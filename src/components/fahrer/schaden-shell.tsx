"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldAlert, Wrench } from "lucide-react";
import { createSchadensmeldung } from "@/actions/fahrer-features";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const URGENCY_LABEL: Record<string, string> = {
  LOW: "Gering",
  NORMAL: "Normal",
  HIGH: "Dringend",
};
const URGENCY_STYLE: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  RESOLVED: "Erledigt",
};
const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
};

type Meldung = {
  id: string;
  date: string;
  vehicleName: string | null;
  description: string;
  urgency: string;
  status: string;
  createdAt: string;
};

export function SchadenShell({
  clerkUserId,
  userName,
  today,
  history,
  baustellenOptions,
}: {
  clerkUserId: string;
  userName: string;
  today: string;
  history: Meldung[];
  baustellenOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(today);
  const [vehicleName, setVehicleName] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("NORMAL");
  const [baustelleId, setBaustelleId] = useState("");

  function handleSubmit() {
    if (!description.trim()) {
      toast.error("Bitte Schadensbeschreibung eingeben");
      return;
    }
    startTransition(async () => {
      await createSchadensmeldung({
        clerkUserId,
        driverName: userName,
        vehicleName: vehicleName || undefined,
        date,
        description,
        urgency,
        baustelleId: baustelleId || undefined,
      });
      toast.success("Schadensmeldung eingereicht");
      setVehicleName("");
      setDescription("");
      setUrgency("NORMAL");
      setBaustelleId("");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Schadensmeldung</p>
          <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Neuer Schaden melden</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Datum</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Fahrzeug / Maschine</Label>
              <Input
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder="z.B. LKW 01"
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Dringlichkeit</Label>
            <Select value={urgency} onValueChange={(v) => v && setUrgency(v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Gering – kein Soforthandlungsbedarf</SelectItem>
                <SelectItem value="NORMAL">Normal – bitte bald beheben</SelectItem>
                <SelectItem value="HIGH">Dringend – Fahrzeug nicht einsatzbereit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {baustellenOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Baustelle (optional)</Label>
              <Select value={baustelleId || "_none"} onValueChange={(v) => v && setBaustelleId(v === "_none" ? "" : v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Keine Baustelle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Keine Baustelle</SelectItem>
                  {baustellenOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Schadensbeschreibung</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Was ist passiert? Wo genau ist der Schaden?"
              rows={4}
              className="resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={pending || !description.trim()}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            Meldung einreichen
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="px-5 py-4 text-sm font-semibold text-gray-900 border-b border-gray-100">Meine Meldungen</p>
            <div className="divide-y divide-gray-50">
              {history.map((m) => (
                <div key={m.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {format(parseISO(m.date), "EEE, dd. MMM yyyy", { locale: de })}
                      {m.vehicleName && <span className="text-gray-500"> · {m.vehicleName}</span>}
                    </p>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${URGENCY_STYLE[m.urgency]}`}>
                        {URGENCY_LABEL[m.urgency]}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[m.status]}`}>
                        {STATUS_LABEL[m.status]}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
