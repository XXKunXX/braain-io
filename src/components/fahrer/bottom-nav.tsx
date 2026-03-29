"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2, Clock, FileText, MoreHorizontal,
  Fuel, AlertTriangle, ClipboardCheck, CalendarOff, MessageSquare, X,
} from "lucide-react";
import { useState } from "react";

const primaryTabs = [
  { href: "/fahrer", label: "Baustellen", icon: Building2, exact: true },
  { href: "/fahrer/zeiterfassung", label: "Zeit", icon: Clock, exact: false },
  { href: "/fahrer/tagesbericht", label: "Bericht", icon: FileText, exact: false },
];

const moreItems = [
  { href: "/fahrer/nachrichten", label: "Nachrichten", icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
  { href: "/fahrer/fahrzeug-check", label: "Fahrzeug-Check", icon: ClipboardCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
  { href: "/fahrer/schaden", label: "Schadensmeldung", icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50" },
  { href: "/fahrer/tankbuch", label: "Tankbuch", icon: Fuel, color: "text-amber-600", bg: "bg-amber-50" },
  { href: "/fahrer/abwesenheit", label: "Abwesenheit", icon: CalendarOff, color: "text-violet-600", bg: "bg-violet-50" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = moreItems.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* More sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] px-5 pt-3"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <p className="text-[17px] font-bold text-gray-900">Mehr</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 pb-2">
              {moreItems.map(({ href, label, icon: Icon, color, bg }) => (
                <button
                  key={href}
                  onClick={() => { setMoreOpen(false); router.push(href); }}
                  className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl ${bg} active:scale-[0.96] transition-transform`}
                >
                  <Icon className={`h-6 w-6 ${color}`} />
                  <span className={`text-xs font-semibold ${color} text-center leading-tight`}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-4"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div
          className="bg-white/88 backdrop-blur-2xl rounded-[26px] border border-white/70"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <div className="grid grid-cols-4 px-2 py-1.5 gap-0.5">
            {primaryTabs.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1 py-2 rounded-2xl active:bg-gray-50 transition-colors"
                >
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
                      active
                        ? "bg-blue-600"
                        : ""
                    }`}
                    style={active ? { boxShadow: "0 4px 14px rgba(37,99,235,0.45)" } : undefined}
                  >
                    <Icon className={`h-[19px] w-[19px] transition-colors ${active ? "" : "text-gray-400"}`} style={active ? { color: "#F5B400" } : undefined} />
                  </div>
                  <span className={`text-[10px] font-semibold leading-none transition-colors ${active ? "text-blue-600" : "text-gray-400"}`}>
                    {label}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-1 py-2 rounded-2xl active:bg-gray-50 transition-colors"
            >
              <div
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
                  isMoreActive ? "bg-blue-600" : ""
                }`}
                style={isMoreActive ? { boxShadow: "0 4px 14px rgba(37,99,235,0.45)" } : undefined}
              >
                <MoreHorizontal className={`h-[19px] w-[19px] transition-colors ${isMoreActive ? "" : "text-gray-400"}`} style={isMoreActive ? { color: "#F5B400" } : undefined} />
              </div>
              <span className={`text-[10px] font-semibold leading-none transition-colors ${isMoreActive ? "text-blue-600" : "text-gray-400"}`}>
                Mehr
              </span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
