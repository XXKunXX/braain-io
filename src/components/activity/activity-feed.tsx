"use client";

import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PlusCircle, FileText, Truck, Banknote, MapPin, StickyNote,
  FolderOpen, CheckCircle, MessageSquare, Calendar, ArrowRight,
} from "lucide-react";
import Image from "next/image";
import type { ActivityEvent } from "@/actions/activity";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function stringToColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function ActorAvatar({ actor, actorImage }: { actor: string; actorImage?: string }) {
  const isSystem = actor === "System";
  if (actorImage) {
    return (
      <Image
        src={actorImage}
        alt={actor}
        width={20}
        height={20}
        className="h-5 w-5 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  if (isSystem) {
    return (
      <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 text-[9px] font-semibold">
        SY
      </span>
    );
  }
  return (
    <span className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${stringToColor(actor)} text-white text-[9px] font-semibold`}>
      {getInitials(actor)}
    </span>
  );
}

const TYPE_CONFIG: Record<ActivityEvent["type"], { icon: React.ElementType; color: string; dot: string }> = {
  created:     { icon: PlusCircle,    color: "text-blue-500",   dot: "bg-blue-500" },
  note:        { icon: StickyNote,    color: "text-amber-500",  dot: "bg-amber-400" },
  document:    { icon: FolderOpen,    color: "text-purple-500", dot: "bg-purple-400" },
  payment:     { icon: Banknote,      color: "text-green-500",  dot: "bg-green-500" },
  delivery:    { icon: Truck,         color: "text-cyan-500",   dot: "bg-cyan-500" },
  baustelle:   { icon: MapPin,        color: "text-orange-500", dot: "bg-orange-400" },
  status:      { icon: CheckCircle,   color: "text-gray-500",   dot: "bg-gray-400" },
  quote:       { icon: FileText,      color: "text-indigo-500", dot: "bg-indigo-400" },
  request:     { icon: MessageSquare, color: "text-rose-500",   dot: "bg-rose-400" },
  task:        { icon: CheckCircle,   color: "text-teal-500",   dot: "bg-teal-400" },
  disposition: { icon: Calendar,      color: "text-emerald-500",dot: "bg-emerald-400" },
};

type FilterType = "ALL" | "USER" | "SYSTEM";

interface Props {
  events: ActivityEvent[];
}

export function ActivityFeed({ events }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("ALL");

  const filtered = filter === "ALL" ? events : events.filter((e) => e.actorType === filter);

  if (events.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <PlusCircle className="h-8 w-8 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Noch keine Aktivitäten</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter toggle */}
      <div className="flex gap-1 mb-4">
        {(["ALL", "USER", "SYSTEM"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {f === "ALL" ? "Alle" : f === "USER" ? "Benutzer" : "System"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p className="text-sm">Keine Aktivitäten in dieser Kategorie</p>
        </div>
      ) : (
        <div className="flow-root">
          <ul className="-mb-8">
            {filtered.map((event, i) => {
              const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.created;
              const Icon = cfg.icon;
              const isLast = i === filtered.length - 1;
              const date = new Date(event.date);
              return (
                <li key={event.id}>
                  <div className="relative pb-8">
                    {!isLast && (
                      <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-100" aria-hidden="true" />
                    )}
                    <div className="relative flex items-start gap-3">
                      {/* Icon dot */}
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white border-2 border-gray-100`}>
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                      </div>
                      {/* Content */}
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{event.description}</p>
                            )}
                            {event.actor && (
                              <div className="flex items-center gap-1 mt-1">
                                <ActorAvatar actor={event.actor} actorImage={event.actorImage} />
                                <span className="text-xs text-gray-400">{event.actor}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <time
                              dateTime={date.toISOString()}
                              title={format(date, "dd.MM.yyyy HH:mm", { locale: de })}
                              className="text-xs text-gray-400 whitespace-nowrap"
                            >
                              {formatDistanceToNow(date, { addSuffix: true, locale: de })}
                            </time>
                            {event.link && (
                              <button
                                onClick={() => router.push(event.link!)}
                                className="text-gray-300 hover:text-blue-500 transition-colors"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
