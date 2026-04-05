// Server-only – enthält Prisma-Zugriff, nicht in Client Components importieren
import { prisma } from "@/lib/prisma";
import { mergeWithDefaults, type PermissionKey, type Role, type RolePermissions } from "@/lib/permissions-config";

// Re-exports für bequemen Import in Server-Code
export * from "@/lib/permissions-config";

export async function getPermissions(): Promise<RolePermissions> {
  const settings = await prisma.appSettings.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton" },
    select: { rolePermissions: true },
  });
  const stored = (settings.rolePermissions ?? {}) as Partial<RolePermissions>;
  return mergeWithDefaults(stored);
}

export async function requirePermission(
  role: string,
  permission: PermissionKey
): Promise<void> {
  if (role === "Admin") return;
  const perms = await getPermissions();
  const allowed = perms[role as Role]?.[permission] ?? false;
  if (!allowed) {
    throw new Error(`Keine Berechtigung: ${permission}`);
  }
}
