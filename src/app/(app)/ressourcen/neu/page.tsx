import { getResources } from "@/actions/resources";
import { NeueRessourceClient } from "@/components/resources/neue-ressource-client";

export default async function NeueRessourcePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const resources = await getResources();
  const fahrer = resources.filter((r) => r.type === "FAHRER");

  return <NeueRessourceClient prefillType={type ?? "FAHRER"} fahrer={fahrer} />;
}
