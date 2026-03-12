import { getResources } from "@/actions/resources";
import { ResourceList } from "@/components/resources/resource-list";

export default async function RessourcenPage() {
  const resources = await getResources();
  return <ResourceList resources={resources} />;
}
