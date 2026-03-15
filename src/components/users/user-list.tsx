"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setUserRole, updateUser, deleteUser } from "@/actions/users";
import { toast } from "sonner";

const ROLES = ["Admin", "Backoffice", "Fahrer"] as const;

const roleColors: Record<string, string> = {
  Admin: "bg-purple-100 text-purple-700",
  Backoffice: "bg-blue-100 text-blue-700",
  Fahrer: "bg-green-100 text-green-700",
};

const statusColors: Record<string, string> = {
  Aktiv: "bg-green-100 text-green-700",
  Gesperrt: "bg-red-100 text-red-700",
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-amber-200 text-amber-700",
    "bg-blue-200 text-blue-700",
    "bg-purple-200 text-purple-700",
    "bg-green-200 text-green-700",
    "bg-rose-200 text-rose-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  imageUrl: string;
}

function RoleSelector({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [role, setRole] = useState(currentRole);
  const [, startTransition] = useTransition();

  function handleChange(newRole: string) {
    if (!newRole || newRole === role) return;
    setRole(newRole);
    startTransition(async () => {
      await setUserRole(userId, newRole);
      toast.success(`Rolle auf "${newRole}" gesetzt`);
    });
  }

  return (
    <Select value={role} onValueChange={(v) => v != null && handleChange(v)}>
      <SelectTrigger className="h-7 w-36 border-0 shadow-none p-0 gap-1 focus-visible:ring-0">
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${roleColors[role] ?? "bg-gray-100 text-gray-600"}`}>
          {role}
        </span>
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[r]}`}>{r}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditUserDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await updateUser(user.id, { firstName, lastName });
    setLoading(false);
    toast.success("Benutzer aktualisiert");
    onClose();
    router.refresh();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Benutzer bearbeiten</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Vorname</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-10 rounded-lg border-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Nachname</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-10 rounded-lg border-gray-200" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">E-Mail</Label>
          <Input value={user.email} disabled className="h-10 rounded-lg border-gray-200 bg-gray-50 text-gray-400" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-lg">Abbrechen</Button>
          <Button type="submit" disabled={loading} className="rounded-lg">{loading ? "Speichere..." : "Speichern"}</Button>
        </div>
      </form>
    </DialogContent>
  );
}

export function UserList({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered = users.filter(
    (u) =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  function handleDelete(user: User) {
    if (!confirm(`Benutzer "${user.firstName} ${user.lastName}" wirklich löschen?`)) return;
    startTransition(async () => {
      await deleteUser(user.id);
      toast.success("Benutzer gelöscht");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Name oder E-Mail suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Keine Benutzer gefunden</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_1fr_1fr_1fr_80px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Name</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">E-Mail</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Telefon</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Rolle</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Status</span>
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
          </div>

          {filtered.map((user, i) => {
            const initials = getInitials(user.firstName, user.lastName);
            const avatarColor = getAvatarColor(`${user.firstName}${user.lastName}`);
            return (
              <div
                key={user.id}
                className={`grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_1fr_1fr_1fr_80px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors ${
                  i !== filtered.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {user.imageUrl ? (
                    <img src={user.imageUrl} alt={initials} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${avatarColor}`}>
                      {initials}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {user.firstName} {user.lastName}
                  </span>
                </div>
                <span className="text-sm text-gray-500 truncate">{user.email}</span>
                <span className="text-sm text-gray-500">{user.phone || "—"}</span>
                <RoleSelector userId={user.id} currentRole={user.role} />
                <div>
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[user.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {user.status}
                  </span>
                </div>
                {/* Aktionen */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditUser(user)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        {editUser && <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />}
      </Dialog>
    </div>
  );
}
