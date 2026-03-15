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
    <Button
      size="sm"
      onClick={handleClick}
      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
    >
      <Plus className="h-4 w-4" />
      Neuer Lieferschein
    </Button>
  );
}
