// Fahrer App Service Worker — handles Web Push notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Neue Benachrichtigung", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "braain.io Fahrer", {
      body: data.body || "",
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: data.url || "/fahrer" },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/fahrer";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
