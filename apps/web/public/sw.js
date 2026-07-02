self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Юдилен CRM",
    body: "Новое уведомление",
    url: "/admin"
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/images/stitch/asset-001.png",
    badge: "/images/stitch/asset-001.png",
    data: { url: payload.url },
    tag: payload.url
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ("focus" in client) {
        client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
