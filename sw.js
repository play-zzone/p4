// ============================================================
// sw.js — PLAYZZONE p4 v5.2
// ============================================================

const CACHE_NAME = 'pz-gold-v5.2';

const CORE = [
  './',
  './index.html',
  './jb.html',
  './run_poops.html',
  './run_lapse.html',
  './run_psfree.html',
  './sw.js',
  './chain_poops.js',
  './chain_lapse.js',
  './core.js',
  './mem.js',
  './int64.js',
  './ps4_offsets.js',
  './rpc_worker.js',
  './payload.bin',
  './payload2.bin',
  './goldhen.bin',
  './aio_patches.bin',
  './jb.js',
  './jb_core.js',
  './jb_mem.js',
  './jb_int64.js',
  './jb_offsets.js',
  './jb_rpc_worker.js',
  './psfree.js',
  './lapse.js',
  './config.js',
  './logo_playzone.png',
  './patches/1100.bin',
  './patches/1150.bin',
  './patches/1200.bin',
  './patches/1250.bin',
  './patches/1300.bin',
  './patches/1302.bin',
  './patches/1304.bin',
  './patches/1350.bin',
  './patches/1352.bin',
  './module/chain.js',
  './module/constants.js',
  './module/int64.js',
  './module/mem.js',
  './module/memtools.js',
  './module/offset.js',
  './module/rw.js',
  './module/utils.js',
  './module/view.js',
  './rop/900.js',
  /* ---- local modification (PLAYZZONE-GOLD) ----
     lapse.js calls get_patches('./kpatch/900.elf') inside patch_kernel(),
     which runs after the ARW primitive is established. Without this entry
     the file is never pre-cached, the fetch inside patch_kernel fails with
     HTTP 404 after several minutes of exploit work, and the run dies at the
     last stage. The blob itself has to be present on disk at kpatch/900.elf
     -- sw.js can only cache what exists. */
  './kpatch/900.elf',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    let done = 0;
    const results = await Promise.allSettled(
      CORE.map(async url => {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        await cache.put(url, res);
        done++;
        // progress ping
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(c => c.postMessage({
          type: 'CACHE_PROGRESS', done, total: CORE.length
        }));
        return url;
      })
    );

    const failed = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason?.message ?? String(r.reason));

    const clients = await self.clients.matchAll({ type: 'window' });

    if (failed.length) {
      clients.forEach(c => c.postMessage({ type: 'CACHE_FAIL', failed }));
      throw new Error('cache install failed:\n' + failed.join('\n'));
    }

    clients.forEach(c => c.postMessage({ type: 'CACHE_READY' }));
    await self.skipWaiting();
  })());
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request, { cacheName: CACHE_NAME });
    if (cached) return cached;

    try {
      const fresh = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, fresh.clone());
      return fresh;
    } catch {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.postMessage({
        type: 'MISSING_FILE', url: event.request.url
      }));
      return new Response(
        JSON.stringify({ error: 'offline', url: event.request.url }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  })());
});

// ── MESSAGE: CHECK_CACHE ──────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_CACHE') return;
  (async () => {
    const cache  = await caches.open(CACHE_NAME);
    const keys   = await cache.keys();
    const cached = new Set(keys.map(r => new URL(r.url).pathname));
    const base   = new URL('./', self.location.href).pathname;

    const missing = CORE
      .map(u => new URL(u, self.location.href).pathname)
      .filter(p => !cached.has(p));

    event.source.postMessage({
      type:    'CACHE_STATUS',
      ready:   missing.length === 0,
      total:   CORE.length,
      cached:  CORE.length - missing.length,
      missing,
    });
  })();
});