"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const settingsSchema = z.object({
  // Firmenstammdaten
  companyName:   z.string(),
  companySlogan: z.string(),
  street:        z.string(),
  postalCode:    z.string(),
  city:          z.string(),
  country:       z.string(),
  phone:         z.string(),
  fax:           z.string(),
  email:         z.string(),
  website:       z.string(),
  uid:           z.string(),
  gln:           z.string(),
  fn:            z.string(),
  court:         z.string(),
  // Bankverbindung
  bankName: z.string(),
  iban:     z.string(),
  bic:      z.string(),
  blz:      z.string(),
  kto:      z.string(),
  // Dokument-Einstellungen
  vatRate:             z.coerce.number().min(0).max(1),
  quotePrefix:         z.string().min(1).max(10),
  orderPrefix:         z.string().min(1).max(10),
  deliveryPrefix:      z.string().min(1).max(10),
  defaultPaymentTerms: z.string(),
  defaultQuoteNotes:   z.string(),
  // Automatisierung
  mahnungCronEnabled:  z.boolean(),
});

export type AppSettingsData = z.infer<typeof settingsSchema>;

export async function getSettings() {
  return prisma.appSettings.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function updateSettings(data: AppSettingsData) {
  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const settings = await prisma.appSettings.upsert({
    where:  { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });

  revalidatePath("/programmeinstellungen");
  return { settings };
}
