"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MachineStatusType = "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "OUT_OF_SERVICE";
export type MaintenanceTypeValue = "INSPECTION" | "REPAIR" | "SERVICE";

export type MachineRow = {
  id: string;
  name: string;
  machineType: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  serialNumber: string | null;
  licensePlate: string | null;
  hourlyRate: number | null;
  status: MachineStatusType;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  hasOverdueMaintenance: boolean;
};

export type MachineUsageRow = {
  id: string;
  machineId: string;
  orderId: string | null;
  driverName: string | null;
  startDate: Date;
  endDate: Date | null;
  hours: number | null;
  notes: string | null;
  order: { id: string; orderNumber: string; title: string } | null;
};

export type MachineMaintenanceRow = {
  id: string;
  machineId: string;
  maintenanceType: MaintenanceTypeValue;
  description: string | null;
  date: Date;
  cost: number | null;
  nextServiceDate: Date | null;
  performedBy: string | null;
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const machineSchema = z.object({
  name: z.string().min(1, "Name erforderlich"),
  machineType: z.string().min(1, "Maschinentyp erforderlich"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional().nullable(),
  serialNumber: z.string().optional(),
  licensePlate: z.string().optional(),
  hourlyRate: z.number().optional().nullable(),
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE", "OUT_OF_SERVICE"]),
  notes: z.string().optional(),
});

const usageSchema = z.object({
  machineId: z.string().min(1),
  orderId: z.string().optional().nullable(),
  driverName: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  hours: z.number().optional().nullable(),
  notes: z.string().optional(),
});

const maintenanceSchema = z.object({
  machineId: z.string().min(1),
  maintenanceType: z.enum(["INSPECTION", "REPAIR", "SERVICE"]),
  description: z.string().optional(),
  date: z.string().min(1),
  cost: z.number().optional().nullable(),
  nextServiceDate: z.string().optional(),
  performedBy: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function mapMachine(m: any): Omit<MachineRow, "hasOverdueMaintenance"> {
  return {
    ...m,
    hourlyRate: m.hourlyRate != null ? Number(m.hourlyRate) : null,
  };
}

function mapUsage(u: any): MachineUsageRow {
  return {
    ...u,
    hours: u.hours != null ? Number(u.hours) : null,
  };
}

function mapMaintenance(m: any): MachineMaintenanceRow {
  return {
    ...m,
    cost: m.cost != null ? Number(m.cost) : null,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getMachines(): Promise<MachineRow[]> {
  const today = new Date();
  const machines = await db.machine.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      maintenances: {
        select: { nextServiceDate: true },
        where: { nextServiceDate: { lt: today } },
      },
    },
  });

  return machines.map((m: any) => ({
    ...mapMachine(m),
    hasOverdueMaintenance: m.maintenances.length > 0,
    maintenances: undefined,
  }));
}

export async function getMachine(id: string) {
  const machine = await db.machine.findUnique({
    where: { id },
    include: {
      usages: {
        orderBy: { startDate: "desc" },
        include: {
          order: { select: { id: true, orderNumber: true, title: true } },
        },
      },
      maintenances: { orderBy: { date: "desc" } },
    },
  });
  if (!machine) return null;

  return {
    ...mapMachine(machine),
    hasOverdueMaintenance: machine.maintenances.some(
      (m: any) => m.nextServiceDate && new Date(m.nextServiceDate) < new Date()
    ),
    usages: machine.usages.map(mapUsage) as MachineUsageRow[],
    maintenances: machine.maintenances.map(mapMaintenance) as MachineMaintenanceRow[],
  };
}

// ── Machine CRUD ──────────────────────────────────────────────────────────────

export async function createMachine(data: z.infer<typeof machineSchema>) {
  const parsed = machineSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const machine = await db.machine.create({
    data: {
      name: parsed.data.name,
      machineType: parsed.data.machineType,
      manufacturer: parsed.data.manufacturer || null,
      model: parsed.data.model || null,
      year: parsed.data.year ?? null,
      serialNumber: parsed.data.serialNumber || null,
      licensePlate: parsed.data.licensePlate || null,
      hourlyRate: parsed.data.hourlyRate ?? null,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    },
  });

  // Auto-create a Resource so the machine appears in disposition planning
  await db.resource.create({
    data: {
      name: parsed.data.name,
      type: "MASCHINE",
      licensePlate: parsed.data.licensePlate || null,
      description: parsed.data.machineType,
      machineId: machine.id,
    },
  });

  revalidatePath("/ressourcen");
  revalidatePath("/disposition");
  return { machine: mapMachine(machine) };
}

export async function updateMachine(id: string, data: z.infer<typeof machineSchema>) {
  const parsed = machineSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const machine = await db.machine.update({
    where: { id },
    data: {
      name: parsed.data.name,
      machineType: parsed.data.machineType,
      manufacturer: parsed.data.manufacturer || null,
      model: parsed.data.model || null,
      year: parsed.data.year ?? null,
      serialNumber: parsed.data.serialNumber || null,
      licensePlate: parsed.data.licensePlate || null,
      hourlyRate: parsed.data.hourlyRate ?? null,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    },
  });

  // Sync the linked Resource so disposition stays up-to-date
  await db.resource.updateMany({
    where: { machineId: id },
    data: {
      name: parsed.data.name,
      licensePlate: parsed.data.licensePlate || null,
      description: parsed.data.machineType,
    },
  });

  revalidatePath("/ressourcen");
  revalidatePath(`/ressourcen/maschinen/${id}`);
  revalidatePath("/disposition");
  return { machine: mapMachine(machine) };
}

export async function deleteMachine(id: string) {
  // Delete the linked Resource first (cascades to DispositionEntries)
  await db.resource.deleteMany({ where: { machineId: id } });
  await db.machine.delete({ where: { id } });
  revalidatePath("/ressourcen");
  revalidatePath("/disposition");
  return { success: true };
}

// ── MachineUsage CRUD ─────────────────────────────────────────────────────────

export async function createMachineUsage(data: z.infer<typeof usageSchema>) {
  const parsed = usageSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const usage = await db.machineUsage.create({
    data: {
      machineId: parsed.data.machineId,
      orderId: parsed.data.orderId || null,
      driverName: parsed.data.driverName || null,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      hours: parsed.data.hours ?? null,
      notes: parsed.data.notes || null,
    },
    include: { order: { select: { id: true, orderNumber: true, title: true } } },
  });
  revalidatePath(`/ressourcen/maschinen/${parsed.data.machineId}`);
  return { usage: mapUsage(usage) };
}

export async function deleteMachineUsage(id: string, machineId: string) {
  await db.machineUsage.delete({ where: { id } });
  revalidatePath(`/ressourcen/maschinen/${machineId}`);
  return { success: true };
}

// ── MachineMaintenance CRUD ───────────────────────────────────────────────────

export async function createMachineMaintenance(data: z.infer<typeof maintenanceSchema>) {
  const parsed = maintenanceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const maintenance = await db.machineMaintenance.create({
    data: {
      machineId: parsed.data.machineId,
      maintenanceType: parsed.data.maintenanceType,
      description: parsed.data.description || null,
      date: new Date(parsed.data.date),
      cost: parsed.data.cost ?? null,
      nextServiceDate: parsed.data.nextServiceDate ? new Date(parsed.data.nextServiceDate) : null,
      performedBy: parsed.data.performedBy || null,
    },
  });
  revalidatePath(`/ressourcen/maschinen/${parsed.data.machineId}`);
  return { maintenance: mapMaintenance(maintenance) };
}

export async function deleteMachineMaintenance(id: string, machineId: string) {
  await db.machineMaintenance.delete({ where: { id } });
  revalidatePath(`/ressourcen/maschinen/${machineId}`);
  return { success: true };
}
