import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await prisma.request.findUnique({
    where: { id },
    include: { contact: true },
  });

  if (!request || !request.inspectionDate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const start = new Date(request.inspectionDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 Stunde

  const summary = `Besichtigung – ${request.contact.companyName}`;
  const location = request.siteAddress ?? "";
  const contactPersonName = [request.contact.firstName, request.contact.lastName].filter(Boolean).join(" ");
  const description = `Anfrage: ${request.title}${contactPersonName ? `\\nAnsprechpartner: ${contactPersonName}` : ""}${request.assignedTo ? `\\nZugewiesen an: ${request.assignedTo}` : ""}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SaaS ER//Besichtigung//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:inspection-${request.id}@saas-er`,
    `DTSTART:${formatICalDate(start)}`,
    `DTEND:${formatICalDate(end)}`,
    `SUMMARY:${escapeICalText(summary)}`,
    ...(location ? [`LOCATION:${escapeICalText(location)}`] : []),
    `DESCRIPTION:${escapeICalText(description)}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="besichtigung-${request.id}.ics"`,
    },
  });
}
