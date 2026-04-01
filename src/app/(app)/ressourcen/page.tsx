import { getResources } from "@/actions/resources";
import { getMachines } from "@/actions/machines";
import { ResourceList } from "@/components/resources/resource-list";

export default async function RessourcenPage() {
  const [resources, machines] = await Promise.all([
    getResources(),
    getMachines(),
  ]);
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Ressourcen</h1>
        <p className="text-sm text-gray-400 mt-0.5">{resources.length} Ressourcen</p>
      </div>
      <ResourceList resources={resources} machines={machines} />
    </div>
  );
}
