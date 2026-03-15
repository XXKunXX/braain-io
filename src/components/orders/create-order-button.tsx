"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateOrderButton({ contacts: _ }: { contacts?: unknown[] }) {
  const router = useRouter();
  return (
    <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push("/auftraege/neu")}>
      <Plus className="h-4 w-4" />
      Neuer Auftrag
    </Button>
  );
}
