"use client";

import { useState } from "react";
import { Menu, Search, Brain } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "./sidebar";
import { GlobalSearch, useGlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  openTaskCount: number;
  userRole?: string;
  showFahrerApp?: boolean;
}

export function AppShell({ children, openTaskCount, userRole, showFahrerApp }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — slides in on mobile, always visible on desktop */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <Sidebar
          openTaskCount={openTaskCount}
          onClose={() => setSidebarOpen(false)}
          onSearchOpen={() => setSearchOpen(true)}
          userRole={userRole}
          showFahrerApp={showFahrerApp}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — mobile + desktop */}
        <div className="flex items-center justify-between h-12 px-4 bg-white border-b border-gray-200 sticky top-0 z-20">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 -ml-1"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" }}
              >
                <Brain className="h-3.5 w-3.5 text-white" strokeWidth={1.75} />
              </div>
              <span className="text-sm font-semibold text-gray-900">braain.io</span>
            </div>
          </div>
          {/* Desktop: empty left side */}
          <div className="hidden md:block" />
          {/* Right side: search + user */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
            >
              <Search className="h-5 w-5" />
            </button>
            <NotificationBell />
            <UserButton
              appearance={{ elements: { avatarBox: "w-8 h-8" } }}
              userProfileMode="navigation"
              userProfileUrl="/einstellungen"
            />
          </div>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
