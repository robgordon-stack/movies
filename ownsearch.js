/* ownsearch.js - "Do I own it?" search shared by The Archive (index.html) and The List (wishlist.html).
 *
 * Type a title (optionally a year or director) and see whether it is Owned, on the Wishlist, or Not tracked.
 * Opens with the floating button or the "/" key. Esc closes.
 *
 * Each page may define, BEFORE this file loads:
 *   window.OWN_ADAPTER = {
 *     getOwned:  () => [...],          // default: fetch collection.json
 *     getWanted: () => [...],          // default: fetch wishlist.json
 *     openOwned: film => {...},        // optional: called when an owned result is tapped
 *     openWanted: film => {...}        // optional: called when a wishlist result is tapped
 *   }
 */
(function () {
  "use strict";

  const A = window.OWN_ADAPTER || {};
  let cache = null;

  const fold = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const noArticle = s => fold(s).replace(/^(the|a|an|le|la|les|il|l|el|los|las|das|der|die|den|det) /, "");
  const STOP = new Set(["the", "a", "an", "le", "la", "les", "il", "l", "el", "los", "las", "das", "der", "die", "den", "det"]);
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* Pure search: returns [{f, kind:'owned'|'wanted', rank}] best first. */
  function search(q, owned, wanted) {
    let tokens = fold(q).split(" ").filter(Boolean);
    const core = tokens.filter(t => !STOP.has(t));      // ignore leading "the", "le" ... unless that is all there is
    if (core.length) tokens = core;
    if (!tokens.length) return [];
    const whole = noArticle(q);
    const out = [];
    const test = (f, kind) => {
      const title = fold(f.title), tNo = noArticle(f.title);
      const hay = " " + title + " " + (f.year || "") + " " + fold(f.director) + " ";
      // every token must start a word (or be a substring of a word >= 3 chars) in the haystack
      const ok = tokens.every(t => hay.indexOf(" " + t) > -1 || (t.length >= 4 && hay.indexOf(t) > -1));
      if (!ok) return;
      let rank = 4;
      if (tNo === whole || title === fold(q)) rank = 0;
      else if (tNo.indexOf(whole) === 0) rank = 1;
      else if (tokens.every(t => (" " + title).indexOf(" " + t) > -1)) rank = 2;
      else if (tokens.every(t => title.indexOf(t) > -1)) rank = 3;
      out.push({ f, kind, rank });
    };
    owned.forEach(f => test(f, "owned"));
    wanted.forEach(f => test(f, "wanted"));
    out.sort((a, b) => a.rank - b.rank || (a.kind === b.kind ? 0 : a.kind === "owned" ? -1 : 1)
      || (b.f.year || 0) - (a.f.year || 0));
    return out;
  }
  window.__ownSearch = { search, fold };

  async function load() {
    if (cache) return cache;
    const get = async (fn, url) => {
      if (typeof fn === "function") { try { const r = fn(); if (Array.isArray(r) && r.length) return r; } catch (e) {} }
      try { const r = await fetch(url + "?v=" + Date.now()); return r.ok ? await r.json() : []; } catch (e) { return []; }
    };
    return { owned: await get(A.getOwned, "collection.json"), wanted: await get(A.getWanted, "wishlist.json") };
  }

  /* ---------- UI ---------- */
  if (typeof document === "undefined") return;
  const css = `
#ownFab{position:fixed;right:14px;bottom:calc(66px + env(safe-area-inset-bottom));z-index:290;background:var(--acc,#e8b94f);color:#111;border:0;border-radius:22px;padding:10px 15px;font:600 13px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.5);cursor:pointer}
#ownOv{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.75);display:none;align-items:flex-start;justify-content:center;padding:calc(env(safe-area-inset-top) + 7vh) 10px 10px}
#ownOv.open{display:flex}
#ownBox{width:min(540px,100%);background:var(--surf,#171717);border:1px solid var(--bdr2,rgba(255,255,255,.12));border-radius:14px;padding:12px;max-height:80vh;display:flex;flex-direction:column;color:var(--txt,#efefef);font-family:system-ui,sans-serif}
#ownIn{width:100%;box-sizing:border-box;background:var(--surf2,#202020);border:1px solid var(--bdr2,rgba(255,255,255,.12));border-radius:10px;padding:12px;font-size:16px;color:inherit;outline:none}
#ownIn:focus{border-color:var(--acc,#e8b94f)}
#ownRes{overflow-y:auto;margin-top:8px}
.ownRow{display:flex;gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid var(--bdr,rgba(255,255,255,.07));width:100%;background:none;border-left:0;border-right:0;border-top:0;color:inherit;text-align:left;font:inherit;cursor:default}
.ownRow.tap{cursor:pointer}
.ownRow.tap:hover,.ownRow.tap:focus-visible{background:rgba(255,255,255,.05);outline:none}
.ownRow img,.ownRow .ph{width:34px;height:51px;border-radius:4px;object-fit:cover;background:var(--surf3,#2a2a2a);flex:0 0 34px}
.ownT{font-size:14px;font-weight:600}.ownM{font-size:12px;color:var(--mut,#999);margin-top:2px}
.ownB{display:inline-block;font-size:11px;font-weight:700;border-radius:10px;padding:2px 8px;margin-top:4px}
.ownB.o{background:rgba(120,200,120,.18);color:#8fd48f}.ownB.w{background:rgba(232,185,79,.16);color:var(--acc,#e8b94f)}
.ownNone{padding:18px 6px;font-size:14px;color:var(--mut,#999);text-align:center}
.ownNone b{display:block;color:var(--txt,#efefef);font-size:15px;margin-bottom:4px}
.ownHint{font-size:11px;color:var(--mut2,#666);margin-top:8px;text-align:center}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const fab = document.createElement("button");
  fab.id = "ownFab"; fab.type = "button"; fab.textContent = "🔍 Own it?"; fab.setAttribute("aria-label", "Check whether you own a film");
  const ov = document.createElement("div");
  ov.id = "ownOv"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Do I own it?");
  ov.innerHTML = '<div id="ownBox"><input id="ownIn" type="search" placeholder="Title, year or director…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search title"><div id="ownRes" aria-live="polite"></div><div class="ownHint">Searches your collection and wishlist · Esc to close</div></div>';
  document.body.appendChild(fab); document.body.appendChild(ov);
  const inp = ov.querySelector("#ownIn"), res = ov.querySelector("#ownRes");
  let shown = [];

  function meta(f) {
    return [f.year, f.director, f.country].filter(Boolean).map(esc).join(" · ");
  }
  function badge(r) {
    const f = r.f;
    if (r.kind === "owned") {
      const bits = [f.format, f.distributor, f.spine ? "#" + f.spine : ""].filter(Boolean).map(esc).join(" · ");
      return '<span class="ownB o">✓ Owned' + (bits ? " · " + bits : "") + "</span>";
    }
    const bits = [f.priority, f.has4k ? "4K" : ""].filter(Boolean).map(esc).join(" · ");
    return '<span class="ownB w">★ Wishlist' + (bits ? " · " + bits : "") + "</span>";
  }
  function draw(list, q) {
    shown = list.slice(0, 12);
    if (!q.trim()) { res.innerHTML = ""; return; }
    if (!shown.length) {
      res.innerHTML = '<div class="ownNone"><b>Not tracked</b>"' + esc(q.trim()) + '" isn\'t in your collection or wishlist. Try fewer words, or the original-language title.</div>';
      return;
    }
    res.innerHTML = shown.map((r, i) => {
      const tap = r.kind === "owned" ? A.openOwned : A.openWanted;
      const img = r.f.poster ? '<img src="' + esc(r.f.poster) + '" alt="" loading="lazy">' : '<div class="ph"></div>';
      return '<button type="button" class="ownRow' + (tap ? " tap" : "") + '" data-i="' + i + '">' + img +
        '<div><div class="ownT">' + esc(r.f.title) + "</div><div class=\"ownM\">" + meta(r.f) + "</div>" + badge(r) + "</div></button>";
    }).join("");
  }
  async function run() {
    const q = inp.value;
    if (!cache) cache = await load();
    draw(search(q, cache.owned, cache.wanted), q);
  }
  function open() {
    ov.classList.add("open"); inp.value = ""; res.innerHTML = ""; inp.focus();
    cache = null; load().then(c => { cache = c; });          // refresh data each time it opens
  }
  function close() { ov.classList.remove("open"); inp.blur(); }

  fab.addEventListener("click", open);
  ov.addEventListener("click", e => { if (e.target === ov) close(); });
  inp.addEventListener("input", run);
  res.addEventListener("click", e => {
    const row = e.target.closest(".ownRow"); if (!row) return;
    const r = shown[+row.dataset.i]; const fn = r.kind === "owned" ? A.openOwned : A.openWanted;
    if (fn) { close(); fn(r.f); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && ov.classList.contains("open")) { close(); return; }
    const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open(); }
  });
})();
