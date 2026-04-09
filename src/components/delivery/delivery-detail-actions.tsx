"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, PenLine, Receipt } from "lucide-react";

export function DeliveryDetailActions({
  id,
  contactId,
  invoiceId,
  isSigned,
}: {
  id: string;
  contactId: string;
  invoiceId?: string;
  isSigned?: boolean;
}) {
  const router = useRouter();

  return (
    <>
      <Link href={`/lieferscheine/${id}/ausfuellen`}>
        <Button size="sm" className="gap-1.5">
          <PenLine className="h-3.5 w-3.5" />
          Ausfüllen
        </Button>
      </Link>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => window.open(`/api/pdf/delivery/${id}`, "_blank")}
      >
        <FileText className="h-3.5 w-3.5" />
        PDF
      </Button>
      {!invoiceId && (
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!isSigned}
          title={!isSigned ? "Lieferschein muss zuerst unterschrieben werden" : undefined}
          onClick={() => router.push(`/rechnungen/neu?contactId=${contactId}`)}
        >
          <Receipt className="h-3.5 w-3.5" />
          Rechnung erstellen
        </Button>
      )}
    </>
  );
}
