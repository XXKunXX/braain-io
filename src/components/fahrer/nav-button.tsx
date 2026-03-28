"use client";

import { useState } from "react";
import { Navigation, X } from "lucide-react";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

// ─── Single destination ───────────────────────────────────────────────────────

function openGoogleMaps(destination: string, origin?: string) {
  const encodedDest = encodeURIComponent(destination);
  const encodedOrigin = origin ? encodeURIComponent(origin) : "";
  if (isIOS()) {
    window.location.href = origin
      ? `comgooglemaps://?saddr=${encodedOrigin}&daddr=${encodedDest}&directionsmode=driving`
      : `comgooglemaps://?daddr=${encodedDest}&directionsmode=driving`;
  } else if (isAndroid()) {
    window.location.href = `google.navigation:q=${encodedDest}`;
  } else {
    const p = new URLSearchParams({ api: "1", destination });
    if (origin) p.set("origin", origin);
    window.open(`https://www.google.com/maps/dir/?${p}`, "_blank");
  }
}

function openAppleMaps(destination: string, origin?: string) {
  const encodedDest = encodeURIComponent(destination);
  const encodedOrigin = origin ? encodeURIComponent(origin) : "";
  window.location.href = origin
    ? `maps://?saddr=${encodedOrigin}&daddr=${encodedDest}&dirflg=d`
    : `maps://?daddr=${encodedDest}&dirflg=d`;
}

// ─── Multi-stop route ─────────────────────────────────────────────────────────

export function openGoogleMapsRoute(stops: string[]) {
  if (stops.length === 0) return;
  if (isIOS() && stops.length >= 2) {
    // comgooglemaps:// supports waypoints: saddr → waypoints → daddr
    const origin = encodeURIComponent(stops[0]);
    const dest   = encodeURIComponent(stops[stops.length - 1]);
    const waypoints = stops.slice(1, -1).map(encodeURIComponent).join("|");
    const url = waypoints
      ? `comgooglemaps://?saddr=${origin}&daddr=${dest}&waypoints=${waypoints}&directionsmode=driving`
      : `comgooglemaps://?saddr=${origin}&daddr=${dest}&directionsmode=driving`;
    window.location.href = url;
  } else if (isAndroid() && stops.length >= 2) {
    // Android: use web URL (Google Maps handles it)
    window.open(`https://www.google.com/maps/dir/${stops.map(encodeURIComponent).join("/")}`, "_blank");
  } else {
    window.open(`https://www.google.com/maps/dir/${stops.map(encodeURIComponent).join("/")}`, "_blank");
  }
}

export function openAppleMapsRoute(stops: string[]) {
  if (stops.length === 0) return;
  // Apple Maps URL scheme doesn't support waypoints — navigate origin → final destination
  const origin = encodeURIComponent(stops[0]);
  const dest   = encodeURIComponent(stops[stops.length - 1]);
  window.location.href = `maps://?saddr=${origin}&daddr=${dest}&dirflg=d`;
}

// Kept for backward compatibility (used in RouteOptimizeButton fallback)
export function openNavigation(destination: string, origin?: string) {
  const p = new URLSearchParams({ api: "1", destination });
  if (origin) p.set("origin", origin);
  window.open(`https://www.google.com/maps/dir/?${p}`, "_blank");
}

// ─── Picker sheet ─────────────────────────────────────────────────────────────

