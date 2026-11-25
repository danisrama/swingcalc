"use strict";

const cacheName = "swingcalc-shell-v4";
const shell = ["./", "./style.css", "./app.js", "./finance.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const scope = new URL(self.registration.scope);
const home = scope.href;
const index = new URL("./index.html", scope).href;
const assets = new Set(shell.map(path => new URL(path, scope).href));

self.addEventListener("install", event => {
  const requests = [...assets].map(url => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(requests))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("swingcalc-shell-") && key !== cacheName)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  let cacheKey = request.url;
  if (request.mode === "navigate") {
    const url = new URL(request.url);
    url.search = "";
    if (url.href !== home && url.href !== index) return;
    cacheKey = home;
  }
  if (!assets.has(cacheKey)) return;

  event.respondWith(caches.open(cacheName).then(async cache => {
    return (await cache.match(cacheKey)) || fetch(request);
  }));
});
