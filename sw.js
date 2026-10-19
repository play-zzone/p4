/* PLAYZZONE-GOLD — offline cache
   Replaces the removed AppCache (cache.appcache).
   Deploy alongside index.html at the site root. Bump CACHE to force a refresh.

   CORE is the launcher shell plus the exact entry-point URL of each chain
   (~62 KB). The chain itself is ~450-530 KB across 7 files per option for A and B
   (module + helpers + Web Worker + payload.bin); index.html precaches exactly
   the set for the option the user picked, so we never pull down both chains.
   Chain C is the outlier: 15 entry points plus the shared 290 KB goldhen.bin make
   it by far the largest set, and it is only ever pulled for a 9.00 console.
   A CACHE-name bump is NOT needed for a CORE addition: install is additive
   (c.match(u) ? skip : c.add(u)), so a cache left by the previous release picks
   up the new entries on the next SW update without discarding what it holds. */
/* v5.3 - offline, honestly. Four fixes, all of them silent failures:
   1. Request.mode is "navigate" on any current engine but comes back undefined
      on the PS4's stripped WebKit, and a navigation that misses the navigate
      branch falls into cache-first, whose failure answer is a 504 -- so the page
      itself is a 504. isNav() falls back to the Accept header.
   2. respondWith(undefined) is a TypeError and the browser answers it with its own
      error page: nothing of ours renders and there is no message to read. Every
      offline branch now ends at offlineDoc(), a real Arabic document.
   3. c.put() is not awaited here and rejects on quota, so a failed write looked like
      a successful one. put() swallows it deliberately.
   4. pz-ping is passed straight to the network and its rejection is let through.
      Every other branch turns an offline miss into a 504 RESPONSE, which made a dead
      link indistinguishable from a live one -- and navigator.onLine does not follow a
      console's link down, so the launcher had no honest way to know it was offline.
   v5.2 removed the app-cache manifest from every page on the theory that two cache
   systems fight. They do not: WebKit disables the app cache for any document a
   service worker controls. Removing it left a console whose worker never answers with
   no offline mechanism at all. It is back, on index.html only. */
/* v5.2 — AppCache is no longer wired to any page. All four chain pages carried
   manifest="cache.appcache", so opening one started a 52-URL / 1.07 MB atomic
   download on exactly the page that has to run the exploit from a warm cache — a
   second cache system fighting this one over the same URLs. The file stays on disk
   as an unused fallback, and its FALLBACK entry is now relative, because "/ index.html"
   resolved to the origin root and 404s on a subpath deploy. */
/* v5.1 — narrow-viewport brand tracking. Measured at a 320px viewport the header gave
   .brand a 102px box while PLAYZZONE-GOLD needed 113px at .2em tracking, so the title
   spilled 11px out of its own box on all five pages. Below 380px the tracking tightens
   to .1em at 13px and the flex spacer in the header stops claiming half the row. The
   word, the colour and the order are unchanged, and 414px and up are untouched.
   This is a content change to cached files, so CACHE is bumped and appcache is at v11. */
/* v5.0 — chain C added: PSFree (kmeps4/PSFree, AGPL-3.0-or-later) for firmware 9.00.
   CORE gains run_psfree.html and its ?ui=3 entry point. Everything else is the v5.0
   cold-start gate, unchanged. */
/* v5.0 — the launcher no longer starts the exploit on the visit that downloaded the
   cache. It stops, shows the cold-start notice (close the browser, disconnect, reopen),
   and the exploit only runs from a later open. That is a deliberate stability measure:
   the chain does its heap work with nothing else on the network, from a warm cache.
   To decide, the launcher asks the worker whether a chain set is already fully stored
   (new "check" message) instead of trusting a stored flag -- a flag would survive the
   user clearing site data and wave them into a chain whose modules are gone.
   sw.js also gained a "check" handler; CORE is unchanged. Bump on ANY content change to
   a cached file (this file is not itself a cached entry). */
var CACHE = "pz-gold-v5.3";

/* The bare directory URL ("/") is deliberately NOT listed. c.add stores it under a
   full Request URL that caches.match("/") then fails to find, so it only ever
   produced a dead entry and a 504 on a direct fetch. Navigation to the directory is
   already covered by the navigate branch below, which falls back to ./index.html. */
