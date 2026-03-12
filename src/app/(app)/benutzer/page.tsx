import { getUsers } from "@/actions/users";
import { UserList } from "@/components/users/user-list";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";

export default async function BenutzerPage() {
  const users = await getUsers();

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Benutzer</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} Benutzer</p>
        </div>
        <InviteUserDialog />
      </div>

      <UserList users={users} />
    </div>
  );
}
