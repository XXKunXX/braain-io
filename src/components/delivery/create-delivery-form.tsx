"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Check } from "lucide-react";
import { useEscapeKey } from "@/hooks/use-escape-key";
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
import { createDeliveryNote } from "@/actions/delivery-notes";
import { toast } from "sonner";
import type { Contact } from "@prisma/client";
import { getContactName } from "@/lib/utils";

const UNITS = ["t", "m³", "m²", "m", "Stk", "Fuhre"];
const MATERIALS = ["Sand", "Kies", "Schotter", "Humus", "Bauschutt", "Erdaushub", "Recycling"];

type QuoteItem = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
};

type OrderInfo = {
  id: string;
  title: string;
  contactId: string;
  quoteItems: QuoteItem[];
};

// Per-item selection state
type SelectedEntry = { quantity: string; unit: string };

type ResourceItem = { id: string; name: string };

interface Props {
  contacts: Contact[];
  order: OrderInfo | null;
  drivers: ResourceItem[];
  vehicles: ResourceItem[];
  baustelleId?: string;
  baustelleContactId?: string;
  orderBaustellen?: ResourceItem[];
  defaultDriverId?: string;
  defaultVehicleId?: string;
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

  const selectedName = items.find((i) => i.id === value)?.name ?? "";

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

export function CreateDeliveryForm({ contacts, order, drivers, vehicles, baustelleId: initialBaustelleId, baustelleContactId, orderBaustellen = [], defaultDriverId = "", defaultVehicleId = "" }: Props) {
  const router = useRouter();
  useEscapeKey(() => router.back(), true);
  const [loading, setLoading] = useState(false);

  // Shared fields
  const [contactId, setContactId] = useState(order?.contactId ?? baustelleContactId ?? "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [baustelleId, setBaustelleId] = useState(initialBaustelleId ?? (orderBaustellen.length === 1 ? orderBaustellen[0].id : ""));
  const [driverId, setDriverId] = useState(defaultDriverId);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [notes, setNotes] = useState("");

  // Multi-item selection: { [itemId]: { quantity, unit } }
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedEntry>>({});

  // Single custom material (when no quote items or no order)
  const [customMaterial, setCustomMaterial] = useState("");
  const [customUnit, setCustomUnit] = useState("t");
  const [customQuantity, setCustomQuantity] = useState("");

  const contactName = getContactName(contacts.find((c) => c.id === contactId), "");
  const selectedIds = Object.keys(selectedItems);
  const hasOrder = !!order;
  const hasItems = order && order.quoteItems.length > 0;

  function toggleItem(item: QuoteItem) {
    setSelectedItems((prev) => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return { ...prev, [item.id]: { quantity: String(item.quantity), unit: item.unit } };
    });
  }

  function updateItemQty(itemId: string, quantity: string) {
    setSelectedItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], quantity } }));
  }

  function updateItemUnit(itemId: string, unit: string) {
    setSelectedItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], unit } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) { toast.error("Bitte Kontakt auswählen"); return; }

    const driverName = drivers.find((d) => d.id === driverId)?.name ?? "";
    const vehicleName = vehicles.find((v) => v.id === vehicleId)?.name ?? "";

    setLoading(true);
    const results: string[] = [];

    if (hasItems && selectedIds.length > 0) {
      // Create one delivery note per selected item
      for (const itemId of selectedIds) {
        const item = order!.quoteItems.find((i) => i.id === itemId)!;
        const entry = selectedItems[itemId];
        const result = await createDeliveryNote({
          contactId,
          orderId: order?.id,
          baustelleId,
          date,
          material: item.description,
          quantity: Number(entry.quantity),
          unit: entry.unit,
          driver: driverName,
          vehicle: vehicleName,
          notes,
        });
        if (result.deliveryNote) results.push(result.deliveryNote.id);
      }
    } else {
      // Single custom delivery note
      const result = await createDeliveryNote({
        contactId,
        orderId: order?.id,
        baustelleId,
        date,
        material: customMaterial,
        quantity: Number(customQuantity),
        unit: customUnit,
        driver: driverName,
        vehicle: vehicleName,
        notes,
      });
      if (result.deliveryNote) results.push(result.deliveryNote.id);
    }

    setLoading(false);

    if (results.length === 0) {
      toast.error("Fehler beim Erstellen");
      return;
    }

    if (order) {
      toast.success(results.length === 1 ? "Lieferschein erstellt" : `${results.length} Lieferscheine erstellt`);
      router.push(`/auftraege/${order.id}?tab=Lieferscheine`);
    } else if (results.length === 1) {
      toast.success("Lieferschein erstellt");
      router.push(`/lieferscheine/${results[0]}`);
    } else {
      toast.success(`${results.length} Lieferscheine erstellt`);
      router.push("/lieferscheine");
    }
  }

  const canSubmit = contactId && (
    (hasItems && selectedIds.length > 0) ||
    (!hasItems && customMaterial && customQuantity)
  );

  const submitLabel = hasItems && selectedIds.length > 1
    ? `${selectedIds.length} Lieferscheine erstellen`
    : "Lieferschein erstellen";

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {/* Back */}
      <Link
        href={order ? `/auftraege/${order.id}` : "/lieferscheine"}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {order ? `Zurück zu ${order.title}` : "Zurück zu Lieferscheine"}
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Neuer Lieferschein</h1>
        {order && <p className="text-sm text-gray-500 mt-0.5">Auftrag: {order.title}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── 1. Allgemeine Angaben ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Allgemeine Angaben</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Contact — show name if locked, selector if free */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Kontakt *</Label>
              {order?.contactId ? (
                <div className="h-10 px-3 flex items-center border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 font-medium">
                  {contactName}
                </div>
              ) : (
                <Select value={contactId} onValueChange={(v) => v && setContactId(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Kontakt wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{getContactName(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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

          {orderBaustellen.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Baustelle</Label>
              {orderBaustellen.length === 1 ? (
                <div className="h-10 px-3 flex items-center border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 font-medium">
                  {orderBaustellen[0].name}
                </div>
              ) : (
                <Select value={baustelleId} onValueChange={(v) => setBaustelleId(v ?? "")}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Baustelle wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orderBaustellen.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

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

        {/* ── 2. Custom material (no quote items) ── */}
        {!hasItems && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Material</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Material *</Label>
                <Input
                  list="materials-list"
                  placeholder="Sand, Kies, Schotter..."
                  required={!hasItems}
                  value={customMaterial}
                  onChange={(e) => setCustomMaterial(e.target.value)}
                  className="h-10"
                />
                <datalist id="materials-list">
                  {MATERIALS.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Einheit</Label>
                <Select value={customUnit} onValueChange={(v) => v && setCustomUnit(v)}>
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
                required={!hasItems}
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
                className="h-10 max-w-xs"
              />
            </div>
          </div>
        )}

        {/* ── 3. Leistungen aus Auftrag ── */}
        {hasItems && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
              <h3 className="text-sm font-semibold text-gray-900">Leistungen aus Auftrag</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Mehrfachauswahl möglich — je Position wird ein eigener Lieferschein erstellt
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {order!.quoteItems.map((item) => {
                const isSelected = !!selectedItems[item.id];
                return (
                  <div
                    key={item.id}
                    className={`px-5 py-3 transition-colors ${isSelected ? "bg-blue-50/60" : "hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`item-${item.id}`}
                        checked={isSelected}
                        onChange={() => toggleItem(item)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />
                      <label
                        htmlFor={`item-${item.id}`}
                        className="flex-1 flex items-center gap-2 cursor-pointer min-w-0"
                      >
                        <span className="text-xs text-gray-400 font-mono w-5 flex-shrink-0">{item.position}.</span>
                        <span className={`text-sm font-medium truncate ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                          {item.description}
                        </span>
                      </label>
                      {/* Inline quantity + unit — only visible when selected */}
                      {isSelected ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={selectedItems[item.id].quantity}
                            onChange={(e) => updateItemQty(item.id, e.target.value)}
                            className="h-8 w-24 text-sm text-right font-mono"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Select
                            value={selectedItems[item.id].unit}
                            onValueChange={(v) => v && updateItemUnit(item.id, v)}
                          >
                            <SelectTrigger className="h-8 w-20 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="text-sm font-mono text-gray-400 flex-shrink-0">
                          {item.quantity.toLocaleString("de-DE")} {item.unit}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedIds.length > 0 && (
              <div className="px-5 py-2.5 bg-blue-50 border-t border-blue-100">
                <p className="text-xs text-blue-700 font-medium">
                  {selectedIds.length} {selectedIds.length === 1 ? "Position" : "Positionen"} ausgewählt
                  {selectedIds.length > 1 && ` → ${selectedIds.length} Lieferscheine werden erstellt`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={loading || !canSubmit}
            className="bg-amber-500 hover:bg-amber-600 text-white min-w-44"
          >
            {loading ? "Erstellt..." : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
