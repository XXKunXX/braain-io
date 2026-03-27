import { getCalendarIntegrations } from "@/actions/kalender-integration";
import { KalenderIntegrationClient } from "@/components/settings/kalender-integration-client";

export default async function KalenderIntegrationPage() {
  const integrations = await getCalendarIntegrations();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Kalender-Integration</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Verbinde deinen Kalender und synchronisiere Aufträge, Baustellen und Aufgaben automatisch.
        </p>
      </div>
      <KalenderIntegrationClient integrations={integrations} />
    </div>
  );
}
