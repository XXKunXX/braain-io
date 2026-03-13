"use client";

import { Navigation } from "lucide-react";

export function NavButton({ address, rounded }: { address: string; rounded: string }) {
  function handleNavigation() {
    const encoded = encodeURIComponent(address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      // Try Google Maps app first, fall back to web after 500ms
      const appUrl = `comgooglemaps://?daddr=${encoded}&directionsmode=driving`;
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
      window.location.href = appUrl;
      setTimeout(() => window.open(webUrl, "_blank"), 500);
    } else {
      // Android: Google Maps handles this URL via intent and opens in the app
      window.location.href = `google.navigation:q=${encoded}`;
    }
  }

  return (
    <button
      onClick={handleNavigation}
      className={`flex items-center justify-center gap-2 w-full bg-white border border-gray-200 rounded-${rounded} py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors`}
    >
      <Navigation className="h-4 w-4" />
      Navigation starten
    </button>
  );
}
