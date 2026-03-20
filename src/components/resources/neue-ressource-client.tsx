"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createResource } from "@/actions/resources";
import type { ResourceFormData } from "@/actions/resources";
import { formatLicensePlate } from "@/lib/license-plate";

type FahrerOption = { id: string; name: string };

interface Props {
  prefillType: string;
  fahrer: FahrerOption[];
}

const TYPE_OPTIONS = [
  { value: "FAHRER", label: "Fahrer" },
  { value: "FAHRZEUG", label: "Fahrzeug" },
  { value: "MASCHINE", label: "Maschine" },
  { value: "PRODUKT", label: "Produkt" },
  { value: "OTHER", label: "Sonstiges" },
];

const IC = "h-10 rounded-lg border-gray-200";
const SELECT = "w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export function NeueRessourceClient({ prefillType, fahrer }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const validType = TYPE_OPTIONS.some((t) => t.value === prefillType)
    ? (prefillType as ResourceFormData["type"])
    : "FAHRER";

  const [type, setType] = useState<ResourceFormData["type"]>(validType);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [clerkUserId, setClerkUserId] = useState("");
  // Fahrzeug-specific
  const [licensePlate, setLicensePlate] = useState("");
  const [driverResourceId, setDriverResourceId] = useState("");
  const [vehicleManufacturer, setVehicleManufacturer] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  // Produkt-specific
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [quoteDescription, setQuoteDescription] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name ist erforderlich"); return; }

    setLoading(true);
    const result = await createResource({
      name: name.trim(),
      type,
      email: email || undefined,
      phone: phone || undefined,
      description: description || undefined,
      clerkUserId: clerkUserId || undefined,
      licensePlate: licensePlate || undefined,
      driverResourceId: driverResourceId || undefined,
      vehicleManufacturer: vehicleManufacturer || undefined,
      vehicleModel: vehicleModel || undefined,
      vehicleYear: vehicleYear || undefined,
      unit: unit || undefined,
      price: price || undefined,
      quoteDescription: quoteDescription || undefined,
    });
    setLoading(false);

    if ("error" in result && result.error) { toast.error("Fehler beim Erstellen"); return; }
    toast.success("Ressource erstellt");
    router.push("/ressourcen");
  }

  const isFahrzeug = type === "FAHRZEUG";
  const isProdukt = type === "PRODUKT";

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
        <div>
          <Link href="/ressourcen" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Alle Ressourcen
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Neue Ressource</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-6">
        <div className="max-w-2xl space-y-5">

          {/* Basisinformationen */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Basisinformationen</h2>
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={IC}
                    placeholder={isFahrzeug ? "z.B. Sprinter Wien" : "z.B. Klaus Wagner"}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Typ</Label>
                  <select className={SELECT} value={type} onChange={(e) => setType(e.target.value as ResourceFormData["type"])}>
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!isFahrzeug && !isProdukt && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">E-Mail</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={IC} placeholder="Optional" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Telefon</Label>
                      <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={IC} placeholder="Optional" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Beschreibung</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-lg border-gray-200 resize-none" placeholder="Optional" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Produkt-Felder */}
          {isProdukt && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Produktdetails</h2>
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Einheit *</Label>
                    <select className={SELECT} value={unit} onChange={(e) => setUnit(e.target.value)}>
                      <option value="">– Einheit wählen –</option>
                      <option value="t">t (Tonnen)</option>
                      <option value="m³">m³ (Kubikmeter)</option>
                      <option value="m²">m² (Quadratmeter)</option>
                      <option value="m">m (Meter)</option>
                      <option value="Stk">Stk (Stück)</option>
                      <option value="Std">Std (Stunden)</option>
                      <option value="Pauschale">Pauschale</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Preis (€)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className={IC}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Artikelbeschreibung für Angebot</Label>
                  <Textarea
                    value={quoteDescription}
                    onChange={(e) => setQuoteDescription(e.target.value)}
                    rows={3}
                    className="rounded-lg border-gray-200 resize-none"
                    placeholder="Beschreibungstext wie er im Angebot erscheinen soll..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Fahrzeug-Felder */}
          {isFahrzeug && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-base font-semibold text-gray-900">Fahrzeugdaten</h2>
                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Kennzeichen</Label>
                      <Input
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(formatLicensePlate(e.target.value))}
                        className={IC}
                        placeholder="W 12345 A"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Fahrer</Label>
                      <select className={SELECT} value={driverResourceId} onChange={(e) => setDriverResourceId(e.target.value)}>
                        <option value="">— Kein Fahrer —</option>
                        {fahrer.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-base font-semibold text-gray-900 text-gray-500">Weitere Angaben</h2>
                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Hersteller</Label>
                      <Input value={vehicleManufacturer} onChange={(e) => setVehicleManufacturer(e.target.value)} className={IC} placeholder="z.B. Mercedes-Benz" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Modell</Label>
                      <Input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} className={IC} placeholder="z.B. Sprinter 316" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Baujahr</Label>
                      <Input
                        type="number"
                        min="1900"
                        max="2100"
                        value={vehicleYear}
                        onChange={(e) => setVehicleYear(e.target.value)}
                        className={IC}
                        placeholder="z.B. 2021"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notizen</Label>
                      <Input value={description} onChange={(e) => setDescription(e.target.value)} className={IC} placeholder="Optional" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Fahrer: App-Zugang */}
          {type === "FAHRER" && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">App-Zugang</h2>
              <div className="border-t border-gray-100 pt-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">User verknüpfen</Label>
                  <Input value={clerkUserId} onChange={(e) => setClerkUserId(e.target.value)} className={IC} placeholder="User ID (optional)" />
                  <p className="text-[11px] text-gray-400">Fahrer kann sich damit in der App anmelden und Aufträge sehen.</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pb-6">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => router.back()}>Abbrechen</Button>
            <Button type="submit" disabled={loading || !name.trim()} className="rounded-lg bg-blue-600 hover:bg-blue-700">
              {loading ? "Erstelle..." : "Ressource erstellen"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
