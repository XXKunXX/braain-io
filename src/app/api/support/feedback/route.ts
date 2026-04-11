import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY!;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID!;

type FeedbackType = "bug" | "feature";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  if (!CLICKUP_API_KEY || !CLICKUP_LIST_ID) {
    console.error("[Support Feedback] ClickUp-Keys fehlen");
    return NextResponse.json({ error: "Konfigurationsfehler" }, { status: 500 });
  }

  const formData = await req.formData();
  const type = formData.get("type") as FeedbackType;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const screenshot = formData.get("screenshot") as File | null;

  if (!type || !title || !description) {
    return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  }

  const isBug = type === "bug";
  const taskTitle = isBug
    ? `[Fehler] ${title}`
    : `[Feature] ${title}`;

  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.emailAddresses[0]?.emailAddress || user.id;

  const taskDescription = [
    `**Typ:** ${isBug ? "Fehler" : "Feature-Wunsch"}`,
    `**Gemeldet von:** ${userName}`,
    `**E-Mail:** ${user.emailAddresses[0]?.emailAddress ?? "–"}`,
    "",
    `**Beschreibung:**`,
    description,
    "",
    `**Zeitpunkt:** ${new Date().toLocaleString("de-AT")}`,
  ].join("\n");

  // 1. ClickUp-Task erstellen
  const createRes = await fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`, {
    method: "POST",
    headers: {
      Authorization: CLICKUP_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: taskTitle,
      description: taskDescription,
      priority: isBug ? 2 : 3, // 2 = Hoch, 3 = Normal
      tags: [isBug ? "feedback-bug" : "feedback-feature", "beta-test"],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("[Support Feedback] ClickUp Task-Erstellung fehlgeschlagen:", err);
    return NextResponse.json({ error: "ClickUp-Fehler" }, { status: 502 });
  }

  const task = await createRes.json();
  const taskId: string = task.id;
  const taskUrl: string = task.url;

  // 2. Screenshot hochladen (wenn vorhanden)
  if (screenshot && screenshot.size > 0) {
    const attachmentForm = new FormData();
    attachmentForm.append("attachment", screenshot, screenshot.name || "screenshot.png");

    const attachRes = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
      method: "POST",
      headers: { Authorization: CLICKUP_API_KEY },
      body: attachmentForm,
    });

    if (!attachRes.ok) {
      // Screenshot-Upload ist nicht kritisch – Task wurde bereits erstellt
      console.error("[Support Feedback] Screenshot-Upload fehlgeschlagen:", await attachRes.text());
    }
  }

  return NextResponse.json({ ok: true, taskUrl });
}
