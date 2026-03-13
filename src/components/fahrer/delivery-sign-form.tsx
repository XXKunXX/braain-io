"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, RotateCcw, Plus, Trash2 } from "lucide-react";
import { createSignedDeliveryNote } from "@/actions/driver";
import { toast } from "sonner";

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
};

type DeliveryLine = {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  isCustom: boolean;
};

interface Props {
  orderId: string;
  orderTitle: string;
  contactId: string;
  contactName: string;
  items: QuoteItem[];
}

const UNITS = ["t", "m³", "m²", "m", "Stk", "Fuhre"];

let _keyCounter = 0;
function nextKey() { return `line-${++_keyCounter}`; }

// Initialise a canvas element for drawing (lazy, on first interaction)
function initCanvas(canvas: HTMLCanvasElement) {
  if (canvas.dataset.init === "1") return;
  canvas.dataset.init = "1";
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function getPos(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement
) {
  const rect = canvas.getBoundingClientRect();
  if ("touches" in e) {
    const touch = e.touches[0];
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }
  return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
}

export function DeliverySignForm({ orderId, orderTitle, contactId, contactName, items }: Props) {
  const router = useRouter();

  // Track which canvas the user is actively drawing on
  const activeCanvas = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lines, setLines] = useState<DeliveryLine[]>(() =>
    items.length > 0
      ? items.map((item) => ({
          key: item.id,
          description: item.description,
          quantity: String(item.quantity),
          unit: item.unit,
          isCustom: false,
        }))
      : [{ key: nextKey(), description: "", quantity: "", unit: "t", isCustom: true }]
  );

  // ── Drawing handlers — use e.currentTarget so correct canvas is always used ──

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = e.currentTarget as HTMLCanvasElement;
    initCanvas(canvas);
    activeCanvas.current = canvas;
    isDrawing.current = true;
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current || !activeCanvas.current) return;
    const canvas = activeCanvas.current;
    const pos = getPos(e, canvas);
    const ctx = canvas.getContext("2d")!;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
    lastPos.current = pos;
  }

  function endDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDrawing.current = false;
    lastPos.current = null;
  }

  function clearSignature() {
    const canvas = activeCanvas.current;
    if (!canvas) return;
    canvas.dataset.init = "";            // reset so next touch re-inits
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  // ── Material lines ──

  function addCustomLine() {
    setLines((prev) => [...prev, { key: nextKey(), description: "", quantity: "", unit: "t", isCustom: true }]);
  }

  function updateLine(key: string, field: keyof Omit<DeliveryLine, "key" | "isCustom">, value: string) {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  // ── Photo ──

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // ── Submit ──

  async function handleSubmit() {
    if (!hasSignature || !activeCanvas.current) { toast.error("Bitte Unterschrift eintragen"); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.quantity);
    if (validLines.length === 0) { toast.error("Bitte mindestens ein Material angeben"); return; }

    const signatureUrl = activeCanvas.current.toDataURL("image/png");
    setLoading(true);
    try {
      const result = await createSignedDeliveryNote({
        orderId,
        contactId,
        date: new Date().toISOString().split("T")[0],
        lines: validLines.map((l) => ({ material: l.description, quantity: Number(l.quantity) || 0, unit: l.unit })),
        driver: "",
        vehicle: "",
        notes: "",
        signatureUrl,
        signerName,
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

  // ── Signature canvas element (reused for both layouts) ──
  const canvasEl = (
    <canvas
      className="w-full h-48 touch-none cursor-crosshair"
      style={{ touchAction: "none" }}
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={endDraw}
      onMouseLeave={endDraw}
      onTouchStart={startDraw}
      onTouchMove={draw}
      onTouchEnd={endDraw}
    />
  );

  const signatureBlock = (
    <div className="bg-white rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-1">Kundenunterschrift</p>
      <p className="text-xs text-gray-400 mb-3">Bitte Kunden hier unterschreiben lassen</p>
      <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white">
        {canvasEl}
      </div>
      {!hasSignature && (
        <p className="mt-2 text-center text-xs text-gray-300 select-none">↑ Hier unterschreiben</p>
      )}
      {hasSignature && (
        <button type="button" onClick={clearSignature}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RotateCcw className="h-3.5 w-3.5" /> Unterschrift löschen
        </button>
      )}
    </div>
  );

  const submitButton = (rounded: string) => (
    <button type="button" onClick={handleSubmit} disabled={loading || !hasSignature}
      className={`w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-${rounded} py-4 text-sm font-semibold text-white transition-colors`}>
      {loading ? "Wird gespeichert..." : "Lieferschein abschließen"}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Mobile (< md) ── */}
      <div className="md:hidden max-w-lg mx-auto px-4 py-6 pb-28">
        <Link href={`/fahrer/${orderId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Lieferschein erstellen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contactName} — {orderTitle}</p>
        </div>
        <MaterialBlock lines={lines} onUpdate={updateLine} onRemove={removeLine} onAdd={addCustomLine} />
        <PhotoBlock photoPreview={photoPreview} setPhotoPreview={setPhotoPreview} onPhoto={handlePhoto} />
        {signatureBlock}
        <NameBlock signerName={signerName} setSignerName={setSignerName} />
      </div>
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        {submitButton("2xl")}
      </div>

      {/* ── Tablet / Desktop (≥ md) ── */}
      <div className="hidden md:block max-w-5xl mx-auto px-6 lg:px-10 py-8">
        <Link href={`/fahrer/${orderId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Lieferschein erstellen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{contactName} — {orderTitle}</p>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <MaterialBlock lines={lines} onUpdate={updateLine} onRemove={removeLine} onAdd={addCustomLine} />
            <PhotoBlock photoPreview={photoPreview} setPhotoPreview={setPhotoPreview} onPhoto={handlePhoto} />
          </div>
          <div>
            {signatureBlock}
            <NameBlock signerName={signerName} setSignerName={setSignerName} />
            <div className="mt-2">{submitButton("xl")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function MaterialBlock({ lines, onUpdate, onRemove, onAdd }: {
  lines: DeliveryLine[];
  onUpdate: (key: string, field: keyof Omit<DeliveryLine, "key" | "isCustom">, value: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">Materialien</p>
      <div className="space-y-3">
        {lines.map((line) => (
          <div key={line.key} className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              {line.isCustom ? (
                <input type="text" placeholder="Material eingeben..." value={line.description}
                  onChange={(e) => onUpdate(line.key, "description", e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              ) : (
                <p className="flex-1 text-sm font-medium text-gray-900 py-1">{line.description}</p>
              )}
              <button type="button" onClick={() => onRemove(line.key)}
                className="p-1.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-400 mb-1 block">Menge</label>
                <input type="number" min="0" step="0.001" placeholder="0" value={line.quantity}
                  onChange={(e) => onUpdate(line.key, "quantity", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-400 mb-1 block">Einheit</label>
                <select value={line.unit} onChange={(e) => onUpdate(line.key, "unit", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-400">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd}
        className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
        <Plus className="h-4 w-4" />
        Weiteres Material hinzufügen
      </button>
    </div>
  );
}

function PhotoBlock({ photoPreview, setPhotoPreview, onPhoto }: {
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
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

function NameBlock({ signerName, setSignerName }: { signerName: string; setSignerName: (v: string) => void }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">Name der unterschreibenden Person</p>
      <input type="text" placeholder="Vor- und Nachname" value={signerName}
        onChange={(e) => setSignerName(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
    </div>
  );
}
