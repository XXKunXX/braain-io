"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, Users, ShieldCheck, Briefcase, Truck, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingButton } from "@/components/ui/loading-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setUserRole, updateUser, updateUserAdmin, deleteUser } from "@/actions/users";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { sortItems } from "@/lib/sort";
import { SortHeader } from "@/components/ui/sort-header";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";

const ROLES = ["Admin", "Backoffice", "Fahrer"] as const;

const ROLE_TABS = [
  { key: "Alle", label: "Alle", icon: Users },
  { key: "Admin", label: "Admin", icon: ShieldCheck },
  { key: "Backoffice", label: "Backoffice", icon: Briefcase },
  { key: "Fahrer", label: "Fahrer", icon: Truck },
] as const;

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
        <StatusBadge status={role} />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            <StatusBadge status={r} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditUserDialog({ user, isAdmin, onClose }: { user: User; isAdmin: boolean; onClose: () => void }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    if (isAdmin) {
      await updateUserAdmin(user.id, { firstName, lastName, email, role });
    } else {
      await updateUser(user.id, { firstName, lastName });
    }
    setLoading(false);
    toast.success("Benutzer aktualisiert");
    onClose();
    router.refresh();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Benutzer {isAdmin ? "bearbeiten" : "ansehen"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Vorname</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={!isAdmin} className="h-10 rounded-lg border-gray-200 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Nachname</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={!isAdmin} className="h-10 rounded-lg border-gray-200 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">E-Mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!isAdmin} className="h-10 rounded-lg border-gray-200 disabled:bg-gray-50 disabled:text-gray-400" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Rolle</Label>
          {isAdmin ? (
            <Select value={role} onValueChange={(v) => v && setRole(v)}>
              <SelectTrigger className="h-10 rounded-lg border-gray-200 w-full">
                <StatusBadge status={role} />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}><StatusBadge status={r} /></SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 flex items-center">
              <StatusBadge status={role} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-lg">
            {isAdmin ? "Abbrechen" : "Schließen"}
          </Button>
          {isAdmin && (
            <LoadingButton type="submit" loading={loading} className="rounded-lg">Speichern</LoadingButton>
          )}
        </div>
      </form>
    </DialogContent>
  );
}

export function UserList({ users, currentUserRole }: { users: User[]; currentUserRole: string }) {
  const isAdmin = currentUserRole === "Admin";
  const [activeTab, setActiveTab] = useState<string>("Alle");
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const router = useRouter();

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { Alle: users.length };
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const filtered = useMemo(() => {
    const base = users.filter((u) => {
      const matchesTab = activeTab === "Alle" || u.role === activeTab;
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
    return sortItems(base, sortKey, sortDir, (item, key) => {
      if (key === "name") return `${item.firstName} ${item.lastName}`;
      if (key === "email") return item.email;
      if (key === "role") return item.role;
      if (key === "status") return item.status === "Aktiv" ? "a" : "z";
      return (item as unknown as Record<string, unknown>)[key];
    });
  }, [users, activeTab, search, sortKey, sortDir]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteUser(deleteTarget.id);
    toast.success("Benutzer gelöscht");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Role Tabs */}
      <div className="overflow-hidden">
        <div className="flex items-center gap-1">
          {ROLE_TABS.filter(({ key }) => key === "Alle" || (tabCounts[key] ?? 0) > 0).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              title={label}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                activeTab === key
                  ? "bg-white border-gray-300 text-gray-900 shadow-sm"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {(tabCounts[key] ?? 0) > 0 && (
                <span className="text-xs text-gray-400">({tabCounts[key]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search + CTA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Name oder E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <InviteUserDialog />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          headline="Keine Benutzer gefunden"
          subline="Passe die Suche an oder lade einen neuen Benutzer ein."
        />
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filtered.map((user) => {
              const initials = getInitials(user.firstName, user.lastName);
              const avatarColor = getAvatarColor(`${user.firstName}${user.lastName}`);
              return (
                <div
                  key={user.id}
                  onClick={() => setEditUser(user)}
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {user.imageUrl ? (
                        <img src={user.imageUrl} alt={initials} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor}`}>
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {user.email && <span className="text-xs text-gray-400 truncate">{user.email}</span>}
                        {user.phone && <span className="text-xs text-gray-400">{user.phone}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <StatusBadge status={user.role} />
                        <StatusBadge status={user.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(user); }}
                        className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_1fr_1fr_1fr_80px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/80">
              <SortHeader label="Name" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="E-Mail" sortKey="email" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Telefon</span>
              <SortHeader label="Rolle" sortKey="role" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-semibold tracking-wider uppercase" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Aktionen</span>
            </div>

            {filtered.map((user, i) => {
              const initials = getInitials(user.firstName, user.lastName);
              const avatarColor = getAvatarColor(`${user.firstName}${user.lastName}`);
              return (
                <div
                  key={user.id}
                  onClick={() => setEditUser(user)}
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_1fr_1fr_1fr_80px] gap-4 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors cursor-pointer ${
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
                  <div onClick={(e) => e.stopPropagation()}>
                    {isAdmin
                      ? <RoleSelector userId={user.id} currentRole={user.role} />
                      : <StatusBadge status={user.role} />}
                  </div>
                  <div>
                    <StatusBadge status={user.status} />
                  </div>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                      title="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-gray-200 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Benutzer löschen"
        description={deleteTarget ? `"${deleteTarget.firstName} ${deleteTarget.lastName}" wird unwiderruflich gelöscht.` : undefined}
        onConfirm={confirmDelete}
      />
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        {editUser && <EditUserDialog user={editUser} isAdmin={isAdmin} onClose={() => setEditUser(null)} />}
      </Dialog>
    </div>
  );
}
