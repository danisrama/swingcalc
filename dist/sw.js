"use strict";

const cacheName = "swingcalc-shell-v3";
const shell = ["./", "./index.html", "./style.css", "./app.js", "./finance.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("swingcalc-shell-") && key !== cacheName)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const index = shell.find(path => new URL(path, self.registration.scope).href === request.url);
  if (request.mode === "navigate" && index !== "./" && index !== "./index.html") return;
  if (!index) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    if (request.mode === "navigate") return (await cache.match("./")) || fetch(request);
    return (await cache.match(request)) || fetch(request);
  }));
});
