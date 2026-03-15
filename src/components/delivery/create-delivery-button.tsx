"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateDeliveryButtonProps {
  // kept for backwards-compatibility, no longer used
  contacts?: unknown[];
  defaultContactId?: string;
  defaultOrderId?: string;
  quoteItems?: unknown[];
  orderTitle?: string;
}

export function CreateDeliveryButton({ defaultOrderId }: CreateDeliveryButtonProps) {
  const router = useRouter();

  function handleClick() {
    const url = defaultOrderId
      ? `/lieferscheine/neu?orderId=${defaultOrderId}`
      : "/lieferscheine/neu";
    router.push(url);
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
    >
      <Plus className="h-4 w-4" />
      Neuer Lieferschein
    </button>
  );
}
