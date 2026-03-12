import Link from "next/link";
import { Plus } from "lucide-react";

export function CreateRequestButton() {
  return (
    <Link
      href="/anfragen/neu"
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
    >
      <Plus className="h-4 w-4" />
      Neue Anfrage
    </Link>
  );
}
