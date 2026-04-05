/**
 * Calendar Sync Service
 *
 * Wie ein Termin in den Kalender kommt:
 * 1. Auftrag / Baustelle wird erstellt oder geändert
 * 2. `syncOrderToCalendars(orderId, clerkUserId)` aufrufen
 * 3. Diese Funktion holt alle aktiven Integrationen des Users
 * 4. Für jede Integration wird via Google Calendar API / MS Graph ein Event erstellt
 * 5. Die externe Event-ID wird in `CalendarEvent` gespeichert → spätere Updates/Löschungen möglich
 */

import { prisma } from "@/lib/prisma";
import type { CalendarIntegration } from "@prisma/client";

// ── Token Refresh ─────────────────────────────────────────────────────────────

async function refreshGoogleToken(integration: CalendarIntegration): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      refresh_token: integration.refreshToken!,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokens.access_token,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
  return tokens.access_token as string;
}

async function refreshOutlookToken(integration: CalendarIntegration): Promise<string> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: integration.refreshToken!,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
    }),
  });
  const tokens = await res.json();
  await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? integration.refreshToken,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
  return tokens.access_token as string;
}

async function getValidToken(integration: CalendarIntegration): Promise<string> {
  // If token is still valid (with 60s buffer), use it
  if (
    integration.accessToken &&
    integration.tokenExpiry &&
    integration.tokenExpiry > new Date(Date.now() + 60_000)
  ) {
    return integration.accessToken;
  }
  if (!integration.refreshToken) throw new Error("No refresh token available");
  if (integration.provider === "GOOGLE") return refreshGoogleToken(integration);
  if (integration.provider === "OUTLOOK") return refreshOutlookToken(integration);
  throw new Error(`Token refresh not supported for ${integration.provider}`);
}

// ── Event Types ───────────────────────────────────────────────────────────────

export type CalendarEventInput = {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
};

// ── Google Calendar API ───────────────────────────────────────────────────────

async function createGoogleEvent(
  integration: CalendarIntegration,
  event: CalendarEventInput
): Promise<string> {
  const token = await getValidToken(integration);
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start.toISOString(), timeZone: "Europe/Vienna" },
        end: { dateTime: event.end.toISOString(), timeZone: "Europe/Vienna" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const data = await res.json();
  return data.id as string;
}

async function updateGoogleEvent(
  integration: CalendarIntegration,
  externalEventId: string,
  event: CalendarEventInput
): Promise<void> {
  const token = await getValidToken(integration);
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${externalEventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start.toISOString(), timeZone: "Europe/Vienna" },
        end: { dateTime: event.end.toISOString(), timeZone: "Europe/Vienna" },
      }),
    }
  );
}

async function deleteGoogleEvent(
  integration: CalendarIntegration,
  externalEventId: string
): Promise<void> {
  const token = await getValidToken(integration);
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${externalEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// ── Microsoft Graph API ───────────────────────────────────────────────────────

async function createOutlookEvent(
  integration: CalendarIntegration,
  event: CalendarEventInput
): Promise<string> {
  const token = await getValidToken(integration);
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.title,
      body: { contentType: "text", content: event.description ?? "" },
      location: event.location ? { displayName: event.location } : undefined,
      start: { dateTime: event.start.toISOString(), timeZone: "Europe/Vienna" },
      end: { dateTime: event.end.toISOString(), timeZone: "Europe/Vienna" },
    }),
  });
  if (!res.ok) throw new Error(`Microsoft Graph API error: ${res.status}`);
  const data = await res.json();
  return data.id as string;
}

