"use client";

import { useState } from "react";
import { MapPin, ChevronRight } from "lucide-react";
import { MapsPickerSheet } from "./nav-button";

export function NavAddressCard({ address, origin }: { address: string; origin?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left bg-white rounded-2xl p-4 flex items-center gap-3 active:bg-gray-50 transition-colors"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <MapPin className="h-5 w-5 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Adresse</p>
          <p className="text-[14px] font-semibold text-gray-900 truncate">{address}</p>
          <p className="text-[12px] text-indigo-500 font-medium mt-0.5">Tippen zum Navigieren</p>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
      </button>
      {open && <MapsPickerSheet address={address} origin={origin} onClose={() => setOpen(false)} />}
    </>
  );
}
