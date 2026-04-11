import { getSettings } from "@/actions/settings";
import { ProgrammeinstellungenClient } from "@/components/settings/programmeinstellungen-client";

export default async function ProgrammeinstellungenPage() {
  const settings = await getSettings();

  const serialized = {
    id:                  settings.id,
    companyName:         settings.companyName,
    companySlogan:       settings.companySlogan,
    street:              settings.street,
    postalCode:          settings.postalCode,
    city:                settings.city,
    country:             settings.country,
    phone:               settings.phone,
    fax:                 settings.fax,
    email:               settings.email,
    website:             settings.website,
    uid:                 settings.uid,
    gln:                 settings.gln,
    fn:                  settings.fn,
    court:               settings.court,
    bankName:            settings.bankName,
    iban:                settings.iban,
    bic:                 settings.bic,
    blz:                 settings.blz,
    kto:                 settings.kto,
    vatRate:             Number(settings.vatRate),
    quotePrefix:         settings.quotePrefix,
    orderPrefix:         settings.orderPrefix,
    deliveryPrefix:      settings.deliveryPrefix,
    invoicePrefix:       settings.invoicePrefix,
    defaultPaymentTerms: settings.defaultPaymentTerms,
    defaultQuoteNotes:   settings.defaultQuoteNotes,
    rolePermissions:     settings.rolePermissions,
    mahnungCronEnabled:  settings.mahnungCronEnabled,
    createdAt:           settings.createdAt.toISOString(),
    updatedAt:           settings.updatedAt.toISOString(),
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
