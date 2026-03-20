export const dynamic = "force-dynamic";

import {
  parseISO,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  startOfDay,
  endOfDay,
} from "date-fns";
import { getResources, getDispositionEntries, getBaustellenForDisposition } from "@/actions/disposition";
import { DispositionCalendar } from "@/components/calendar/disposition-calendar";

export default async function DispositionPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; baustelleId?: string; baustelleName?: string }>;
}) {
  const params = await searchParams;
  const view = (params.view ?? "woche") as "tag" | "woche" | "monat" | "timeline" | "6wochen";
  const baseDate = params.week ? parseISO(params.week) : new Date();

  let rangeStart: Date;
  let rangeEnd: Date;

  if (view === "tag") {
    rangeStart = startOfDay(baseDate);
    rangeEnd = endOfDay(baseDate);
  } else if (view === "monat") {
    rangeStart = startOfMonth(baseDate);
    rangeEnd = endOfMonth(baseDate);
  } else if (view === "timeline") {
    rangeStart = startOfWeek(baseDate, { weekStartsOn: 1 });
    rangeEnd = addDays(rangeStart, 13);
  } else if (view === "6wochen") {
    rangeStart = startOfWeek(baseDate, { weekStartsOn: 1 });
    rangeEnd = addDays(rangeStart, 41);
  } else {
    rangeStart = startOfWeek(baseDate, { weekStartsOn: 1 });
    rangeEnd = addDays(rangeStart, 5);
  }

  const [resources, baustellen, entries] = await Promise.all([
    getResources(),
    getBaustellenForDisposition(),
    getDispositionEntries(rangeStart, rangeEnd),
  ]);

  return (
    <DispositionCalendar
      resources={resources}
      baustellen={baustellen}
      entries={entries}
      rangeStartISO={rangeStart.toISOString()}
      initialView={view}
      baustelleId={params.baustelleId}
      baustelleName={params.baustelleName}
    />
  );
}
