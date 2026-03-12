import { Sidebar } from "@/components/layout/sidebar";
import { getOpenTaskCount } from "@/actions/tasks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const openTaskCount = await getOpenTaskCount();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar openTaskCount={openTaskCount} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
