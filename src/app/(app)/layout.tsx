import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getOpenTaskCount } from "@/actions/tasks";
import { getNewRequestCount } from "@/actions/requests";
import { getOffenePostenCount } from "@/actions/invoices";
import { getUserPreferences } from "@/actions/user-preferences";
import { getPermissions, hasPermission } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";
  if (role === "Fahrer") redirect("/fahrer");

  const [openTaskCount, newRequestCount, overduePaymentCount, prefs, perms] = await Promise.all([
    getOpenTaskCount(),
    getNewRequestCount(),
    getOffenePostenCount(),
    role === "Admin" ? getUserPreferences() : Promise.resolve({ showFahrerApp: false }),
    getPermissions(),
  ]);

  return (
    <AppShell
      openTaskCount={openTaskCount}
      newRequestCount={newRequestCount}
      overduePaymentCount={overduePaymentCount}
      userRole={role}
      showFahrerApp={prefs.showFahrerApp}
      canViewSupport={hasPermission(perms, role, "support.view")}
      canSubmitFeedback={hasPermission(perms, role, "support.feedback")}
    >
      {children}
    </AppShell>
  );
}
