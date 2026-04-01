"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Check } from "lucide-react";
import Link from "next/link";
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
import { updateDeliveryNote } from "@/actions/delivery-notes";
import { toast } from "sonner";

const UNITS = ["t", "m³", "m²", "m", "Stk", "Fuhre"];
const MATERIALS = ["Sand", "Kies", "Schotter", "Humus", "Bauschutt", "Erdaushub", "Recycling"];

type ResourceItem = { id: string; name: string };

interface DeliveryNoteData {
  id: string;
  contactId: string;
  contactName: string;
  baustelleId?: string | null;
  date: string;
  material: string;
  quantity: number;
  unit: string;
  driver?: string | null;
  vehicle?: string | null;
  notes?: string | null;
}

interface Props {
  deliveryNote: DeliveryNoteData;
  drivers: ResourceItem[];
  vehicles: ResourceItem[];
}

function ResourceCombobox({
  items,
  value,
  onChange,
  placeholder,
}: {
  items: ResourceItem[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedName = items.find((i) => i.id === value)?.name ?? value;

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setSearch("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <span className={selectedName ? "text-gray-900" : "text-gray-400"}>
          {selectedName || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onClick={clear}
              className="text-gray-300 hover:text-gray-500 text-xs leading-none cursor-pointer px-0.5"
            >
              ✕
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="w-full text-sm px-2 py-1 rounded border border-gray-200 outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">Keine Einträge</p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => select(item.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Check className={`h-3.5 w-3.5 flex-shrink-0 ${value === item.id ? "text-blue-600" : "text-transparent"}`} />
                  {item.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EditDeliveryForm({ deliveryNote: dn, drivers, vehicles }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(dn.date);
  const [material, setMaterial] = useState(dn.material);
  const [quantity, setQuantity] = useState(String(dn.quantity));
  const [unit, setUnit] = useState(dn.unit);
  const [driverId, setDriverId] = useState(
    drivers.find((d) => d.name === dn.driver)?.id ?? dn.driver ?? ""
  );
  const [vehicleId, setVehicleId] = useState(
    vehicles.find((v) => v.name === dn.vehicle)?.id ?? dn.vehicle ?? ""
  );
  const [notes, setNotes] = useState(dn.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const driverName = drivers.find((d) => d.id === driverId)?.name ?? driverId;
    const vehicleName = vehicles.find((v) => v.id === vehicleId)?.name ?? vehicleId;

    const result = await updateDeliveryNote(dn.id, {
      contactId: dn.contactId,
      baustelleId: dn.baustelleId ?? undefined,
      date,
      material,
      quantity: Number(quantity),
      unit,
      driver: driverName || undefined,
      vehicle: vehicleName || undefined,
      notes: notes || undefined,
    });

    setLoading(false);

    if ("error" in result && result.error) {
      toast.error("Fehler beim Speichern");
      return;
    }

    toast.success("Lieferschein aktualisiert");
    router.push(`/lieferscheine/${dn.id}`);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link
        href={`/lieferscheine/${dn.id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Zurück zum Lieferschein
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Lieferschein bearbeiten</h1>
        <p className="text-sm text-gray-500 mt-0.5">{dn.contactName}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Allgemeine Angaben</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Kontakt</Label>
              <div className="h-10 px-3 flex items-center border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 font-medium">
                {dn.contactName}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Datum *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Fahrer</Label>
              <ResourceCombobox
                items={drivers}
                value={driverId}
                onChange={setDriverId}
                placeholder="Fahrer wählen..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Fahrzeug</Label>
              <ResourceCombobox
                items={vehicles}
                value={vehicleId}
                onChange={setVehicleId}
                placeholder="Fahrzeug wählen..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Notizen</Label>
            <Textarea
              placeholder="Optionale Anmerkungen..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Material</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Material *</Label>
              <Input
                list="materials-list"
                placeholder="Sand, Kies, Schotter..."
                required
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="h-10"
              />
              <datalist id="materials-list">
                {MATERIALS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Einheit</Label>
              <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Menge *</Label>
            <Input
              type="number" min="0" step="1" placeholder="0"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-10 max-w-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 text-white min-w-36"
          >
            {loading ? "Speichert..." : "Speichern"}
          </Button>
        </div>
      </form>
    </div>
  );
}
