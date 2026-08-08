self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    self.registration.showNotification(data.title || "GYMX", {
      body: data.body || "",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      vibrate: [200, 100, 200],
      data: { url: data.url || "/qg" },
    });
  } catch { /* ignore */ }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/qg";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url.includes(self.location.origin) && "focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
