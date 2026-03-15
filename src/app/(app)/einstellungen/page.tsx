import { UserProfile } from "@clerk/nextjs";

export default function EinstellungenPage() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Einstellungen</h1>
        <p className="text-sm text-gray-400 mt-0.5">Profil & Konto verwalten</p>
      </div>
      <UserProfile
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "shadow-none border border-gray-200 rounded-xl w-full",
            navbar: "border-r border-gray-100",
            pageScrollBox: "p-6",
          },
        }}
      />
    </div>
  );
}
