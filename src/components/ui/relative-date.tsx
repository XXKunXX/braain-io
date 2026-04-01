"use client";

import { formatDistanceToNow, isToday, isTomorrow, isYesterday, format } from "date-fns";
import { de } from "date-fns/locale";

interface RelativeDateProps {
  date: Date | string | null | undefined;
  /** When true, shows "Überfällig" label for past dates on non-done items */
  overdue?: boolean;
  className?: string;
}

/**
 * Displays a human-readable relative date (heute, morgen, in 3 Tagen, Überfällig seit 2 Tagen).
 * Shows the absolute date as a tooltip on hover.
 */
export function RelativeDate({ date, overdue = false, className }: RelativeDateProps) {
  if (!date) return <span className="text-gray-300">—</span>;

  const d = typeof date === "string" ? new Date(date) : date;
  const absolute = format(d, "dd.MM.yyyy", { locale: de });
  const now = new Date();
  const isPast = d < now;

  let label: string;
  let colorClass: string;

  if (overdue && isPast) {
    label = `Überfällig seit ${formatDistanceToNow(d, { locale: de })}`;
    colorClass = "text-red-600 font-semibold";
  } else if (isToday(d)) {
    label = "Heute";
    colorClass = "text-amber-600 font-semibold";
  } else if (isTomorrow(d)) {
    label = "Morgen";
    colorClass = "text-blue-600 font-medium";
  } else if (isYesterday(d)) {
    label = "Gestern";
    colorClass = overdue ? "text-red-600 font-medium" : "text-gray-500";
  } else if (isPast) {
    label = `vor ${formatDistanceToNow(d, { locale: de })}`;
    colorClass = overdue ? "text-red-600 font-medium" : "text-gray-400";
  } else {
    label = `in ${formatDistanceToNow(d, { locale: de })}`;
    colorClass = "text-gray-500";
  }

  return (
    <span
      title={absolute}
      className={`${colorClass} ${className ?? ""}`}
    >
      {label}
    </span>
  );
}
