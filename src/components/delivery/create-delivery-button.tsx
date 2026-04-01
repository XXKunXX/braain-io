"use client";

import { useState } from "react";
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
  allItemsCovered?: boolean;
}

export function CreateDeliveryButton({ defaultOrderId, allItemsCovered }: CreateDeliveryButtonProps) {
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);

  function handleClick() {
    if (allItemsCovered) return;
    const url = defaultOrderId
      ? `/lieferscheine/neu?orderId=${defaultOrderId}`
      : "/lieferscheine/neu";
    router.push(url);
  }

  return (
    <div className="relative inline-flex">
      <Button
        onClick={handleClick}
        onMouseEnter={() => allItemsCovered && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={allItemsCovered}
        className="rounded-lg gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Neuer Lieferschein
      </Button>
      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-64 rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-lg text-center leading-snug">
          Alle Leistungen des Auftrags wurden mittels Lieferschein erfasst
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
