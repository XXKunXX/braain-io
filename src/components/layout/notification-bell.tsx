"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { getNotifications, markAllRead, markRead } from "@/actions/notifications";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type Notification = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: Date;
};

const TYPE_DOT: Record<string, string> = {
  INFO: "bg-blue-500",
  SUCCESS: "bg-green-500",
  WARNING: "bg-amber-500",
  ERROR: "bg-red-500",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unread = notifications.filter((n) => !n.read).length;

  async function load() {
    const data = await getNotifications();
    setNotifications(data as Notification[]);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleClickNotification(n: Notification) {
    if (!n.read) {
      await markRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    }
    if (n.link) {
      router.push(n.link);
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Benachrichtigungen</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Alle lesen
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3 items-start ${!n.read ? "bg-blue-50/40" : ""}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? (TYPE_DOT[n.type] ?? "bg-blue-500") : "bg-gray-200"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!n.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
