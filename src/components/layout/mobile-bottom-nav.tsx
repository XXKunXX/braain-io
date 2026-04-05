"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  MapPin,
  Users,
  MoreHorizontal,
  ClipboardList,
  FileText,
  CalendarDays,
  Smartphone,
  Banknote,
  Archive,
  CheckSquare,
  UserCog,
  HardHat,
  Settings,
  X,
  CalendarCog,
} from "lucide-react";

interface MobileBottomNavProps {
  newRequestCount?: number;
  openTaskCount?: number;
  overduePaymentCount?: number;
  userRole?: string;
  showFahrerApp?: boolean;
}

const mainTabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badgeKey: "" },
  { href: "/anfragen", label: "Anfragen", icon: MessageSquare, badgeKey: "requests" },
  { href: "/baustellen", label: "Baustellen", icon: MapPin, badgeKey: "" },
  { href: "/kontakte", label: "Kontakte", icon: Users, badgeKey: "" },
] as const;

export function MobileBottomNav({
  newRequestCount = 0,
  openTaskCount = 0,
  overduePaymentCount = 0,
  userRole,
  showFahrerApp,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreItems = [
    { href: "/auftraege", label: "Aufträge", icon: ClipboardList, badge: 0 },
    { href: "/angebote", label: "Angebote", icon: FileText, badge: 0 },
    { href: "/aufgaben", label: "Aufgaben", icon: CheckSquare, badge: openTaskCount },
    { href: "/disposition", label: "Disposition", icon: CalendarDays, badge: 0 },
    { href: "/zahlungen", label: "Offene Posten", icon: Banknote, badge: overduePaymentCount },
    { href: "/rechnungen", label: "Rechnungen", icon: Archive, badge: 0 },
    ...(userRole === "Fahrer" || showFahrerApp
      ? [{ href: "/fahrer", label: "Fahrer App", icon: Smartphone, badge: 0 }]
      : []),
    ...(userRole === "Admin"
      ? [
          { href: "/benutzer", label: "Benutzer", icon: UserCog, badge: 0 },
          { href: "/ressourcen", label: "Ressourcen", icon: HardHat, badge: 0 },
          { href: "/kalender-integration", label: "Kalender", icon: CalendarCog, badge: 0 },
          { href: "/programmeinstellungen", label: "Einstellungen", icon: Settings, badge: 0 },
        ]
      : []),
  ];

  const badges: Record<string, number> = {
    requests: newRequestCount,
  };

  const moreActive =
    !moreOpen &&
    moreItems.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    );

  return (
    <>
      {/* Backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Mehr sheet — slides up above the bottom nav */}
      <div
        className={cn(
          "fixed left-0 right-0 z-50 md:hidden",
          "bg-white rounded-t-2xl",
          "transition-transform duration-300 ease-out",
          "shadow-[0_-8px_40px_rgba(0,0,0,0.12)]",
          moreOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Mehr</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-1 p-4 pb-5">
          {moreItems.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-colors relative",
                  active ? "bg-blue-50" : "active:bg-gray-100"
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-blue-600" : "text-gray-500"
                    )}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium text-center leading-tight",
                    active ? "text-blue-600" : "text-gray-500"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Nav Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.06)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-stretch h-16">
          {mainTabs.map(({ href, label, icon: Icon, badgeKey }) => {
            const badge = badgeKey ? (badges[badgeKey] ?? 0) : 0;
            const active =
              pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                )}
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-[22px] w-[22px] transition-colors",
                      active ? "text-blue-600" : "text-gray-400"
                    )}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    active ? "text-blue-600" : "text-gray-400"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Mehr */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
          >
            {moreActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
            )}
            <MoreHorizontal
              className={cn(
                "h-[22px] w-[22px] transition-colors",
                moreOpen || moreActive ? "text-blue-600" : "text-gray-400"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium transition-colors",
                moreOpen || moreActive ? "text-blue-600" : "text-gray-400"
              )}
            >
              Mehr
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
