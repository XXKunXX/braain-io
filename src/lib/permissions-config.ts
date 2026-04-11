// Reine Typen & Konstanten – kein Server-Import, sicher für Client Components

export const ROLES = ["Admin", "Backoffice", "Fahrer"] as const;
export type Role = typeof ROLES[number];

export const PERMISSION_GROUPS = {
  "Kontakte": {
    "contacts.create": "Erstellen",
    "contacts.edit":   "Bearbeiten",
    "contacts.delete": "Löschen",
  },
  "Anfragen & Angebote": {
    "requests.create": "Anfragen erstellen",
    "quotes.create":   "Angebote erstellen",
    "quotes.send":     "Angebote versenden",
  },
  "Aufträge": {
    "orders.create": "Erstellen",
    "orders.edit":   "Bearbeiten",
  },
  "Lieferscheine": {
    "deliveryNotes.create": "Erstellen",
    "deliveryNotes.sign":   "Unterschreiben",
  },
  "Rechnungen": {
    "invoices.create": "Erstellen",
    "invoices.edit":   "Bearbeiten",
    "invoices.delete": "Löschen",
  },
  "Disposition & Baustellen": {
    "disposition.edit":  "Disposition bearbeiten",
    "baustellen.create": "Baustellen erstellen",
    "baustellen.edit":   "Baustellen bearbeiten",
  },
  "Verwaltung": {
    "users.invite":  "Benutzer einladen",
    "users.manage":  "Benutzer verwalten",
    "settings.edit": "Einstellungen bearbeiten",
  },
  "Support-Widget": {
    "support.view":     "Hilfe-Chatbot anzeigen",
    "support.feedback": "Fehler & Features melden",
  },
} as const;

export type PermissionKey = {
  [G in keyof typeof PERMISSION_GROUPS]: keyof typeof PERMISSION_GROUPS[G]
}[keyof typeof PERMISSION_GROUPS];

export type RolePermissions = Record<Role, Record<PermissionKey, boolean>>;

const ALL_PERMISSIONS = Object.values(PERMISSION_GROUPS).flatMap(
  (g) => Object.keys(g)
) as PermissionKey[];

export function allTrue(): Record<PermissionKey, boolean> {
  return Object.fromEntries(ALL_PERMISSIONS.map((k) => [k, true])) as Record<PermissionKey, boolean>;
}

export function allFalse(): Record<PermissionKey, boolean> {
  return Object.fromEntries(ALL_PERMISSIONS.map((k) => [k, false])) as Record<PermissionKey, boolean>;
}

export const DEFAULT_PERMISSIONS: RolePermissions = {
  Admin: allTrue(),

  Backoffice: {
    ...allFalse(),
    "contacts.create":       true,
    "contacts.edit":         true,
    "contacts.delete":       false,
    "requests.create":       true,
    "quotes.create":         true,
    "quotes.send":           true,
    "orders.create":         true,
    "orders.edit":           true,
    "deliveryNotes.create":  true,
    "deliveryNotes.sign":    false,
    "invoices.create":       true,
    "invoices.edit":         true,
    "invoices.delete":       false,
    "disposition.edit":      true,
    "baustellen.create":     true,
    "baustellen.edit":       true,
    "users.invite":          false,
    "users.manage":          false,
    "settings.edit":         false,
    "support.view":          true,
    "support.feedback":      true,
  },

  Fahrer: {
    ...allFalse(),
    "deliveryNotes.create": true,
    "deliveryNotes.sign":   true,
    "support.view":         false,
    "support.feedback":     false,
  },
};

export function mergeWithDefaults(stored: Partial<RolePermissions>): RolePermissions {
  const result = {} as RolePermissions;
  for (const role of ROLES) {
    result[role] = {
      ...DEFAULT_PERMISSIONS[role],
      ...(stored[role] ?? {}),
    };
    if (role === "Admin") result[role] = allTrue();
  }
  return result;
}

export function hasPermission(
  perms: RolePermissions,
  role: string,
  permission: PermissionKey
): boolean {
  if (role === "Admin") return true;
  return perms[role as Role]?.[permission] ?? false;
}
