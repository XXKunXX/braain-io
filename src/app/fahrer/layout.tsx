import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BottomNav } from "@/components/fahrer/bottom-nav";
import { PushSubscribeButton } from "@/components/fahrer/push-subscribe-button";

export default async function FahrerLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";
  const isFahrer = role === "Fahrer";
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Mobile header — iOS-style with centered title */}
      <header className="md:hidden relative flex items-center justify-between px-4 py-2.5 bg-white/90 backdrop-blur-md border-b border-gray-100/80 sticky top-0 z-30" style={{ minHeight: "52px" }}>
        {/* Left: brand icon */}
        <div
          className="w-7 h-7 rounded-[8px] flex-shrink-0 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #1E6FB5 0%, #2B84D4 100%)" }}
        >
          <span className="text-[10px] font-black tracking-tight leading-none" style={{ color: "#F5B400" }}>ER</span>
        </div>

        {/* Center: title — absolute so it's truly centered regardless of side widths */}
        <span className="absolute left-1/2 -translate-x-1/2 text-[16px] font-semibold text-gray-900 tracking-tight pointer-events-none">
          Fahrerapp
        </span>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <PushSubscribeButton />
          {initials && (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)" }}
            >
              <span className="text-[10px] font-bold text-white">{initials}</span>
            </div>
          )}
        </div>
      </header>

      {/* Desktop / tablet header */}
      <header className="hidden md:flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-30">
        <div
          className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #1E6FB5 0%, #2B84D4 100%)" }}
        >
          <span className="text-[12px] font-black tracking-tight leading-none" style={{ color: "#F5B400" }}>ER</span>
        </div>
        <span className="text-sm font-medium text-gray-900">Fahrerapp</span>
        <div className="ml-auto flex items-center gap-4">
          <PushSubscribeButton />
          {!isFahrer && (
            <Link
              href="/dashboard"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Zurück zum Dashboard
            </Link>
          )}
          {user && (
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)" }}
              >
                <span className="text-xs font-semibold text-white">{initials}</span>
              </div>
              <span className="text-sm text-gray-700 font-medium">
                {user.firstName} {user.lastName}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="pb-32 md:pb-0">{children}</div>
      <BottomNav />
    </div>
  );
}
