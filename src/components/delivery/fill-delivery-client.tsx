"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fillDeliveryNote } from "@/actions/delivery-notes";
import type { MaterialRow } from "@/actions/delivery-notes";
import { toast } from "sonner";
import { Plus, Trash2, PenLine, RotateCcw, Check, ChevronLeft } from "lucide-react";
import type { Contact, DeliveryNote, Baustelle, Order } from "@prisma/client";

type DN = DeliveryNote & { contact: Contact; order: Order | null; baustelle: (Baustelle & { order: Order | null }) | null };

const VEHICLE_TYPES = ["2-Achs", "3-Achs", "4-Achs", "Kran", "LKW+Anhänger", "LKW+Tieflader"];

const emptyRow = (): MaterialRow => ({ material: "", m3: "", to: "" });

export function FillDeliveryClient({ deliveryNote: dn }: { deliveryNote: DN }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Pre-fill from existing data
  const [driver, setDriver] = useState(dn.driver ?? "");
  const [vehicle, setVehicle] = useState(dn.vehicle ?? "");
  const [licensePlate, setLicensePlate] = useState((dn as DN & { licensePlate?: string }).licensePlate ?? "");
  const [siteAddress, setSiteAddress] = useState((dn as DN & { siteAddress?: string }).siteAddress ?? "");
  const [vehicleType, setVehicleType] = useState((dn as DN & { vehicleType?: string }).vehicleType ?? "");
  const [isMaut, setIsMaut] = useState((dn as DN & { isMaut?: boolean }).isMaut ?? false);
  const [mautKm, setMautKm] = useState(String((dn as DN & { mautKm?: number }).mautKm ?? ""));
  const [regieStart1, setRegieStart1] = useState((dn as DN & { regieStart1?: string }).regieStart1 ?? "");
  const [regieEnd1, setRegieEnd1] = useState((dn as DN & { regieEnd1?: string }).regieEnd1 ?? "");
  const [regieStart2, setRegieStart2] = useState((dn as DN & { regieStart2?: string }).regieStart2 ?? "");
  const [regieEnd2, setRegieEnd2] = useState((dn as DN & { regieEnd2?: string }).regieEnd2 ?? "");
  const [notes, setNotes] = useState(dn.notes ?? "");

  const existingDelivered = (dn as DN & { deliveredItems?: MaterialRow[] }).deliveredItems;
  const existingReceived = (dn as DN & { receivedItems?: MaterialRow[] }).receivedItems;

  const [deliveredItems, setDeliveredItems] = useState<MaterialRow[]>(
    existingDelivered?.length
      ? existingDelivered
      : [{ material: dn.material, m3: dn.unit === "m³" ? String(Number(dn.quantity)) : "", to: dn.unit === "t" ? String(Number(dn.quantity)) : "" }]
  );
  const [receivedItems, setReceivedItems] = useState<MaterialRow[]>(
    existingReceived?.length ? existingReceived : [emptyRow()]
  );

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSig, setHasSig] = useState(!!dn.signatureUrl);
  const [signatureUrl, setSignatureUrl] = useState(dn.signatureUrl ?? "");

  function setupCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  useEffect(() => { setupCanvas(); }, []);

  function getPos(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    lastPos.current = getPos(e.nativeEvent);
    setHasSig(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !lastPos.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, []);

  const onMouseUp = useCallback(() => { drawing.current = false; lastPos.current = null; }, []);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e.touches[0]);
    setHasSig(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawing.current || !lastPos.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e.touches[0]);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, []);

  function clearSignature() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
    setSignatureUrl("");
  }

  async function uploadSignature(): Promise<string | null> {
    const canvas = canvasRef.current!;
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { resolve(null); return; }
        try {
          const res = await fetch("/api/upload/signed-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: `signature-${dn.id}.png`, contentType: "image/png" }),
          });
          const { signedUrl, publicUrl } = await res.json();
          await fetch(signedUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/png" } });
          resolve(publicUrl);
        } catch {
          resolve(null);
        }
      }, "image/png");
    });
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      let finalSignatureUrl = signatureUrl;
      if (hasSig && !signatureUrl) {
        const url = await uploadSignature();
        if (url) finalSignatureUrl = url;
      }

      await fillDeliveryNote(dn.id, {
        driver: driver || undefined,
        vehicle: vehicle || undefined,
        licensePlate: licensePlate || undefined,
        siteAddress: siteAddress || undefined,
        vehicleType: vehicleType || undefined,
        isMaut,
        mautKm: mautKm ? Number(mautKm) : undefined,
        regieStart1: regieStart1 || undefined,
        regieEnd1: regieEnd1 || undefined,
        regieStart2: regieStart2 || undefined,
        regieEnd2: regieEnd2 || undefined,
        deliveredItems: deliveredItems.filter(r => r.material),
        receivedItems: receivedItems.filter(r => r.material),
        notes: notes || undefined,
        signatureUrl: finalSignatureUrl || undefined,
      });

      toast.success("Lieferschein gespeichert");
      router.push(`/lieferscheine/${dn.id}`);
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  const IC = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-gray-400">{dn.deliveryNumber}</p>
          <h1 className="text-base font-semibold text-gray-900 truncate">Lieferschein ausfüllen</h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Check className="h-4 w-4" />
          {saving ? "..." : "Speichern"}
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-xl mx-auto pb-10">

        {/* Info (readonly) */}
        <Section title="Auftragsdaten">
          <ReadRow label="Datum" value={new Date(dn.date).toLocaleDateString("de-DE")} />
          <ReadRow label="Kunde" value={dn.contact.companyName || [dn.contact.firstName, dn.contact.lastName].filter(Boolean).join(" ")} />
          <div>
            <label className={LBL}>Baustelle</label>
            <input className={IC} value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="Baustellenadresse..." />
          </div>
        </Section>

        {/* Fahrzeug */}
        <Section title="Fahrzeug">
          <div>
            <label className={LBL}>Fahrzeugtyp</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {VEHICLE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setVehicleType(vehicleType === t ? "" : t)}
                  className={`py-2.5 px-2 rounded-lg border text-sm font-medium transition-colors ${
                    vehicleType === t
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Fahrzeug</label>
              <input className={IC} value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="z.B. VW Crafter" />
            </div>
            <div>
              <label className={LBL}>Kennzeichen</label>
              <input className={IC} value={licensePlate} onChange={e => setLicensePlate(e.target.value)} placeholder="ST-123AB" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMaut(!isMaut)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isMaut ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isMaut ? "translate-x-5" : ""}`} />
            </button>
            <span className="text-sm text-gray-700">Maut</span>
            {isMaut && (
              <input
                type="number"
                className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="km"
                value={mautKm}
                onChange={e => setMautKm(e.target.value)}
              />
            )}
          </div>
        </Section>

        {/* Fahrer */}
        <Section title="Fahrer">
          <div>
            <label className={LBL}>Name</label>
            <input className={IC} value={driver} onChange={e => setDriver(e.target.value)} placeholder="Vor- und Nachname" />
          </div>
        </Section>

        {/* Regiezeit */}
        <Section title="Regiezeit">
          <div>
            <label className={LBL}>Block 1</label>
            <div className="flex items-center gap-2">
              <input type="time" className={`${IC} flex-1`} value={regieStart1} onChange={e => setRegieStart1(e.target.value)} />
              <span className="text-gray-400 text-sm">bis</span>
              <input type="time" className={`${IC} flex-1`} value={regieEnd1} onChange={e => setRegieEnd1(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={LBL}>Block 2 (optional)</label>
            <div className="flex items-center gap-2">
              <input type="time" className={`${IC} flex-1`} value={regieStart2} onChange={e => setRegieStart2(e.target.value)} />
              <span className="text-gray-400 text-sm">bis</span>
              <input type="time" className={`${IC} flex-1`} value={regieEnd2} onChange={e => setRegieEnd2(e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Geliefertes Material */}
        <Section title="Geliefertes Material">
          <MaterialTable rows={deliveredItems} onChange={setDeliveredItems} />
        </Section>

        {/* Übernommenes Material */}
        <Section title="Übernommenes Material">
          <MaterialTable rows={receivedItems} onChange={setReceivedItems} />
        </Section>

        {/* Sonstiges */}
        <Section title="Sonstiges">
          <textarea
            rows={3}
            className={`${IC} resize-none`}
            placeholder="Bemerkungen..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Section>

        {/* Unterschrift */}
        <Section title="Unterschrift des Kunden">
          {dn.signatureUrl && !hasSig ? (
            <div className="space-y-2">
              <img src={dn.signatureUrl} alt="Unterschrift" className="w-full h-36 object-contain border border-gray-200 rounded-lg bg-white" />
              <button
                type="button"
                onClick={() => { setSignatureUrl(""); setHasSig(false); }}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Neu unterschreiben
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="border border-gray-300 rounded-xl bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={180}
                  className="w-full touch-none cursor-crosshair"
                  style={{ height: "180px" }}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onMouseUp}
                />
              </div>
              <div className="flex items-center gap-3">
                {hasSig && (
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-sm text-gray-400 hover:text-red-500 flex items-center gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Löschen
                  </button>
                )}
                {!hasSig && (
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <PenLine className="h-3.5 w-3.5" />
                    Hier unterschreiben
                  </p>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-base"
        >
          {saving ? "Wird gespeichert..." : "Lieferschein abschicken"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
        <h2 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">{title}</h2>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function MaterialTable({ rows, onChange }: { rows: MaterialRow[]; onChange: (rows: MaterialRow[]) => void }) {
  function update(idx: number, field: keyof MaterialRow, value: string) {
    onChange(rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }
  function add() { onChange([...rows, emptyRow()]); }
  function remove(idx: number) { onChange(rows.filter((_, i) => i !== idx)); }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_64px_64px_28px] gap-1.5 text-[10px] font-semibold tracking-wider text-gray-400 uppercase px-1">
        <span>Material</span><span>m³</span><span>to</span><span />
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_64px_64px_28px] gap-1.5 items-center">
          <input
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Material..."
            value={row.material}
            onChange={e => update(idx, "material", e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-center"
            value={row.m3}
            onChange={e => update(idx, "m3", e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-center"
            value={row.to}
            onChange={e => update(idx, "to", e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="flex items-center justify-center text-gray-300 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium pt-1"
      >
        <Plus className="h-3.5 w-3.5" />
        Zeile hinzufügen
      </button>
    </div>
  );
}

const LBL = "block text-xs font-medium text-gray-500 mb-1";
