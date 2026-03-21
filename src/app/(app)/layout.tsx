import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getOpenTaskCount } from "@/actions/tasks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";
  if (role === "Fahrer") redirect("/fahrer");

  const openTaskCount = await getOpenTaskCount();
  return <AppShell openTaskCount={openTaskCount} userRole={role}>{children}</AppShell>;
}
