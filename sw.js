/* LiftLog service worker — notifications ONLY.
   iOS can't use `new Notification()`; a rest-timer alert has to go through
   registration.showNotification(), which needs a service worker to exist.

   There is deliberately NO fetch/cache handler here: the app self-updates by
   polling version.js, and a caching SW would fight that (stale cached HTML on
   one phone silently broke joint sync before). Keep it that way. */

self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// tapping the "Rest over" notification jumps back into the workout
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) { if ("focus" in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow("./index.html");
  })());
});
