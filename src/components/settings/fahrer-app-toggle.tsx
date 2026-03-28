"use client";

import { useState, useTransition } from "react";
import { Smartphone } from "lucide-react";
import { setShowFahrerApp } from "@/actions/user-preferences";

interface FahrerAppToggleProps {
  initialValue: boolean;
}

export function FahrerAppToggle({ initialValue }: FahrerAppToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await setShowFahrerApp(next);
    });
  }

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Smartphone className="h-4 w-4 text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Fahrer App in Sidebar anzeigen</p>
          <p className="text-xs text-gray-400 mt-0.5">Fügt die Fahrer App zur Navigation hinzu</p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
          enabled ? "bg-blue-600" : "bg-gray-200"
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
