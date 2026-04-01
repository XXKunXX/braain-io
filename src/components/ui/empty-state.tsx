import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  headline: string;
  subline?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
}

/**
 * Unified empty state for all list views.
 * Shows icon, headline, optional subline and an optional CTA button.
 */
export function EmptyState({
  icon: Icon,
  headline,
  subline,
  ctaLabel,
  ctaHref,
  onCtaClick,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-gray-400" />
        </div>
      )}
      <p className="text-sm font-medium text-gray-700 mb-1">{headline}</p>
      {subline && <p className="text-xs text-gray-400 mb-5 max-w-xs">{subline}</p>}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 h-7 text-[0.8rem] font-medium text-foreground hover:bg-muted transition-colors"
          )}
        >
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCtaClick && (
        <Button size="sm" variant="outline" onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