async function updateOutlookEvent(
  integration: CalendarIntegration,
  externalEventId: string,
  event: CalendarEventInput
): Promise<void> {
  const token = await getValidToken(integration);
  await fetch(`https://graph.microsoft.com/v1.0/me/events/${externalEventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.title,
      body: { contentType: "text", content: event.description ?? "" },
      location: event.location ? { displayName: event.location } : undefined,
      start: { dateTime: event.start.toISOString(), timeZone: "Europe/Vienna" },
      end: { dateTime: event.end.toISOString(), timeZone: "Europe/Vienna" },
    }),
  });
}

async function deleteOutlookEvent(
  integration: CalendarIntegration,
  externalEventId: string
): Promise<void> {
  const token = await getValidToken(integration);
  await fetch(`https://graph.microsoft.com/v1.0/me/events/${externalEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Unified Sync for one integration ─────────────────────────────────────────

async function upsertCalendarEvent(
  integration: CalendarIntegration,
  resourceType: string,
  resourceId: string,
  event: CalendarEventInput
): Promise<void> {
  const existing = await prisma.calendarEvent.findUnique({
    where: {
      integrationId_resourceType_resourceId: {
        integrationId: integration.id,
        resourceType,
        resourceId,
      },
    },
  });

  if (integration.provider === "GOOGLE") {
    if (existing) {
      await updateGoogleEvent(integration, existing.externalEventId, event);
    } else {
      const externalId = await createGoogleEvent(integration, event);
      await prisma.calendarEvent.create({
        data: { integrationId: integration.id, externalEventId: externalId, resourceType, resourceId },
      });
    }
  } else if (integration.provider === "OUTLOOK") {
    if (existing) {
      await updateOutlookEvent(integration, existing.externalEventId, event);
    } else {
      const externalId = await createOutlookEvent(integration, event);
      await prisma.calendarEvent.create({
        data: { integrationId: integration.id, externalEventId: externalId, resourceType, resourceId },
      });
    }
  }

  await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date(), status: "ACTIVE" },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Auftrag in alle verbundenen Kalender synchronisieren.
 * Aufruf z.B. in createOrder / updateOrder Server Actions.
 *
 * @example
 * // In src/actions/orders.ts nach dem Speichern:
 * import { syncOrderToCalendars } from "@/lib/calendar-sync";
 * await syncOrderToCalendars(order.id, userId);
 */
export async function syncOrderToCalendars(orderId: string, clerkUserId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { contact: true },
  });
  if (!order) return;

  const integrations = await prisma.calendarIntegration.findMany({
    where: { clerkUserId, syncEnabled: true, syncOrders: true, status: "ACTIVE" },
  });

  const event: CalendarEventInput = {
    title: `Auftrag: ${order.title}`,
    description: [
      `Auftragsnummer: ${order.orderNumber}`,
      `Kunde: ${order.contact.companyName || [order.contact.firstName, order.contact.lastName].filter(Boolean).join(" ")}`,
      order.notes ? `Notizen: ${order.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    start: order.startDate,
    end: order.endDate,
  };

  for (const integration of integrations) {
    try {
      await upsertCalendarEvent(integration, "ORDER", orderId, event);
    } catch (err) {
      console.error(`Calendar sync failed for integration ${integration.id}:`, err);
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: { status: "ERROR" },
      });
    }
  }
}

/**
 * Baustelle in alle verbundenen Kalender synchronisieren.
 *
 * @example
 * import { syncBaustelleToCalendars } from "@/lib/calendar-sync";
 * await syncBaustelleToCalendars(baustelle.id, userId);
 */
export async function syncBaustelleToCalendars(baustelleId: string, clerkUserId: string) {
  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
  });
  if (!baustelle || !baustelle.endDate) return;

  const integrations = await prisma.calendarIntegration.findMany({
    where: { clerkUserId, syncEnabled: true, syncBaustellen: true, status: "ACTIVE" },
  });

  const event: CalendarEventInput = {
    title: `Baustelle: ${baustelle.name}`,
    description: [
      baustelle.address ? `Adresse: ${baustelle.address}` : "",
      baustelle.notes ? `Notizen: ${baustelle.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    location: [baustelle.address, baustelle.city].filter(Boolean).join(", "),
    start: baustelle.startDate,
    end: baustelle.endDate,
  };

  for (const integration of integrations) {
    try {
      await upsertCalendarEvent(integration, "BAUSTELLE", baustelleId, event);
    } catch (err) {
      console.error(`Calendar sync failed for integration ${integration.id}:`, err);
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: { status: "ERROR" },
      });
    }
  }
}

/**
 * Kalender-Event löschen wenn ein Auftrag / eine Baustelle gelöscht wird.
 */
export async function deleteCalendarEvents(resourceType: string, resourceId: string) {
  const events = await prisma.calendarEvent.findMany({
    where: { resourceType, resourceId },
    include: { integration: true },
  });

  for (const calEvent of events) {
    try {
      if (calEvent.integration.provider === "GOOGLE") {
        await deleteGoogleEvent(calEvent.integration, calEvent.externalEventId);
      } else if (calEvent.integration.provider === "OUTLOOK") {
        await deleteOutlookEvent(calEvent.integration, calEvent.externalEventId);
      }
    } catch (err) {
      console.error(`Failed to delete calendar event ${calEvent.id}:`, err);
    }
  }

  await prisma.calendarEvent.deleteMany({ where: { resourceType, resourceId } });
}
