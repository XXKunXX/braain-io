"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  PERMISSION_GROUPS,
  type PermissionKey,
  type Role,
  type RolePermissions,
} from "@/lib/permissions-config";
import { saveRolePermissions } from "@/actions/permissions";

const CONFIGURABLE_ROLES: Exclude<Role, "Admin">[] = ["Backoffice", "Fahrer"];

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-8 h-[18px] rounded-full transition-colors duration-200 relative flex-shrink-0 ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-px left-px w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
          checked ? "translate-x-[14px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function RolePermissionsClient({
  initialPermissions,
}: {
  initialPermissions: RolePermissions;
}) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  function toggle(role: Exclude<Role, "Admin">, key: PermissionKey) {
    setPermissions((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] },
    }));
  }

  function handleSave() {
    setSaving(true);
    startTransition(async () => {
      const result = await saveRolePermissions(permissions);
      setSaving(false);
      if (result.error) toast.error(result.error);
      else toast.success("Berechtigungen gespeichert");
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <p className="text-sm text-gray-500">
        Admin hat immer alle Berechtigungen und ist nicht konfigurierbar.
      </p>

      <div className="space-y-4">
        {Object.entries(PERMISSION_GROUPS).map(([group, actions]) => (
          <div key={group} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Gruppen-Header mit Rollen-Labels */}
            <div className="grid grid-cols-[1fr_80px_80px] px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {group}
              </span>
              {CONFIGURABLE_ROLES.map((role) => (
                <span
                  key={role}
                  className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center"
                >
                  {role}
                </span>
              ))}
            </div>

            {/* Zeilen */}
            {Object.entries(actions).map(([key, label], idx, arr) => {
              const permKey = key as PermissionKey;
              return (
                <div
                  key={key}
                  className={`grid grid-cols-[1fr_80px_80px] px-4 py-3 items-center ${
                    idx < arr.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <span className="text-sm text-gray-700">{label}</span>
                  {CONFIGURABLE_ROLES.map((role) => (
                    <div key={role} className="flex justify-center">
                      <Toggle
                        checked={permissions[role][permKey]}
                        onChange={() => toggle(role, permKey)}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <LoadingButton loading={saving} onClick={handleSave} className="rounded-lg">
          Speichern
        </LoadingButton>
      </div>
    </div>
  );
}