var CORE = [
  "index.html",
  "jb.html",
  "run_poops.html",
  "run_lapse.html",
  /* The entry point of each chain, by EXACT URL. These are the pages the launch
     button navigates to, and VOLATILE is ["fw","r"] so ?ui=3 / ?log=1 are part of
     the cache key -- a bare "jb.html" entry does NOT cover "jb.html?log=1".
     They belong here, not only in the per-chain precache: that precache is serial
     over ~500 KB and takes a moment, and the navigate branch below falls back to
     ./index.html on a miss. So tapping launch before it finished served the
     LAUNCHER at the run page's URL -- a silent wrong page, not a visible error.
     Verified: with only the bare names in CORE, an offline launch of chain B
     rendered index.html while the address bar said jb.html?log=1.
     ~45 KB on top of the shell, against a 500 KB chain: cheap insurance against
     the one failure mode that looks like success. */
  "jb.html?log=1",
  "run_poops.html?ui=3",
  "run_lapse.html?ui=3",
  /* Chain C (9.00). Same reasoning as the three above: run_psfree.html is the page
     the launch button navigates to for a 9.00 console, and ?ui=3 is part of the
     cache key. Without both entries a 9.00 device that tapped launch before its
     precache finished got index.html served at the chain's URL. */
  "run_psfree.html",
  "run_psfree.html?ui=3"
];

/* ---- install: warm the launcher shell ----
   Sequential on purpose. A parallel Promise.all burst is fine on desktop but
   stalls on a single-threaded origin and on slow console links, and a swallowed
   failure here means the user silently gets no shell at all. Failures are logged,
   not hidden, and index.html is also precached on demand as a backstop. */
self.addEventListener("install", function (e) {
  var missing = [];
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return CORE.reduce(function (chain, u) {
        return chain.then(function () {
          return c.match(u)
            .then(function (hit) { return hit ? null : c.add(new Request(u, { cache: "reload" })); })
            .then(function () { return null; }, function (err) {
              missing.push(u + " (" + err.name + ")");
              return null;
            });
        });
      }, Promise.resolve());
    }).then(function () {
      if (missing.length) console.warn("pz: shell not cached:", missing.join(", "));
      return self.skipWaiting();
    })
  );
});

/* ---- activate: drop old caches, take control ---- */
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* ---- explicit precache request from index.html, with progress + a final reply ---- */
self.addEventListener("message", function (e) {
  var data = e.data || {};
  if (data.type === "check") return checkCache(e, data);
  if (data.type !== "precache") return;
  var port = e.ports && e.ports[0];
  var urls = data.urls || [];
  var done = 0, missing = [];

  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // serial, not Promise.all: these total ~500 KB and a parallel burst on a
      // console browser is exactly what you do not want. Reports progress per file.
      return urls.reduce(function (chain, u) {
        return chain.then(function () {
          return c.match(u)
            .then(function (hit) { return hit ? null : c.add(new Request(u, { cache: "reload" })); })
            .then(function () { return null; }, function () { return u; })
            .then(function (bad) {
              if (bad) missing.push(bad);
              done++;
              if (port) port.postMessage({ type: "progress", done: done, total: urls.length });
            });
        });
      }, Promise.resolve());
    }).then(function () {
      // report per-URL failures instead of rejecting the whole batch: one missing
      // file must not cost the user offline support for all the others
      if (port) port.postMessage({ ok: true, missing: missing });
    }).catch(function (err) {
      if (port) port.postMessage({ ok: false, error: String(err) });
    })
  );
});

/* ---- readiness probe ----
   The launcher has to be able to tell "the cache is already full" from "it still
   needs filling" BEFORE it decides whether to start the exploit, because the
   cold-start gate is built on that answer. This is read-only: it matches every
   URL of a chain set against the cache and reports what is absent. No network,
   no writes, so it is safe to call on every tap.

   Deliberately NOT a flag in localStorage. A stored marker survives the user
   clearing site data, and the launcher would then wave them through to a chain
   whose modules are gone -- the run page would sit at "جارٍ التفعيل…" forever.
   Asking the cache itself cannot go stale. */
function checkCache(e, data) {
  var urls = data.urls || [];
  var port = e.ports && e.ports[0];
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(urls.map(function (u) {
        return c.match(u).then(function (hit) { return hit ? null : u; },
                                    function () { return u; });
      }));
    }).then(function (missing) {
      missing = missing.filter(Boolean);
      if (port) port.postMessage({ ok: true, ready: missing.length === 0, missing: missing });
    }).catch(function (err) {
      if (port) port.postMessage({ ok: false, error: String(err) });
    })
  );
}

/* ---- fetch: network-first for pages, cache-first for the rest ----
   NOTE: fetch() only rejects on transport failure, NOT on 4xx/5xx. A dead router
   or captive portal usually answers with a real 502/200 error page, so every
   network path below must treat !res.ok as a failure too, or the SW will happily
   serve the error page instead of the cache. */
