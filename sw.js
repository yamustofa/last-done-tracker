const CACHE = "last-done-v5";

const PRECACHE = [
  "./index.html",
  "./help.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE) return caches.delete(key);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

function sameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const indexUrl = new URL("index.html", self.location).href;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const res = await fetch(event.request);
        if (res.ok && sameOrigin(event.request.url)) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, res.clone());
        }
        return res;
      } catch {
        const navFallback =
          (await caches.match(indexUrl)) || (await caches.match("./index.html"));
        if (navFallback) return navFallback;
        throw new Error("Offline and no cached shell");
      }
    })()
  );
});
