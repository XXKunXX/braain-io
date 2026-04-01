/**
 * Unified status badge with consistent color semantics across the entire app.
 *
 * Color rules:
 *   green  = aktiv / bezahlt / erledigt / angenommen
 *   blue   = geplant / entwurf / neu
 *   amber  = ausstehend / in bearbeitung / besichtigung
 *   orange = abrechnung / zwischenrechnung
 *   gray   = abgeschlossen / inaktiv
 *   red    = überfällig / abgelehnt / krank
 */

type StatusVariant =
  // Orders
  | "PLANNED" | "ACTIVE" | "PENDING" | "INVOICED" | "COMPLETED"
  // Quotes
  | "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"
  // Requests
  | "NEU" | "OPEN" | "BESICHTIGUNG_GEPLANT" | "BESICHTIGUNG_DURCHGEFUEHRT"
  | "ANGEBOT_ERSTELLT" | "IN_PROGRESS" | "DONE"
  // Payments
  | "OFFEN" | "BEZAHLT" | "OVERDUE"
  // Tasks
  | "OPEN_TASK" | "IN_PROGRESS_TASK" | "DONE_TASK"
  // Resources
  | "ACTIVE_RES" | "INACTIVE_RES";

const STATUS_CONFIG: Record<StatusVariant, { label: string; className: string }> = {
  // Orders
  PLANNED:    { label: "Geplant",           className: "bg-blue-50 text-blue-700 border border-blue-200" },
  ACTIVE:     { label: "Aktiv",             className: "bg-green-50 text-green-700 border border-green-200" },
  PENDING:    { label: "Ausstehend",        className: "bg-amber-50 text-amber-700 border border-amber-200" },
  INVOICED:   { label: "In Abrechnung",     className: "bg-orange-50 text-orange-700 border border-orange-200" },
  COMPLETED:  { label: "Abgeschlossen",     className: "bg-gray-100 text-gray-500 border border-gray-200" },
  // Quotes
  DRAFT:      { label: "Entwurf",           className: "bg-gray-100 text-gray-600 border border-gray-200" },
  SENT:       { label: "Versendet",         className: "bg-blue-50 text-blue-700 border border-blue-200" },
  ACCEPTED:   { label: "Angenommen",        className: "bg-green-50 text-green-700 border border-green-200" },
  REJECTED:   { label: "Abgelehnt",         className: "bg-red-50 text-red-600 border border-red-200" },
  // Requests
  NEU:                        { label: "Neu",                     className: "bg-blue-50 text-blue-700 border border-blue-200" },
  OPEN:                       { label: "Offen",                   className: "bg-blue-50 text-blue-700 border border-blue-200" },
  BESICHTIGUNG_GEPLANT:       { label: "Besichtigung geplant",    className: "bg-amber-50 text-amber-700 border border-amber-200" },
  BESICHTIGUNG_DURCHGEFUEHRT: { label: "Besichtigung durchgeführt", className: "bg-teal-50 text-teal-700 border border-teal-200" },
  ANGEBOT_ERSTELLT:           { label: "Angebot erstellt",        className: "bg-purple-50 text-purple-700 border border-purple-200" },
  IN_PROGRESS:                { label: "In Bearbeitung",          className: "bg-amber-50 text-amber-700 border border-amber-200" },
  DONE:                       { label: "Erledigt",                className: "bg-green-50 text-green-700 border border-green-200" },
  // Payments
  OFFEN:   { label: "Offen",     className: "bg-amber-50 text-amber-700 border border-amber-200" },
  BEZAHLT: { label: "Bezahlt",   className: "bg-green-50 text-green-700 border border-green-200" },
  OVERDUE: { label: "Überfällig",className: "bg-red-50 text-red-600 border border-red-200" },
  // Tasks
  OPEN_TASK:        { label: "Offen",          className: "bg-gray-100 text-gray-600 border border-gray-200" },
  IN_PROGRESS_TASK: { label: "In Bearbeitung", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  DONE_TASK:        { label: "Erledigt",       className: "bg-green-50 text-green-700 border border-green-200" },
  // Resources
  ACTIVE_RES:   { label: "Aktiv",   className: "bg-green-50 text-green-700 border border-green-200" },
  INACTIVE_RES: { label: "Inaktiv", className: "bg-gray-100 text-gray-400 border border-gray-200" },
  // User status
  Aktiv:    { label: "Aktiv",    className: "bg-green-50 text-green-700 border border-green-200" },
  Gesperrt: { label: "Gesperrt", className: "bg-red-50 text-red-600 border border-red-200" },
  // User roles
  Admin:      { label: "Admin",      className: "bg-purple-50 text-purple-700 border border-purple-200" },
  Backoffice: { label: "Backoffice", className: "bg-blue-50 text-blue-700 border border-blue-200" },
  Fahrer:     { label: "Fahrer",     className: "bg-green-50 text-green-700 border border-green-200" },
};

interface StatusBadgeProps {
  status: string;
  /** Override display label */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as StatusVariant];
  const displayLabel = label ?? config?.label ?? status;
  const colorClass = config?.className ?? "bg-gray-100 text-gray-600 border border-gray-200";

  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${colorClass} ${className ?? ""}`}>
      {displayLabel}
    </span>
  );
}
