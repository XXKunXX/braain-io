import { UserProfile } from "@clerk/nextjs";
import { getUserPreferences } from "@/actions/user-preferences";
import { FahrerAppToggle } from "@/components/settings/fahrer-app-toggle";
import { currentUser } from "@clerk/nextjs/server";

export default async function EinstellungenPage() {
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string) ?? "Mitarbeiter";
  const isAdmin = role === "Admin";

  const prefs = isAdmin ? await getUserPreferences() : null;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Einstellungen</h1>
        <p className="text-sm text-gray-400 mt-0.5">Profil & Konto verwalten</p>
      </div>

      {isAdmin && prefs && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Ansicht</p>
          <FahrerAppToggle initialValue={prefs.showFahrerApp} />
        </div>
      )}

      <UserProfile
        appearance={{
          elements: {
            rootBox: "!w-full !max-w-none",
            card: "shadow-none border border-gray-200 rounded-xl !w-full !max-w-none",
            navbar: "border-r border-gray-100",
            pageScrollBox: "p-6",
          },
        }}
      />
    </div>
  );
}
