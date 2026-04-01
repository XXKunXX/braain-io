import Link from "next/link";
import { Plus } from "lucide-react";

export function CreateContactButton() {
  return (
    <Link href="/kontakte/neu" className="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm gap-1.5">
      <Plus className="h-4 w-4" />
      Neuer Kontakt
    </Link>
  );
}
