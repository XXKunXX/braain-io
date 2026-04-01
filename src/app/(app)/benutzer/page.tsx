import { currentUser } from "@clerk/nextjs/server";
import { getUsers } from "@/actions/users";
import { UserList } from "@/components/users/user-list";

export default async function BenutzerPage() {
  const [users, me] = await Promise.all([getUsers(), currentUser()]);
  const currentUserRole = (me?.publicMetadata?.role as string) ?? "Mitarbeiter";

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Benutzer</h1>
        <p className="text-sm text-gray-400 mt-0.5">{users.length} Benutzer</p>
      </div>

      <UserList users={users} currentUserRole={currentUserRole} />
    </div>
  );
}
