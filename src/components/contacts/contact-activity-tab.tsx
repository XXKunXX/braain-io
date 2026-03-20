import { ActivityFeed } from "@/components/activity/activity-feed";
import type { ActivityEvent } from "@/actions/activity";

export function ContactActivityTab({ events }: { events: ActivityEvent[] }) {
  return <ActivityFeed events={events} />;
}
