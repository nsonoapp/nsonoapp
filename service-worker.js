const BASE_PATH =
  self.location.pathname.replace(/\/service-worker\.js$/, "") || "";

const withBase = (path) => {
  if (!path.startsWith("/")) {
    return path;
  }
  return `${BASE_PATH}${path}`;
};

/* =========================
   INSTALL — pas de précache
========================= */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

/* =========================
   ACTIVATE — purge tous les caches
========================= */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

/* =========================
   NOTIFICATIONS
========================= */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const target = clients.find((client) =>
        client.url.includes("debts.html") || client.url.includes("finances.html")
      );
      if (target) {
        return target.focus();
      }
      return self.clients.openWindow(withBase("/debts.html"));
    })
  );
});

/* =========================
   FETCH — réseau uniquement (pas de cache listing)
========================= */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(request).catch(() => {
      if (
        request.url.includes("firebase") ||
        request.url.includes("googleapis")
      ) {
        return new Response(null, { status: 503, statusText: "Offline" });
      }

      return new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" }
      });
    })
  );
});
