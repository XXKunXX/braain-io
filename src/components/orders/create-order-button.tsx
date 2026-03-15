"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateOrderButton({ contacts: _ }: { contacts?: unknown[] }) {
  const router = useRouter();
  return (
    <Button size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-black" onClick={() => router.push("/auftraege/neu")}>
      <Plus className="h-4 w-4 mr-1" />
      Neuer Auftrag
    </Button>
  );
}
