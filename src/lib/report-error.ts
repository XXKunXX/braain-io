/**
 * Beta-Test Error Reporter → ClickUp
 *
 * Erstellt automatisch einen ClickUp-Task mit Prefix "Beta-Test:"
 * wenn ein Fehler in der Applikation auftritt.
 *
 * Benötigte Env-Variablen:
 *   CLICKUP_API_KEY   – ClickUp Personal API Token
 *   CLICKUP_LIST_ID   – ID der Zielliste (z.B. SAAS-Liste)
 */

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID;

type ErrorContext = {
  /** Wo ist der Fehler aufgetreten? z.B. "createInvoice", "GET /api/upload" */
  location?: string;
  /** Clerk User ID des betroffenen Users */
  userId?: string;
  /** Zusätzliche strukturierte Infos */
  extra?: Record<string, unknown>;
};

export async function reportBetaError(
  error: unknown,
  context: ErrorContext = {}
): Promise<void> {
  if (!CLICKUP_API_KEY || !CLICKUP_LIST_ID) {
    // Im Dev-Betrieb ohne ClickUp-Keys nur loggen
    console.error("[Beta-Error]", context.location ?? "unknown", error);
    return;
  }

  const message =
    error instanceof Error ? error.message : String(error);
  const stack =
    error instanceof Error ? (error.stack ?? "") : "";

  const title = `Beta-Test: ${context.location ? `[${context.location}] ` : ""}${message.slice(0, 100)}`;

  const descriptionLines: string[] = [
    `**Fehler:** ${message}`,
    "",
    context.location ? `**Ort:** ${context.location}` : "",
    context.userId   ? `**User:** ${context.userId}`  : "",
    context.extra    ? `**Details:**\n\`\`\`\n${JSON.stringify(context.extra, null, 2)}\n\`\`\`` : "",
    stack            ? `**Stack Trace:**\n\`\`\`\n${stack.slice(0, 2000)}\n\`\`\`` : "",
    "",
    `**Zeitpunkt:** ${new Date().toISOString()}`,
  ].filter(Boolean);

  try {
    await fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task`, {
      method:  "POST",
      headers: {
        "Authorization": CLICKUP_API_KEY,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        name:        title,
        description: descriptionLines.join("\n"),
        priority:    2, // Hoch
        tags:        ["beta-test"],
      }),
    });
  } catch (reportingError) {
    // Fehler beim Reporten darf die App nicht zum Absturz bringen
    console.error("[reportBetaError] ClickUp-Request fehlgeschlagen:", reportingError);
  }
}
