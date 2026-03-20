import { ActivityFeed } from "@/components/activity/activity-feed";
import type { ActivityEvent } from "@/actions/activity";

export function OrderActivityTab({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="px-6 py-6 max-w-2xl">
      <ActivityFeed events={events} />
    </div>
  );
}
