"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { de } from "date-fns/locale";

const FORMAT_OPTIONS = [
  { value: "bmd", label: "BMD NTCS" },
  { value: "datev", label: "DATEV" },
] as const;

function getMonthOptions() {
  const options = [];
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i);
    options.push({
      label: format(d, "MMMM yyyy", { locale: de }),
      from: format(startOfMonth(d), "yyyy-MM-dd"),
      to: format(endOfMonth(d), "yyyy-MM-dd"),
    });
  }
  return options;
}

export function InvoiceExportButton() {
  const [open, setOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"bmd" | "datev">("bmd");
  const months = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(months[1]); // Vormonat
  const [downloading, setDownloading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleDownload() {
    setDownloading(true);
    const url = `/api/export/rechnungen?from=${selectedMonth.from}&to=${selectedMonth.to}&format=${exportFormat}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
    setTimeout(() => setDownloading(false), 1000);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        <Download className="h-3.5 w-3.5" />
        Export
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Buchhaltungsexport</p>

          {/* Monat */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Zeitraum</label>
            <select
              value={selectedMonth.from}
              onChange={(e) => {
                const m = months.find((m) => m.from === e.target.value);
                if (m) setSelectedMonth(m);
              }}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {months.map((m) => (
                <option key={m.from} value={m.from}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Format</label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExportFormat(opt.value)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    exportFormat === opt.value
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Wird erstellt…" : "CSV herunterladen"}
          </Button>
        </div>
      )}
    </div>
  );
}
