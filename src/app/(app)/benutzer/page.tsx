import { currentUser } from "@clerk/nextjs/server";
import { getUsers } from "@/actions/users";
import { getPermissions } from "@/lib/permissions";
import { UserList } from "@/components/users/user-list";
import { RolePermissionsClient } from "@/components/users/role-permissions-client";

export default async function BenutzerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "berechtigungen" ? "berechtigungen" : "benutzer";

  const [users, me, permissions] = await Promise.all([
    getUsers(),
    currentUser(),
    getPermissions(),
  ]);
  const currentUserRole = (me?.publicMetadata?.role as string) ?? "Backoffice";
  const isAdmin = currentUserRole === "Admin";

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Benutzer</h1>
        <p className="text-sm text-gray-400 mt-0.5">{users.length} Benutzer</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        <a
          href="/benutzer"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
            activeTab === "benutzer"
              ? "bg-white border-gray-300 text-gray-900 shadow-sm"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
          }`}
        >
          Benutzer
        </a>
        {isAdmin && (
          <a
            href="/benutzer?tab=berechtigungen"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              activeTab === "berechtigungen"
                ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            Rollen &amp; Berechtigungen
          </a>
        )}
      </div>

      {activeTab === "benutzer" ? (
        <UserList users={users} currentUserRole={currentUserRole} />
      ) : (
        isAdmin && <RolePermissionsClient initialPermissions={permissions} />
      )}
    </div>
  );
}
