"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const resourceSchema = z.object({
  name: z.string().min(1, "Name erforderlich"),
  type: z.enum(["FAHRER", "MASCHINE", "FAHRZEUG", "PRODUKT", "OTHER"]),
  email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  phone: z.string().optional(),
  description: z.string().optional(),
  clerkUserId: z.string().optional().or(z.literal("")),
  licensePlate: z.string().optional().or(z.literal("")),
  driverResourceId: z.string().optional().or(z.literal("")),
  vehicleManufacturer: z.string().optional().or(z.literal("")),
  vehicleModel: z.string().optional().or(z.literal("")),
  vehicleYear: z.string().optional().or(z.literal("")),
});

export type ResourceFormData = z.infer<typeof resourceSchema>;

export async function getResources() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const resources = await prisma.resource.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      entries: {
        where: {
          startDate: { lte: todayEnd },
          endDate: { gte: today },
        },
        select: { id: true },
      },
      assignedDriver: { select: { id: true, name: true } },
    },
  });

  return resources.map((r) => ({
    ...r,
    isDeployed: r.entries.length > 0,
  }));
}

export async function createResource(data: ResourceFormData) {
  const parsed = resourceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const resource = await prisma.resource.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      description: parsed.data.description || null,
      clerkUserId: parsed.data.clerkUserId || null,
      licensePlate: parsed.data.licensePlate || null,
      driverResourceId: parsed.data.driverResourceId || null,
      vehicleManufacturer: parsed.data.vehicleManufacturer || null,
      vehicleModel: parsed.data.vehicleModel || null,
      vehicleYear: parsed.data.vehicleYear ? parseInt(parsed.data.vehicleYear as string) || null : null,
    },
  });

  revalidatePath("/ressourcen");
  revalidatePath("/disposition");
  return { resource };
}

export async function updateResource(id: string, data: ResourceFormData) {
  const parsed = resourceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const resource = await prisma.resource.update({
    where: { id },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      description: parsed.data.description || null,
      clerkUserId: parsed.data.clerkUserId || null,
      licensePlate: parsed.data.licensePlate || null,
      driverResourceId: parsed.data.driverResourceId || null,
      vehicleManufacturer: parsed.data.vehicleManufacturer || null,
      vehicleModel: parsed.data.vehicleModel || null,
      vehicleYear: parsed.data.vehicleYear ? parseInt(parsed.data.vehicleYear as string) || null : null,
    },
  });

  revalidatePath("/ressourcen");
  revalidatePath("/disposition");
  return { resource };
}

export async function deleteResource(id: string) {
  await prisma.resource.delete({ where: { id } });
  revalidatePath("/ressourcen");
  revalidatePath("/disposition");
  return { success: true };
}
