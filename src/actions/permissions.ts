"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { type RolePermissions } from "@/lib/permissions-config";

export async function saveRolePermissions(permissions: RolePermissions) {
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "";
  if (role !== "Admin") return { error: "Keine Berechtigung" };

  // Admin-Berechtigungen werden nie gespeichert — immer voll
  const { Admin: _admin, ...rest } = permissions;

  await prisma.appSettings.upsert({
    where:  { id: "singleton" },
    update: { rolePermissions: rest },
    create: { id: "singleton", rolePermissions: rest },
  });

  revalidatePath("/benutzer");
  return { success: true };
}
