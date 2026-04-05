import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getContactName(contact: { companyName?: string | null; firstName?: string | null; lastName?: string | null } | null | undefined, fallback = "–"): string {
  if (!contact) return fallback;
  return contact.companyName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || fallback;
}