function netOk(res) {
  if (!res || !res.ok) throw new Error("bad response: " + (res && res.status));
  return res;
}

/* Is this a document load? Request.mode is "navigate" on any current engine, but
   the PS4's WebKit is a stripped Sony build and mode can come back undefined for
   document requests. That is not cosmetic: a navigation that misses the navigate
   branch falls into cache-first, whose failure answer is a 504 -- so the PAGE
   itself is a 504, i.e. a blank screen with no message and nothing to read. The
   Accept header is the backstop for exactly that case. */
function isNav(req) {
  if (req.mode === "navigate") return true;
  if (req.mode) return false;
  try { return (req.headers.get("accept") || "").indexOf("text/html") >= 0; }
  catch (e) { return false; }
}

/* c.put() is not awaited in a fetch handler and it REJECTS on a quota error. An
   unhandled rejection there is invisible, so the page believes it refreshed a
   cached copy that it never wrote. Swallow it deliberately. */
function put(key, res) {
  caches.open(CACHE).then(function (c) { return c.put(key, res); }).catch(function () {});
}

/* The last-resort document. respondWith(undefined) is a TypeError, and the browser
   answers it with its own error page: nothing of ours renders and there is no
   message to read, which is the exact "no message appeared" symptom. Every
   offline branch below therefore ends here, in Arabic, saying what to do. */
function offlineDoc() {
  var html = "<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>وضع عدم الاتصال</title><style>body{margin:0;min-height:100vh;display:flex;" +
    "align-items:center;justify-content:center;background:#0b0b0d;color:#e8e2d0;" +
    "font-family:system-ui,'Segoe UI',Tahoma,sans-serif}div{max-width:34em;padding:2em;" +
    "text-align:center;line-height:1.9}h1{font-size:1.15em;color:#d4af37;margin:0 0 .6em}" +
    "p{margin:.4em 0;font-size:.95em}</style></head><body><div>" +
    "<h1>وضع عدم الاتصال</h1>" +
    "<p>ما في اتصال، وما في نسخة محفوظة من هاد الموقع على هاد الجهاز.</p>" +
    "<p>وصّل الإنترنت، افتح الموقع مرة وحدة، وخبّره يكمّل التحميل للآخر، وبعدين اقفل المتصفح وافتحه من جديد.</p>" +
    "</div></body></html>";
  return new Response(html, {
    status: 200,
    statusText: "Offline",
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

/* Cache key: drop the volatile params so ?fw=13.52 and ?fw=11.00 don't each store
   their own copy of the same page. `ui` and `v` are deliberately KEPT -- those are
   the chain's own cache-busters (?ui=3, ?v=10) and the redirect target depends on
   them matching exactly. */
var VOLATILE = ["fw", "r"];
function cacheKey(req) {
  var u = new URL(req.url);
  var changed = false;
  VOLATILE.forEach(function (k) {
    if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; }
  });
  if (!changed) return req;
  var bare = u.pathname + (u.searchParams.toString() ? "?" + u.searchParams.toString() : "");
  return new Request(bare, { headers: req.headers });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  /* Liveness probe, passed straight through. The page asks "is there really a
     network?" with this URL and nothing else: a real 404 still proves the network
     answered. It cannot be answered from the cache, so the fetch below is a live
     one, and a rejected fetch reaches the page as a rejection. Every other branch
     in this file converts an offline miss into a 504 RESPONSE, which would make a
     dead link look like a live one -- and navigator.onLine does not follow the
     link on a console, so the page had no honest way to notice it was offline. */
  if (req.url.indexOf("pz-ping") >= 0) { e.respondWith(fetch(req)); return; }

  var key = cacheKey(req);

  if (isNav(req)) {
    // network-first so updates land, cache fallback so it works offline
    e.respondWith(
      fetch(req).then(function (res) {
        netOk(res);
        put(key, res.clone());
        return res;
      }).catch(function () {
        return caches.match(key).then(function (hit) {
          if (hit) return hit;
          return caches.match("./index.html").then(function (shell) {
            return shell || offlineDoc();
          });
        });
      })
    );
    return;
  }

  // cache-first, with a quiet background refresh
  e.respondWith(
    caches.match(key).then(function (hit) {
      if (hit) {
        fetch(req).then(function (res) {
          if (res && res.ok) put(key, res.clone());
        }).catch(function () {});
        return hit;
      }
      return fetch(req).then(function (res) {
        netOk(res);
        put(key, res.clone());
        return res;
      }).catch(function () {
        return new Response("", { status: 504, statusText: "Offline and not cached" });
      });
    })
  );
});
