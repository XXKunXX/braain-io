"use client";

import { Share2, Copy } from "lucide-react";
import { toast } from "sonner";

export function ShareLieferscheinButton({
  deliveryNumber,
  pdfUrl,
}: {
  deliveryNumber: string;
  pdfUrl: string;
}) {
  async function handleShare() {
    const fullUrl = `${window.location.origin}${pdfUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Lieferschein ${deliveryNumber}`,
          text: `Lieferschein ${deliveryNumber}`,
          url: fullUrl,
        });
      } catch {
        // User cancelled share dialog — no error needed
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(fullUrl);
        toast.success("Link kopiert");
      } catch {
        toast.error("Teilen nicht möglich");
      }
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 hover:bg-gray-50 rounded-2xl py-4 text-sm font-semibold text-gray-700 transition-colors"
    >
      {typeof navigator !== "undefined" && "share" in navigator ? (
        <Share2 className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      Teilen / Link kopieren
    </button>
  );
}
