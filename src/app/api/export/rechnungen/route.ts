import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const exportFormat = searchParams.get("format") ?? "bmd";

  if (!from || !to) {
    return NextResponse.json({ error: "from und to sind erforderlich" }, { status: 400 });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceDate: {
        gte: new Date(from),
        lte: new Date(to + "T23:59:59"),
      },
      status: { in: ["VERSENDET", "BEZAHLT"] },
    },
    include: {
      contact: { select: { id: true, companyName: true, firstName: true, lastName: true } },
      items: { orderBy: { position: "asc" } },
    },
    orderBy: { invoiceDate: "asc" },
  });

  let csv: string;
  let filename: string;

  if (exportFormat === "datev") {
    // DATEV Buchungsstapel Format
    const header = [
      '"Umsatz (ohne Soll/Haben-Kz)"',
      '"Soll/Haben-Kennzeichen"',
      '"WKZ Umsatz"',
      '"Kurs"',
      '"Basis-Umsatz"',
      '"WKZ Basis-Umsatz"',
      '"Konto"',
      '"Gegenkonto (ohne BU-Schlüssel)"',
      '"BU-Schlüssel"',
      '"Belegdatum"',
      '"Belegfeld 1"',
      '"Belegfeld 2"',
      '"Skonto"',
      '"Buchungstext"',
    ].join(";");

    const rows = invoices.map((inv) => [
      inv.totalAmount.toFixed(2).replace(".", ","),
      "S",
      "EUR",
      "",
      "",
      "",
      "8400", // Erlöskonto (Standard)
      "10000", // Debitorenkonto (Standard)
      "",
      format(new Date(inv.invoiceDate), "ddMM"),
      inv.invoiceNumber,
      "",
      "",
      `"${(inv.contact.companyName || [inv.contact.firstName, inv.contact.lastName].filter(Boolean).join(" ")).replace(/"/g, '""')}"`,
    ].join(";"));

    csv = [header, ...rows].join("\r\n");
    filename = `datev_export_${from}_${to}.csv`;
  } else {
    // BMD NTCS Format
    const header = [
      "Belegdatum",
      "Belegnummer",
      "Kundennummer",
      "Kundenname",
      "Nettobetrag",
      "MwSt-Satz %",
      "MwSt-Betrag",
      "Bruttobetrag",
      "Zahlungsziel",
      "Buchungstext",
    ].join(";");

    const rows = invoices.map((inv) => [
      format(new Date(inv.invoiceDate), "dd.MM.yyyy"),
      inv.invoiceNumber,
      inv.contact.id.slice(-8).toUpperCase(),
      `"${(inv.contact.companyName || [inv.contact.firstName, inv.contact.lastName].filter(Boolean).join(" ")).replace(/"/g, '""')}"`,
      Number(inv.subtotal).toFixed(2).replace(".", ","),
      (Number(inv.vatRate) * 100).toFixed(0),
      Number(inv.vatAmount).toFixed(2).replace(".", ","),
      Number(inv.totalAmount).toFixed(2).replace(".", ","),
      inv.dueDate ? format(new Date(inv.dueDate), "dd.MM.yyyy") : "",
      `"${inv.invoiceNumber} ${(inv.contact.companyName || [inv.contact.firstName, inv.contact.lastName].filter(Boolean).join(" ")).replace(/"/g, '""')}"`,
    ].join(";"));

    csv = [header, ...rows].join("\r\n");
    filename = `bmd_export_${from}_${to}.csv`;
  }

  // BOM für korrekte Zeichenkodierung in Excel/BMD
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
