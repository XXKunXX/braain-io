import {
  parseISO,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  startOfDay,
  endOfDay,
} from "date-fns";
import { getResources, getDispositionEntries, getOrdersForDisposition } from "@/actions/disposition";
import { DispositionCalendar } from "@/components/calendar/disposition-calendar";

export default async function DispositionPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view = (params.view ?? "woche") as "tag" | "woche" | "monat" | "timeline";
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
  } else {
    // woche: Mon–Sat
    rangeStart = startOfWeek(baseDate, { weekStartsOn: 1 });
    rangeEnd = addDays(rangeStart, 5);
  }

  const [resources, orders, entries] = await Promise.all([
    getResources(),
    getOrdersForDisposition(),
    getDispositionEntries(rangeStart, rangeEnd),
  ]);

  return (
    <DispositionCalendar
      resources={resources}
      orders={orders}
      entries={entries}
      rangeStartISO={rangeStart.toISOString()}
      initialView={view}
    />
  );
}
