import { anthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

const appDocs = readFileSync(join(process.cwd(), "src/data/app-docs.md"), "utf-8");

const SYSTEM_PROMPT = `Du bist ein hilfreicher Support-Assistent für braain.io, eine cloudbasierte Software für Transportunternehmen und Logistikbetriebe.

Deine Aufgaben:
- Beantworte Fragen der Benutzer rund um die Nutzung von braain.io
- Erkläre Funktionen, Abläufe und wie das Programm zu bedienen ist
- Hilf bei der Navigation und beim Verständnis des Systems
- Schlage bei konkreten Datenfragen (Aufträge, Rechnungen, Lieferscheine) die passenden Tools vor

Wichtige Regeln:
- Antworte IMMER auf Deutsch, unabhängig davon, in welcher Sprache die Frage gestellt wird
- Halte deine Antworten kurz und präzise
- Wenn eine Frage unklar oder zu allgemein ist, frage kurz nach was der Benutzer genau meint – verweigere nicht einfach die Antwort
- Wenn du etwas nicht weißt oder es nicht in der Dokumentation steht, sag es ehrlich – erfinde keine Funktionen
- Bei konkreten Datenfragen (z.B. "Wo ist mein Auftrag?") nutze die verfügbaren Tools um die Daten nachzuschlagen
- Beziehe dich auf braain.io; bei allgemeinen Fragen ohne Programmbezug weise freundlich darauf hin dass du nur für braain.io zuständig bist

Hier ist die aktuelle Programm-Dokumentation:

${appDocs}`;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401 });
  }

  const body = await req.json();
  const messages = body.messages ?? [];
  const currentPath: string | undefined = body.currentPath;
  const conversationId: string | undefined = body.conversationId;

  const systemWithContext = currentPath
    ? `${SYSTEM_PROMPT}\n\nDer Benutzer befindet sich aktuell auf der Seite: ${currentPath}`
    : SYSTEM_PROMPT;

  // Read-only DB tools
  const tools = {
    getOpenOrders: tool({
      description: "Gibt die offenen Aufträge zurück.",
      inputSchema: z.object({}),
      execute: async () => {
        const orders = await prisma.order.findMany({
          where: { status: { in: ["OPEN", "DISPONIERT", "IN_LIEFERUNG"] } },
          include: { contact: { select: { companyName: true } } },
          orderBy: { startDate: "asc" },
          take: 10,
        });
        return orders.map((o) => ({
          nummer: o.orderNumber,
          titel: o.title,
          status: o.status,
          kunde: o.contact.companyName,
          von: o.startDate.toLocaleDateString("de-AT"),
          bis: o.endDate.toLocaleDateString("de-AT"),
        }));
      },
    }),

    getOpenInvoices: tool({
      description: "Gibt die offenen / unbezahlten Rechnungen zurück.",
      inputSchema: z.object({}),
      execute: async () => {
        const invoices = await prisma.invoice.findMany({
          where: { status: "VERSENDET" },
          include: { contact: { select: { companyName: true } } },
          orderBy: { dueDate: "asc" },
          take: 10,
        });
        return invoices.map((i) => ({
          nummer: i.invoiceNumber,
          status: i.status,
          kunde: i.contact.companyName,
          betrag: `€ ${Number(i.totalAmount).toFixed(2)}`,
          datum: i.invoiceDate.toLocaleDateString("de-AT"),
          faellig: i.dueDate ? i.dueDate.toLocaleDateString("de-AT") : "–",
        }));
      },
    }),

    getRecentDeliveries: tool({
      description: "Gibt die letzten Lieferscheine zurück.",
      inputSchema: z.object({}),
      execute: async () => {
        const notes = await prisma.deliveryNote.findMany({
          include: { contact: { select: { companyName: true } } },
          orderBy: { date: "desc" },
          take: 10,
        });
        return notes.map((n) => ({
          nummer: n.deliveryNumber,
          kunde: n.contact.companyName,
          material: n.material,
          fahrer: n.driver ?? "–",
          datum: n.date.toLocaleDateString("de-AT"),
        }));
      },
    }),

    getOpenRequests: tool({
      description: "Gibt die offenen Anfragen zurück.",
      inputSchema: z.object({}),
      execute: async () => {
        const requests = await prisma.request.findMany({
          where: { status: { not: "DONE" } },
          include: { contact: { select: { companyName: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        return requests.map((r) => ({
          titel: r.title,
          status: r.status,
          kunde: r.contact.companyName,
          erstellt: r.createdAt.toLocaleDateString("de-AT"),
        }));
      },
    }),
  };

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemWithContext,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 1024,
    tools,
    stopWhen: stepCountIs(3),
    onFinish: async ({ text }) => {
      // Gesprächsverlauf speichern
      try {
        const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
        const userEmail = user.emailAddresses[0]?.emailAddress;

        const userMessages = messages.filter((m: { role: string }) => m.role === "user");
        if (userMessages.length === 0) return;

        const storedMessages = [
          ...messages.map((m: { role: string; parts?: Array<{ type: string; text?: string }> }) => ({
            role: m.role,
            text: m.parts?.find((p) => p.type === "text")?.text ?? "",
            ts: new Date().toISOString(),
          })),
          { role: "assistant", text, ts: new Date().toISOString() },
        ];

        if (conversationId) {
          await prisma.supportConversation.update({
            where: { id: conversationId },
            data: { messages: storedMessages, updatedAt: new Date() },
          });
        } else {
          await prisma.supportConversation.create({
            data: {
              clerkUserId: user.id,
              userName,
              userEmail,
              messages: storedMessages,
            },
          });
        }
      } catch {
        // Speichern darf Chat nicht blockieren
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
