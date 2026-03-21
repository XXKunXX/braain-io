import { getSettings } from "@/actions/settings";
import { ProgrammeinstellungenClient } from "@/components/settings/programmeinstellungen-client";

export default async function ProgrammeinstellungenPage() {
  const settings = await getSettings();

  const serialized = {
    ...settings,
    vatRate:   Number(settings.vatRate),
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Programmeinstellungen</h1>
        <p className="text-sm text-gray-400 mt-0.5">Firmendaten, Bankverbindung und Dokumenteinstellungen</p>
      </div>
      <ProgrammeinstellungenClient settings={serialized} />
    </div>
  );
}
