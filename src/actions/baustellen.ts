"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ── Types ─────────────────────────────────────────────────────────────────────

export type BaustelleStatusType = "PLANNED" | "ACTIVE" | "COMPLETED";

export type BaustelleRow = {
  id: string;
  orderId: string;
  contactId: string | null;
  name: string;
  description: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  startDate: Date;
  endDate: Date | null;
  status: BaustelleStatusType;
  bauleiter: string | null;
  contactPerson: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  order: { id: string; orderNumber: string; title: string };
  contact: { id: string; companyName: string; contactPerson: string | null } | null;
};

export type DispositionEntryRow = {
  id: string;
  resourceId: string;
  orderId: string;
  baustelleId: string | null;
  startDate: Date;
  endDate: Date;
  notes: string | null;
  resource: { id: string; name: string; type: string };
};

export type MachineUsageRow = {
  id: string;
  machineId: string;
  baustelleId: string | null;
  driverName: string | null;
  startDate: Date;
  endDate: Date | null;
  hours: number | null;
  notes: string | null;
  machine: { id: string; name: string; machineType: string };
};

export type TagesrapportRow = {
  id: string;
  baustelleId: string;
  date: Date;
  driverName: string | null;
  machineName: string | null;
  hours: number | null;
  employees: number | null;
  description: string | null;
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const baustelleSchema = z.object({
  orderId: z.string().min(1, "Auftrag erforderlich"),
  name: z.string().min(1, "Name erforderlich"),
  description: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED"]),
  bauleiter: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

const dispositionSchema = z.object({
  baustelleId: z.string().min(1),
  orderId: z.string().min(1),
  resourceId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional(),
});

const machineUsageSchema = z.object({
  baustelleId: z.string().min(1),
  orderId: z.string().optional().nullable(),
  machineId: z.string().min(1),
  driverName: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  hours: z.number().optional().nullable(),
  notes: z.string().optional(),
});

const rapportSchema = z.object({
  baustelleId: z.string().min(1),
  date: z.string().min(1),
  driverName: z.string().optional(),
  machineName: z.string().optional(),
  hours: z.number().optional().nullable(),
  employees: z.number().optional().nullable(),
  description: z.string().optional(),
});

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getBaustellen(): Promise<BaustelleRow[]> {
  return db.baustelle.findMany({
    orderBy: { startDate: "desc" },
    include: {
      order: { select: { id: true, orderNumber: true, title: true } },
      contact: { select: { id: true, companyName: true, contactPerson: true } },
    },
  });
}

export async function getBaustelle(id: string) {
  const b = await db.baustelle.findUnique({
    where: { id },
    include: {
      order: { select: { id: true, orderNumber: true, title: true } },
      contact: { select: { id: true, companyName: true, contactPerson: true } },
      dispositionEntries: {
        orderBy: { startDate: "desc" },
        include: { resource: { select: { id: true, name: true, type: true } } },
      },
      machineUsages: {
        orderBy: { startDate: "desc" },
        include: { machine: { select: { id: true, name: true, machineType: true } } },
      },
      rapporte: { orderBy: { date: "desc" } },
      deliveryNotes: { orderBy: { date: "desc" } },
    },
  });
  if (!b) return null;

  return {
    ...b,
    machineUsages: b.machineUsages.map((u: any) => ({
      ...u,
      hours: u.hours != null ? Number(u.hours) : null,
    })),
    rapporte: b.rapporte.map((r: any) => ({
      ...r,
      hours: r.hours != null ? Number(r.hours) : null,
    })),
    deliveryNotes: b.deliveryNotes.map((dn: any) => ({
      ...dn,
      quantity: dn.quantity != null ? Number(dn.quantity) : null,
    })),
  };
}

// ── Baustelle CRUD ────────────────────────────────────────────────────────────

export async function createBaustelle(data: z.infer<typeof baustelleSchema>) {
  const parsed = baustelleSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  // Auto-derive contactId from the linked order
  const order = await db.order.findUnique({ where: { id: parsed.data.orderId }, select: { contactId: true } });

  const baustelle = await db.baustelle.create({
    data: {
      orderId: parsed.data.orderId,
      contactId: order?.contactId ?? null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      address: parsed.data.address || null,
      postalCode: parsed.data.postalCode || null,
      city: parsed.data.city || null,
      country: parsed.data.country || "Österreich",
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      status: parsed.data.status,
      bauleiter: parsed.data.bauleiter || null,
      contactPerson: parsed.data.contactPerson || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    },
    include: {
      order: { select: { id: true, orderNumber: true, title: true } },
      contact: { select: { id: true, companyName: true, contactPerson: true } },
    },
  });
  revalidatePath("/baustellen");
  return { baustelle };
}

export async function updateBaustelle(id: string, data: z.infer<typeof baustelleSchema>) {
  const parsed = baustelleSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  // Re-derive contactId if orderId changed
  const order = await db.order.findUnique({ where: { id: parsed.data.orderId }, select: { contactId: true } });

  const baustelle = await db.baustelle.update({
    where: { id },
    data: {
      orderId: parsed.data.orderId,
      contactId: order?.contactId ?? null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      address: parsed.data.address || null,
      postalCode: parsed.data.postalCode || null,
      city: parsed.data.city || null,
      country: parsed.data.country || "Österreich",
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      status: parsed.data.status,
      bauleiter: parsed.data.bauleiter || null,
      contactPerson: parsed.data.contactPerson || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    },
    include: {
      order: { select: { id: true, orderNumber: true, title: true } },
      contact: { select: { id: true, companyName: true, contactPerson: true } },
    },
  });
  revalidatePath("/baustellen");
  revalidatePath(`/baustellen/${id}`);
  return { baustelle };
}

export async function deleteBaustelle(id: string) {
  await db.baustelle.delete({ where: { id } });
  revalidatePath("/baustellen");
  return { success: true };
}

// ── Disposition Entries (Baustelle-scoped) ────────────────────────────────────

export async function createBaustelleDispositionEntry(data: z.infer<typeof dispositionSchema>) {
  const parsed = dispositionSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const [entry] = await Promise.all([
    db.dispositionEntry.create({
      data: {
        resourceId: parsed.data.resourceId,
        orderId: parsed.data.orderId,
        baustelleId: parsed.data.baustelleId,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        notes: parsed.data.notes || null,
      },
      include: { resource: { select: { id: true, name: true, type: true } } },
    }),
    db.order.updateMany({
      where: { id: parsed.data.orderId, status: "PLANNED" },
      data: { status: "ACTIVE" },
    }),
  ]);
  revalidatePath(`/baustellen/${parsed.data.baustelleId}`);
  revalidatePath("/disposition");
  return { entry };
}

export async function deleteBaustelleDispositionEntry(id: string, baustelleId: string) {
  await db.dispositionEntry.delete({ where: { id } });
  revalidatePath(`/baustellen/${baustelleId}`);
  revalidatePath("/disposition");
  return { success: true };
}

// ── Machine Usages (Baustelle-scoped) ─────────────────────────────────────────

export async function createBaustelleMachineUsage(data: z.infer<typeof machineUsageSchema>) {
  const parsed = machineUsageSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const usage = await db.machineUsage.create({
    data: {
      machineId: parsed.data.machineId,
      orderId: parsed.data.orderId || null,
      baustelleId: parsed.data.baustelleId,
      driverName: parsed.data.driverName || null,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      hours: parsed.data.hours ?? null,
      notes: parsed.data.notes || null,
    },
    include: { machine: { select: { id: true, name: true, machineType: true } } },
  });
  revalidatePath(`/baustellen/${parsed.data.baustelleId}`);
  return { usage: { ...usage, hours: usage.hours != null ? Number(usage.hours) : null } };
}

export async function deleteBaustelleMachineUsage(id: string, baustelleId: string) {
  await db.machineUsage.delete({ where: { id } });
  revalidatePath(`/baustellen/${baustelleId}`);
  return { success: true };
}

// ── Tagesrapporte ─────────────────────────────────────────────────────────────

export async function createTagesrapport(data: z.infer<typeof rapportSchema>) {
  const parsed = rapportSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const rapport = await db.tagesrapport.create({
    data: {
      baustelleId: parsed.data.baustelleId,
      date: new Date(parsed.data.date),
      driverName: parsed.data.driverName || null,
      machineName: parsed.data.machineName || null,
      hours: parsed.data.hours ?? null,
      employees: parsed.data.employees ?? null,
      description: parsed.data.description || null,
    },
  });
  revalidatePath(`/baustellen/${parsed.data.baustelleId}`);
  return { rapport: { ...rapport, hours: rapport.hours != null ? Number(rapport.hours) : null } };
}

export async function deleteTagesrapport(id: string, baustelleId: string) {
  await db.tagesrapport.delete({ where: { id } });
  revalidatePath(`/baustellen/${baustelleId}`);
  return { success: true };
}
