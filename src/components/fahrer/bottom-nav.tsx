"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Clock, FileText } from "lucide-react";

const tabs = [
  { href: "/fahrer", label: "Baustellen", icon: Building2, exact: true },
  { href: "/fahrer/zeiterfassung", label: "Zeiterfassung", icon: Clock, exact: false },
  { href: "/fahrer/tagesbericht", label: "Tagesbericht", icon: FileText, exact: false },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 safe-area-pb md:hidden">
      <div className="grid grid-cols-3">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
                active ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-indigo-600" : ""}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
