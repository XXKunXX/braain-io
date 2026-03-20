"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  MessageSquare,
  FileText,
  ClipboardList,
  CalendarDays,
  LayoutDashboard,
  CheckSquare,
  UserCog,
  HardHat,
  Smartphone,
  Brain,
  X,
  MapPin,
  Banknote,
  FolderOpen,
} from "lucide-react";

const navSections = [
  {
    label: "Übersicht",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badgeKey: "" },
      { href: "/aufgaben", label: "Aufgaben", icon: CheckSquare, badgeKey: "tasks" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/kontakte", label: "Kontakte", icon: Users, badgeKey: "" },
      { href: "/anfragen", label: "Anfragen", icon: MessageSquare, badgeKey: "" },
      { href: "/angebote", label: "Angebote", icon: FileText, badgeKey: "" },
      { href: "/auftraege", label: "Aufträge", icon: ClipboardList, badgeKey: "" },
      { href: "/zahlungen", label: "Zahlungen", icon: Banknote, badgeKey: "" },
      { href: "/dokumente", label: "Dokumente", icon: FolderOpen, badgeKey: "" },
    ],
  },
  {
    label: "Baustellenmanagement",
    items: [
      { href: "/baustellen", label: "Baustellen", icon: MapPin, badgeKey: "" },
      { href: "/disposition", label: "Disposition", icon: CalendarDays, badgeKey: "" },
      { href: "/fahrer", label: "Fahrer App", icon: Smartphone, badgeKey: "" },
    ],
  },
  {
    label: "Einstellungen",
    items: [
      { href: "/benutzer", label: "Benutzer", icon: UserCog, badgeKey: "" },
      { href: "/ressourcen", label: "Ressourcen", icon: HardHat, badgeKey: "" },
    ],
  },
];

interface SidebarProps {
  openTaskCount?: number;
  onClose?: () => void;
  onSearchOpen?: () => void;
}

export function Sidebar({ openTaskCount = 0, onClose, onSearchOpen }: SidebarProps) {
  const pathname = usePathname();

  function handleNavClick() {
    onClose?.();
  }

  return (
    <aside className="w-64 md:w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)" }}
            >
              <Brain className="h-4 w-4 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight tracking-tight">braain.io</p>
              <p className="text-[11px] text-gray-400">Erdbau</p>
            </div>
          </div>
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>


<nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-4">
        {navSections.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-2 mb-1">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ href, label: itemLabel, icon: Icon, badgeKey }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                const badge = badgeKey === "tasks" && openTaskCount > 0 ? openTaskCount : null;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 md:py-1.5 rounded-md text-sm transition-colors",
                      active
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-blue-600" : "text-gray-400")} />
                    <span className="flex-1">{itemLabel}</span>
                    {badge !== null && (
                      <span className="text-[11px] font-semibold bg-blue-600 text-white rounded-full px-1.5 py-0.5 leading-none">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

    </aside>
  );
}
