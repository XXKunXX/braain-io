import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getOpenTaskCount } from "@/actions/tasks";
import { getUserPreferences } from "@/actions/user-preferences";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";
  if (role === "Fahrer") redirect("/fahrer");

  const [openTaskCount, prefs] = await Promise.all([
    getOpenTaskCount(),
    role === "Admin" ? getUserPreferences() : Promise.resolve({ showFahrerApp: false }),
  ]);

  return (
    <AppShell openTaskCount={openTaskCount} userRole={role} showFahrerApp={prefs.showFahrerApp}>
      {children}
    </AppShell>
  );
}
