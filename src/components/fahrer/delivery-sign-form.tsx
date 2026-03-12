"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, RotateCcw } from "lucide-react";
import { createSignedDeliveryNote } from "@/actions/driver";
import { toast } from "sonner";

type Item = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
};

interface Props {
  orderId: string;
  orderTitle: string;
  contactId: string;
  contactName: string;
  items: Item[];
}

const UNITS = ["t", "m³", "m²", "m", "Stk", "Fuhre"];

export function DeliverySignForm({ orderId, orderTitle, contactId, contactName, items }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const [selectedItem, setSelectedItem] = useState<string>(items[0]?.id ?? "");
  const [customMaterial, setCustomMaterial] = useState("");
  const [quantity, setQuantity] = useState(items[0] ? String(items[0].quantity) : "");
  const [unit, setUnit] = useState(items[0]?.unit ?? "t");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, []);

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setDrawing(true);
    const pos = getPos(e);
    lastPos.current = pos;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) { ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!drawing) return;
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && lastPos.current) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasSignature(true);
    }
    lastPos.current = pos;
  }

  function endDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setDrawing(false);
    lastPos.current = null;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx?.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!hasSignature) { toast.error("Bitte Unterschrift eintragen"); return; }
    const material = items.length > 0
      ? (items.find((i) => i.id === selectedItem)?.description ?? customMaterial)
      : customMaterial;
    if (!material) { toast.error("Bitte Material angeben"); return; }
    const canvas = canvasRef.current!;
    const signatureUrl = canvas.toDataURL("image/png");
    setLoading(true);
    try {
      const result = await createSignedDeliveryNote({
        orderId, contactId,
        date: new Date().toISOString().split("T")[0],
        material, quantity: Number(quantity) || 0, unit,
        driver: "", vehicle: "", notes: "",
        signatureUrl, signerName,
      });
      if (result.deliveryNote) {
        toast.success("Lieferschein erfolgreich erstellt");
        router.push(`/fahrer/${orderId}`);
      } else {
        toast.error("Fehler beim Erstellen");
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedItemData = items.find((i) => i.id === selectedItem);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Mobile (< md) ── */}
      <div className="md:hidden max-w-lg mx-auto px-4 py-6 pb-28">
        <BackLink orderId={orderId} />
        <PageHeader contactName={contactName} orderTitle={orderTitle} />
        <MaterialBlock items={items} selectedItem={selectedItem} setSelectedItem={setSelectedItem}
          quantity={quantity} setQuantity={setQuantity} unit={unit} setUnit={setUnit}
          customMaterial={customMaterial} setCustomMaterial={setCustomMaterial}
          selectedItemData={selectedItemData} />
        <PhotoBlock photoPreview={photoPreview} setPhotoPreview={setPhotoPreview} onPhoto={handlePhoto} />
        <SignatureBlock canvasRef={canvasRef} startDraw={startDraw} draw={draw} endDraw={endDraw}
          hasSignature={hasSignature} clearSignature={clearSignature} />
        <NameBlock signerName={signerName} setSignerName={setSignerName} />
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <SubmitButton loading={loading} disabled={!hasSignature} onSubmit={handleSubmit} rounded="2xl" />
      </div>

      {/* ── Tablet / Desktop (≥ md) ── */}
      <div className="hidden md:block max-w-5xl mx-auto px-6 lg:px-10 py-8">
        <BackLink orderId={orderId} />
        <PageHeader contactName={contactName} orderTitle={orderTitle} />
        <div className="grid grid-cols-2 gap-8 mt-2">
          <div>
            <MaterialBlock items={items} selectedItem={selectedItem} setSelectedItem={setSelectedItem}
              quantity={quantity} setQuantity={setQuantity} unit={unit} setUnit={setUnit}
              customMaterial={customMaterial} setCustomMaterial={setCustomMaterial}
              selectedItemData={selectedItemData} />
            <PhotoBlock photoPreview={photoPreview} setPhotoPreview={setPhotoPreview} onPhoto={handlePhoto} />
          </div>
          <div>
            <SignatureBlock canvasRef={canvasRef} startDraw={startDraw} draw={draw} endDraw={endDraw}
              hasSignature={hasSignature} clearSignature={clearSignature} />
            <NameBlock signerName={signerName} setSignerName={setSignerName} />
            <div className="mt-2">
              <SubmitButton loading={loading} disabled={!hasSignature} onSubmit={handleSubmit} rounded="xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function BackLink({ orderId }: { orderId: string }) {
  return (
    <Link href={`/fahrer/${orderId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
      <ArrowLeft className="h-4 w-4" /> Zurück
    </Link>
  );
}

function PageHeader({ contactName, orderTitle }: { contactName: string; orderTitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-gray-900">Lieferschein</h1>
      <p className="text-sm text-gray-400 mt-0.5">{contactName} — {orderTitle}</p>
    </div>
  );
}

function MaterialBlock({ items, selectedItem, setSelectedItem, quantity, setQuantity, unit, setUnit, customMaterial, setCustomMaterial, selectedItemData }: {
  items: Item[]; selectedItem: string; setSelectedItem: (v: string) => void;
  quantity: string; setQuantity: (v: string) => void; unit: string; setUnit: (v: string) => void;
  customMaterial: string; setCustomMaterial: (v: string) => void; selectedItemData: Item | undefined;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">Material</p>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <button key={item.id} type="button"
              onClick={() => { setSelectedItem(item.id); setQuantity(String(item.quantity)); setUnit(item.unit); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors text-left ${
                selectedItem === item.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              }`}>
              <span className="text-sm text-gray-900">{item.description}</span>
              <span className="text-xs text-gray-400">{item.quantity} {item.unit}</span>
            </button>
          ))}
          {selectedItemData && (
            <div className="flex gap-2 mt-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Menge</label>
                <input type="number" min="0" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-500 mb-1 block">Einheit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-400">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input type="text" placeholder="Material eingeben..." value={customMaterial} onChange={(e) => setCustomMaterial(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          <div className="flex gap-2">
            <input type="number" min="0" step="0.001" placeholder="Menge" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-400">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoBlock({ photoPreview, setPhotoPreview, onPhoto }: {
  photoPreview: string | null; setPhotoPreview: (v: string | null) => void;
  onPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">Foto der Lieferung</p>
      {photoPreview ? (
        <div className="relative">
          <img src={photoPreview} alt="Lieferung" className="w-full rounded-xl object-cover max-h-48" />
          <button type="button" onClick={() => setPhotoPreview(null)}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-500">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-gray-300 transition-colors">
          <Camera className="h-8 w-8 text-gray-300 mb-2" />
          <span className="text-sm text-gray-400">Foto aufnehmen (optional)</span>
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
        </label>
      )}
    </div>
  );
}

function SignatureBlock({ canvasRef, startDraw, draw, endDraw, hasSignature, clearSignature }: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  startDraw: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  draw: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  endDraw: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  hasSignature: boolean; clearSignature: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-1">Kundenunterschrift</p>
      <p className="text-xs text-gray-400 mb-3">Bitte Kunden hier unterschreiben lassen</p>
      <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-36 touch-none cursor-crosshair"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
      </div>
      {hasSignature && (
        <button type="button" onClick={clearSignature}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RotateCcw className="h-3.5 w-3.5" /> Unterschrift löschen
        </button>
      )}
    </div>
  );
}

function NameBlock({ signerName, setSignerName }: { signerName: string; setSignerName: (v: string) => void }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">Name der unterschreibenden Person</p>
      <input type="text" placeholder="Vor- und Nachname" value={signerName} onChange={(e) => setSignerName(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
    </div>
  );
}

function SubmitButton({ loading, disabled, onSubmit, rounded }: {
  loading: boolean; disabled: boolean; onSubmit: () => void; rounded: string;
}) {
  return (
    <button type="button" onClick={onSubmit} disabled={loading || disabled}
      className={`w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-${rounded} py-4 text-sm font-semibold text-white transition-colors`}>
      {loading ? "Wird gespeichert..." : "Lieferschein abschließen"}
    </button>
  );
}