export function MapsPickerSheet({
  address,
  origin,
  stops,
  onClose,
}: {
  address?: string;
  origin?: string;
  /** Pass stops[] for multi-stop route mode instead of single address */
  stops?: string[];
  onClose: () => void;
}) {
  const isRoute = !!stops && stops.length >= 2;
  const subtitle = isRoute
    ? `${stops.length} Stopps · Firmenadresse → letzte Baustelle`
    : "Öffnet die App mit eingestellter Startadresse";

  function handleGoogle() {
    onClose();
    if (isRoute) openGoogleMapsRoute(stops!);
    else openGoogleMaps(address!, origin);
  }

  function handleApple() {
    onClose();
    if (isRoute) openAppleMapsRoute(stops!);
    else openAppleMaps(address!, origin);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
      <div
        className="relative w-full max-w-sm bg-white rounded-t-[28px] md:rounded-2xl px-5 pt-3"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-1">
          <p className="text-[17px] font-bold text-gray-900">Navigation starten</p>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>
        <p className="text-[12px] text-gray-400 mb-4">{subtitle}</p>

        <div className="space-y-2.5 pb-2">
          <button
            onClick={handleGoogle}
            className="flex items-center gap-3.5 w-full px-4 py-4 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <GoogleMapsIcon />
            <div className="text-left">
              <p className="text-[15px] font-semibold text-gray-900">Google Maps</p>
              <p className="text-[12px] text-gray-400 mt-0.5">
                {isRoute ? "Vollständige Route mit allen Stopps" : "Öffnet die Google Maps App"}
              </p>
            </div>
          </button>

          <button
            onClick={handleApple}
            className="flex items-center gap-3.5 w-full px-4 py-4 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <AppleMapsIcon />
            <div className="text-left">
              <p className="text-[15px] font-semibold text-gray-900">Apple Maps</p>
              <p className="text-[12px] text-gray-400 mt-0.5">
                {isRoute ? "Start → Ziel (ohne Zwischenstopps)" : "Öffnet die Apple Maps App"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NavButton ────────────────────────────────────────────────────────────────

export function NavButton({
  address,
  origin,
  rounded,
}: {
  address: string;
  origin?: string;
  rounded: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center gap-2.5 w-full bg-white border border-gray-200 rounded-${rounded} py-4 text-[15px] font-bold text-gray-800 hover:bg-gray-50 active:scale-[0.99] transition-all`}
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <Navigation className="h-[18px] w-[18px] text-gray-500" />
        Navigation starten
      </button>
      {open && (
        <MapsPickerSheet
          address={address}
          origin={origin}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GoogleMapsIcon() {
  return (
    <svg className="h-9 w-9 flex-shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C15.163 4 8 11.163 8 20c0 13 16 28 16 28s16-15 16-28c0-8.837-7.163-16-16-16z" fill="#EA4335"/>
      <path d="M24 4C15.163 4 8 11.163 8 20c0 13 16 28 16 28V4z" fill="#34A853"/>
      <path d="M24 4v16l8-8C30.343 8.657 27.314 4 24 4z" fill="#FBBC04"/>
      <circle cx="24" cy="20" r="6" fill="white"/>
    </svg>
  );
}

function AppleMapsIcon() {
  return (
    <svg className="h-9 w-9 flex-shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Dark map background */}
      <rect width="48" height="48" rx="11" fill="#1C1C1E"/>
      {/* Gray road network */}
      <path d="M0 30 L48 20" stroke="#3A3A3C" strokeWidth="5"/>
      <path d="M0 18 L48 26" stroke="#3A3A3C" strokeWidth="3"/>
      <path d="M14 0 L20 48" stroke="#3A3A3C" strokeWidth="3"/>
      <path d="M30 0 L36 48" stroke="#3A3A3C" strokeWidth="2"/>
      {/* Blue highway (vertical center-left) */}
      <path d="M21 0 L27 48" stroke="#0A84FF" strokeWidth="5"/>
      <path d="M21 0 L27 48" stroke="#409CFF" strokeWidth="2"/>
      {/* Navigation circle at bottom */}
      <circle cx="24" cy="37" r="6.5" fill="#0A84FF"/>
      <circle cx="24" cy="37" r="6.5" stroke="#409CFF" strokeWidth="0.5"/>
      {/* Navigation arrow (pointing up-right) */}
      <path d="M24 32.5 L27.5 41.5 L24 39.5 L20.5 41.5 Z" fill="white"/>
    </svg>
  );
}
