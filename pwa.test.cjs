const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

const publicDirectory = join(__dirname, "public");
const scope = "https://example.test/calculadora/";

test("The manifest launches a standalone app with bundled icons", () => {
  const manifest = JSON.parse(readFileSync(join(publicDirectory, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(new URL(manifest.start_url, scope).href, scope);
  for (const icon of manifest.icons) assert.ok(existsSync(join(publicDirectory, icon.src)));
});

test("The worker installs the browser assets and serves the app offline", async () => {
  const events = {};
  const cached = new Map();
  const cache = {
    async addAll(requests) {
      for (const request of requests) {
        const path = request.url.slice(scope.length) || "index.html";
        assert.equal(request.cache, "reload");
        cached.set(request.url, readFileSync(join(publicDirectory, path)));
      }
    },
    async match(url) { return cached.get(url); },
  };
  let claimed = false;
  runInNewContext(readFileSync(join(publicDirectory, "sw.js"), "utf8"), {
    URL, Request,
    self: {
      registration: { scope },
      addEventListener(name, callback) { events[name] = callback; },
      async skipWaiting() {},
      clients: { async claim() { claimed = true; } },
    },
    caches: { async open() { return cache; }, async keys() { return []; } },
    async fetch() { throw new Error("Offline"); },
  });

  for (const phase of ["install", "activate"]) {
    let work;
    events[phase]({ waitUntil(promise) { work = promise; } });
    await work;
  }
  assert.ok(claimed);

  function fetchThroughWorker(path, mode) {
    let work;
    events.fetch({
      request: { url: new URL(path, scope).href, method: "GET", mode },
      respondWith(promise) { work = promise; },
    });
    return work;
  }

  for (const path of ["./", "?origen=icono", "index.html?origen=icono"]) {
    assert.match(String(await fetchThroughWorker(path, "navigate")), /<title>SwingCalc<\/title>/);
  }
  for (const path of ["app.js", "finance.js", "plan-chart.js", "style.css", "manifest.webmanifest"]) {
    assert.ok((await fetchThroughWorker(path, "same-origin")).length > 0);
  }
  assert.equal(fetchThroughWorker("otra-pagina", "navigate"), undefined);
  assert.equal(fetchThroughWorker("https://example.org/app.js", "same-origin"), undefined);
});
