"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettings } from "@/actions/settings";
import type { AppSettingsData } from "@/actions/settings";

type Props = {
  settings: AppSettingsData & { id: string; createdAt: string; updatedAt: string };
};

export function ProgrammeinstellungenClient({ settings }: Props) {
  const initial: AppSettingsData = {
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
    vatRate:             settings.vatRate,
    quotePrefix:         settings.quotePrefix,
    orderPrefix:         settings.orderPrefix,
    deliveryPrefix:      settings.deliveryPrefix,
    defaultPaymentTerms: settings.defaultPaymentTerms,
    defaultQuoteNotes:   settings.defaultQuoteNotes,
  };
  const [form, setForm] = useState<AppSettingsData>(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function set(field: keyof AppSettingsData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await updateSettings(form);
    setSaving(false);
    if ("error" in result && result.error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Einstellungen gespeichert");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* ── Firmenstammdaten ── */}
      <Card>
        <CardHeader>
          <CardTitle>Firmenstammdaten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1">
            <Label>Firmenname</Label>
            <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label>Slogan</Label>
            <Input value={form.companySlogan} onChange={(e) => set("companySlogan", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Straße</Label>
            <Input value={form.street} onChange={(e) => set("street", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>PLZ</Label>
            <Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Ort</Label>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Land</Label>
            <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fax / DW</Label>
            <Input value={form.fax} onChange={(e) => set("fax", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>E-Mail</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>UID-Nummer</Label>
            <Input value={form.uid} onChange={(e) => set("uid", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>GLN-Nummer</Label>
            <Input value={form.gln} onChange={(e) => set("gln", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Firmenbuchnummer</Label>
            <Input value={form.fn} onChange={(e) => set("fn", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Firmenbuchgericht</Label>
            <Input value={form.court} onChange={(e) => set("court", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ── Bankverbindung ── */}
      <Card>
        <CardHeader>
          <CardTitle>Bankverbindung</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Bank</Label>
            <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>IBAN</Label>
            <Input value={form.iban} onChange={(e) => set("iban", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>BIC</Label>
            <Input value={form.bic} onChange={(e) => set("bic", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>BLZ</Label>
            <Input value={form.blz} onChange={(e) => set("blz", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Kontonummer</Label>
            <Input value={form.kto} onChange={(e) => set("kto", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ── Dokument-Einstellungen ── */}
      <Card>
        <CardHeader>
          <CardTitle>Dokument-Einstellungen</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>MwSt.-Satz (%)</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={form.vatRate * 100}
              onChange={(e) => set("vatRate", Number(e.target.value) / 100)}
            />
          </div>
          <div className="space-y-1">
            <Label>Angebots-Präfix</Label>
            <Input value={form.quotePrefix} onChange={(e) => set("quotePrefix", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Auftrags-Präfix</Label>
            <Input value={form.orderPrefix} onChange={(e) => set("orderPrefix", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Lieferschein-Präfix</Label>
            <Input value={form.deliveryPrefix} onChange={(e) => set("deliveryPrefix", e.target.value)} />
          </div>
          <div className="sm:col-span-3 space-y-1">
            <Label>Standard-Zahlungshinweis (PDF-Fußzeile)</Label>
            <Textarea
              rows={2}
              value={form.defaultPaymentTerms}
              onChange={(e) => set("defaultPaymentTerms", e.target.value)}
            />
          </div>
          <div className="sm:col-span-3 space-y-1">
            <Label>Standard-Hinweise für neue Angebote</Label>
            <Textarea
              rows={3}
              value={form.defaultQuoteNotes}
              onChange={(e) => set("defaultQuoteNotes", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Speichern..." : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
