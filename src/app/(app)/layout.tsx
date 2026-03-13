import { AppShell } from "@/components/layout/app-shell";
import { getOpenTaskCount } from "@/actions/tasks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const openTaskCount = await getOpenTaskCount();
  return <AppShell openTaskCount={openTaskCount}>{children}</AppShell>;
}
