"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

declare const process: { env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string } };

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PushSubscribeButton() {
  const [state, setState] = useState<"unknown" | "granted" | "denied" | "unsupported">("unknown");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const permission = Notification.permission;
    if (permission === "granted") setState("granted");
    else if (permission === "denied") setState("denied");
    else setState("unknown");
  }, []);

  async function handleClick() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast.error("Push-Benachrichtigungen nicht konfiguriert");
      return;
    }

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        toast.error("Benachrichtigungen nicht erlaubt");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setState("granted");
      toast.success("Benachrichtigungen aktiviert");
    } catch (err) {
      console.error(err);
      toast.error("Aktivierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  if (state === "unsupported" || state === "denied") return null;
  if (state === "granted") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
        <Bell className="h-3.5 w-3.5" /> Benachrichtigungen aktiv
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-medium transition-colors disabled:opacity-50"
    >
      <BellOff className="h-3.5 w-3.5" />
      {loading ? "Aktiviere..." : "Benachrichtigungen"}
    </button>
  );
}
