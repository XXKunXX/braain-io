import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Brain } from "lucide-react";
import Link from "next/link";

export default async function FahrerLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop / tablet header — hidden on mobile */}
      <header className="hidden md:flex items-center gap-4 px-6 py-3.5 bg-white border-b border-gray-200 sticky top-0 z-30">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)" }}
        >
          <Brain className="h-4 w-4 text-white" strokeWidth={1.75} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold text-gray-900 tracking-tight">braain.io</span>
          <span className="text-gray-300 text-sm">/</span>
          <span className="text-sm font-medium text-gray-500">Fahrer App</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Zurück zum Dashboard
          </Link>
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-xs font-semibold text-indigo-600">
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </span>
              </div>
              <span className="text-sm text-gray-700 font-medium">
                {user.firstName} {user.lastName}
              </span>
            </div>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
