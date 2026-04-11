import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SupportConversationList } from "@/components/support/support-conversation-list";

export default async function SupportPage() {
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "";
  if (role !== "Admin") redirect("/dashboard");

  const conversations = await prisma.supportConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Support-Gespräche"
        subtitle="Alle Chat-Gespräche der Benutzer mit dem Support-Bot"
      />
      <SupportConversationList conversations={conversations} />
    </div>
  );
}
