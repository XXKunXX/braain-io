import { prisma } from "@/lib/prisma";
import { DocumentList, type UnifiedDocument } from "@/components/documents/document-list";

async function getDocuments(): Promise<UnifiedDocument[]> {
  const [quotes, deliveryNotes, attachments] = await Promise.all([
    prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        quoteNumber: true,
        title: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        contact: { select: { id: true, companyName: true } },
        request: { select: { id: true, title: true } },
      },
    }),
    prisma.deliveryNote.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        deliveryNumber: true,
        material: true,
        quantity: true,
        unit: true,
        date: true,
        createdAt: true,
        contact: { select: { id: true, companyName: true } },
      },
    }),
    prisma.attachment.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        url: true,
        createdAt: true,
        contact: { select: { id: true, companyName: true } },
        request: { select: { id: true, title: true } },
      },
    }),
  ]);

  const docs: UnifiedDocument[] = [
    ...quotes.map((q) => ({
      id: q.id,
      type: "ANGEBOT" as const,
      title: q.title,
      number: q.quoteNumber,
      status: q.status,
      contactId: q.contact.id,
      contactName: q.contact.companyName,
      linkedTo: q.request ? { label: q.request.title, href: `/anfragen/${q.request.id}` } : undefined,
      url: `/api/pdf/quote/${q.id}`,
      meta: `${Number(q.totalPrice).toLocaleString("de-AT", { style: "currency", currency: "EUR" })}`,
      createdAt: q.createdAt,
    })),
    ...deliveryNotes.map((d) => ({
      id: d.id,
      type: "LIEFERSCHEIN" as const,
      title: d.material,
      number: d.deliveryNumber,
      status: null,
      contactId: d.contact.id,
      contactName: d.contact.companyName,
      linkedTo: undefined,
      url: `/api/pdf/delivery/${d.id}`,
      meta: `${Number(d.quantity)} ${d.unit}`,
      createdAt: d.createdAt,
    })),
    ...attachments.map((a) => ({
      id: a.id,
      type: "ANHANG" as const,
      title: a.fileName,
      number: undefined,
      status: null,
      contactId: a.contact?.id,
      contactName: a.contact?.companyName,
      linkedTo: a.request ? { label: a.request.title, href: `/anfragen/${a.request.id}` } : undefined,
      url: a.url,
      meta: a.fileSize ? formatFileSize(a.fileSize) : undefined,
      mimeType: a.mimeType,
      createdAt: a.createdAt,
    })),
  ];

  // Sort by createdAt desc
  docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return docs;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DokumentePage() {
  const documents = await getDocuments();

  // Build unique contact list for filter
  const contactMap = new Map<string, string>();
  documents.forEach((d) => { if (d.contactId && d.contactName) contactMap.set(d.contactId, d.contactName); });
  const contacts = [...contactMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dokumente</h1>
          <p className="text-sm text-gray-400 mt-0.5">{documents.length} Dokumente</p>
        </div>
      </div>
      <DocumentList documents={documents} contacts={contacts} />
    </div>
  );
}
