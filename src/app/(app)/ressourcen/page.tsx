import { getResources } from "@/actions/resources";
import { getMachines } from "@/actions/machines";
import { ResourceList } from "@/components/resources/resource-list";

export default async function RessourcenPage() {
  const [resources, machines] = await Promise.all([
    getResources(),
    getMachines(),
  ]);
  return <ResourceList resources={resources} machines={machines} />;
}
