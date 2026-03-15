import Link from "next/link";
import { Plus } from "lucide-react";

export function CreateOrderButton({ contacts: _ }: { contacts?: unknown[] }) {
  return (
    <Link
      href="/auftraege/neu"
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
    >
      <Plus className="h-4 w-4" />
      Neuer Auftrag
    </Link>
  );
}
