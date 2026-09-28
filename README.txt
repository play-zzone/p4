PLAYZZONE-GOLD V5.2 — three chains, firmware 9.00 to 13.52
==========================================================
Bilingual (AR / EN) launcher for static hosting, dark gold theme.

The step-by-step upload guide in Arabic is README-UPLOAD.txt. This file is the
technical reference: what is in the folder, what was changed, what to touch
next time.

------------------------------------------------------------
1. FIRMWARE
------------------------------------------------------------
 Chain A   11.00  11.50  12.00  12.02  12.50  12.52  13.00
           run_poops.html?ui=3      (7 firmwares)

 Chain B   13.02  13.04  13.50  13.52
           jb.html?log=1           (4 firmwares)

 Chain C   9.00
           run_psfree.html?ui=3    (1 firmware)

           12 supported in total.

 Anything else is refused on the spot, with no download: 11.52, 12.01, 12.51,
 13.01, 13.55, and everything from 9.01 to 10.72 and below 9.00. The launcher
 picks the chain from the User-Agent on its own. If it cannot read the
 User-Agent, the three chains are offered as cards and the user picks.

 A firmware is supported only if it has a PS4 entry in that chain's offsets
 table AND a matching patches/*.bin. Chain B reads all four of its firmwares
 from payload2.bin; chains A and C read payload.bin and goldhen.bin.

------------------------------------------------------------
2. HOW A RUN WORKS
------------------------------------------------------------
 First open  — the launcher downloads that chain's exact file set (17 files for
              A and C, 19 for B) into the service worker cache, shows a
              progress bar, and then STOPS. The exploit does not start.
              It tells the user to close the browser fully, turn the Wi-Fi
              off (or use airplane mode), and reopen.
 Later open  — the launcher finds the set already stored and goes straight to
              the chain page, which then runs with nothing on the network.

 This split is deliberate. The chain does its heap work from a warm cache
 with no competing traffic, which is the part that is unstable on a console.
 There is no skip button and no auto-redirect: the second open is the trigger.

 If any file is missing from the cache, the launcher says so and asks for the
 network instead of starting a chain that cannot finish.

------------------------------------------------------------
3. FILES  (52 total, 1.9 MB)
------------------------------------------------------------
 Authored here (9):
   index.html      launcher shell, firmware routing, cold-start gate
   jb.html         chain B page
   run_poops.html  chain A page
   run_lapse.html  chain A, alternate build
   run_psfree.html chain C page
   sw.js           service worker: cache, precache, check
   cache.appcache  50 URLs, rev v12
   README-UPLOAD.txt, README.txt

 Chain A (upstream, unmodified):
   chain_poops.js, chain_lapse.js, core.js, mem.js, int64.js,
   ps4_offsets.js, rpc_worker.js, payload.bin (293,120 B)
   patches/  1100 1150 1200 1250 1300 1302 1304 1350 1352 (.bin)

 Chain B (ported — see section 4):
   jb.js, jb_core.js, jb_mem.js, jb_int64.js, jb_offsets.js,
   jb_rpc_worker.js, payload2.bin (293,120 B, byte-identical to payload.bin)

 Chain C (PSFree, 16 files):
   psfree.js, lapse.js, config.js, goldhen.bin (290,016 B)
   module/  chain constants int64 mem memtools offset rw utils view (.js)
   rop/     900.js
   aio_patches.bin
   LICENSE-PSFree-AGPL.txt

 Shared:
   logo_playzone.png
   kernel_offset_13.04.js and ko-files/kernel_offset_13.04.js — TypeScript
   source, referenced by nothing, not loaded by any page. Excluded from the
   parse check by name because a parser is the wrong instrument for them.

------------------------------------------------------------
4. WHAT WAS CHANGED FROM UPSTREAM
------------------------------------------------------------
 Chain A   nothing. As shipped.

 Chain B   jb.js and the patches table were rewritten for on-device stability.
           Import paths point at the jb_* modules so the two chains cannot
           collide. The pre-port file is kept outside the folder for rollback.

 Chain C   Shipped as PSFree, with two deliberate deviations, and nothing else:
             1. all 13 .mjs renamed to .js. A <script type="module"> is refused
                outright by a browser that does not get a JavaScript MIME type
                for the response, and the failure is silent — the page would
                sit on "activating" forever with nothing thrown. The .js
                extension is what chains A and B already prove on this host.
             2. one line in module/utils.js: `console.innerHTML = null` became
                `''`. null coerces to the string "null", and the chain clears
                the log right after its UAF stage, so the whole panel read
                "null". Display only.
           Everything else — the exploit, the ROP, the payloads — is untouched.

 PSFree is AGPL-3.0-or-later. Its licence travels with it as
 LICENSE-PSFree-AGPL.txt and must stay in the folder.

------------------------------------------------------------
5. UPDATING LATER
------------------------------------------------------------
 Any change to a cached file needs a version bump, or a returning browser will
 keep serving the old copy forever:

   sw.js            var CACHE = "pz-gold-v5.2"      -> v5.2
   cache.appcache   the rev comment at the top      -> v13
   index.html       version: "V5.2" in both language objects
   the header comment of all five HTML pages        -> v5.2
   README-UPLOAD.txt  the version and cache-name line

 A CORE addition alone needs no CACHE bump — install is additive and picks up
 new entries on the next service worker update. Changing the content of a
 file that is already in CORE does need one.

 The ?ui=3, ?v=10 and ?jbv=10 query strings are a different namespace. They
 are module cache keys listed in the DEPS sets and in cache.appcache; bumping
 the release label must not touch them.

 Then: node pz-tools/gate_final.js, node pz-tools/fwgate.js,
       node pz-tools/readmescan.js — all three must pass before uploading.
