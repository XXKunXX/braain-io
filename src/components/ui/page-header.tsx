import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  /** Breadcrumb trail, e.g. [{ label: "Aufträge", href: "/auftraege" }, { label: "Auftrag #042" }] */
  breadcrumbs?: Breadcrumb[];
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Back link shorthand — shows a single ← back button */
  backHref?: string;
  backLabel?: string;
}

/**
 * Consistent page header with optional breadcrumb trail and action buttons.
 * Use across all detail pages for uniform navigation context.
 */
export function PageHeader({
  breadcrumbs,
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 bg-white">
      <div className="min-w-0">
        {/* Back link shorthand */}
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {backLabel ?? "Zurück"}
          </Link>
        )}

        {/* Breadcrumb trail */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 mb-2">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300 text-xs">/</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-xs text-gray-400">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        <h1 className="text-xl font-semibold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">{actions}</div>
      )}
    </div>
  );
}
