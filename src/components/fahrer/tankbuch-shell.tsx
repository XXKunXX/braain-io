"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Fuel, Trash2 } from "lucide-react";
import { createTankEintrag, deleteTankEintrag } from "@/actions/fahrer-features";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Eintrag = {
  id: string;
  date: string;
  vehicleName: string;
  liters: string | number;
  kmStand: number | null;
  costCenter: string | null;
  notes: string | null;
};

export function TankbuchShell({
  clerkUserId,
  userName,
  today,
  history,
}: {
  clerkUserId: string;
  userName: string;
  today: string;
  history: Eintrag[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(today);
  const [vehicleName, setVehicleName] = useState("");
  const [liters, setLiters] = useState("");
  const [kmStand, setKmStand] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!vehicleName.trim() || !liters) {
      toast.error("Fahrzeug und Liter sind Pflichtfelder");
      return;
    }
    startTransition(async () => {
      await createTankEintrag({
        clerkUserId,
        date,
        vehicleName,
        liters: parseFloat(liters),
        kmStand: kmStand ? parseInt(kmStand) : undefined,
        costCenter: costCenter || undefined,
        notes: notes || undefined,
      });
      toast.success("Tankeintrag gespeichert");
      setVehicleName("");
      setLiters("");
      setKmStand("");
      setCostCenter("");
      setNotes("");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTankEintrag(id);
      toast.success("Gelöscht");
      router.refresh();
    });
  }

  const totalLiters = history.reduce((sum, e) => sum + Number(e.liters), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Tankbuch</p>
          <h1 className="text-2xl font-bold text-gray-900">{userName}</h1>
        </div>

        {/* Summary */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Fuel className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalLiters.toLocaleString("de-DE", { maximumFractionDigits: 1 })} L</p>
              <p className="text-xs text-gray-400">Gesamt letzte {history.length} Einträge</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Tanken erfassen</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Datum</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Fahrzeug *</Label>
              <Input
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder="z.B. LKW 01"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Liter *</Label>
              <Input
                type="number"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                placeholder="z.B. 80"
                className="h-10"
                min={0}
                step={0.1}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">km-Stand</Label>
              <Input
                type="number"
                value={kmStand}
                onChange={(e) => setKmStand(e.target.value)}
                placeholder="z.B. 125000"
                className="h-10"
                min={0}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Kostenstelle</Label>
              <Input
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                placeholder="optional"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Notiz</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="optional"
                className="h-10"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={pending || !vehicleName.trim() || !liters}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            <Fuel className="h-4 w-4" />
            Eintrag speichern
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <p className="px-5 py-4 text-sm font-semibold text-gray-900 border-b border-gray-100">Letzte Einträge</p>
            <div className="divide-y divide-gray-50">
              {history.map((e) => (
                <div key={e.id} className="flex items-center px-5 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {format(parseISO(e.date), "EEE, dd. MMM yyyy", { locale: de })} · {e.vehicleName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {Number(e.liters).toLocaleString("de-DE", { maximumFractionDigits: 1 })} L
                      {e.kmStand && ` · ${e.kmStand.toLocaleString("de-DE")} km`}
                      {e.costCenter && ` · ${e.costCenter}`}
                      {e.notes && ` · ${e.notes}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
