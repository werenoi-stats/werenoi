/* Werenoi : cinq univers. Données : data.js (streams kworb), certs.js (SNEP), albums.js (projets + tracklists). */
(function () {
  "use strict";
  var D = window.WERENOI_DATA, C = window.WERENOI_CERTS || { certs: [] }, A = window.WERENOI_ALBUMS || { projects: [] };
  var $ = function (id) { return document.getElementById(id); };
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!D || !D.tracks || !D.tracks.length) { document.body.classList.add("no-data"); return; }

  /* ================= helpers ================= */
  var nf = new Intl.NumberFormat("fr-FR");
  function fmt(n) { return nf.format(Math.round(n)); }
  function compact(n) {
    if (n >= 1e9) return (n / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " Md";
    if (n >= 1e6) return (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: n >= 1e8 ? 0 : 1 }) + " M";
    if (n >= 1e3) return Math.round(n / 1e3) + " k";
    return String(n);
  }
  function asDate(iso) { return new Date(iso + "T12:00:00Z"); }
  function longDate(iso) { return iso ? asDate(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(/^1 /, "1er ") : "—"; }
  function shortDate(iso) { return asDate(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }); }
  function norm(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function tkey(s) { return norm(String(s).split(" - ")[0]).replace(/[^a-z0-9]/g, ""); }
  function lev1(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, diff = 0;
    while (i < la && j < lb) { if (a[i] === b[j]) { i++; j++; continue; } if (++diff > 1) return false; if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } }
    return diff + (la - i) + (lb - j) <= 1;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function stepOf(s) { return s < 1e6 ? 1e5 : s < 1e7 ? 1e6 : s < 1e8 ? 1e7 : s < 1e9 ? 5e7 : 1e9; }
  function nextStep(s) { var st = stepOf(s); return (Math.floor(s / st) + 1) * st; }
  function inDays(gap, perDay) { return perDay > 0 ? Math.ceil(gap / perDay) : Infinity; }
  function daysLabel(n) { if (!isFinite(n)) return "—"; if (n > 3650) return "plus de 10 ans"; if (n > 730) return Math.round(n / 365) + " ans"; return n + (n > 1 ? " jours" : " jour"); }
  function addDays(iso, n) { var d = asDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dur(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function durLong(ms) { var m = Math.round(ms / 60000); return m >= 60 ? Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") : m + " min"; }
  function took(r, d) {
    if (!r || !d) return "";
    var a = asDate(r), b = asDate(d);
    var m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
    if (m < 1) return "moins d'un mois";
    var y = Math.floor(m / 12), mm = m % 12;
    return (y ? y + (y > 1 ? " ans" : " an") : "") + (y && mm ? " " : "") + (mm ? mm + " mois" : "");
  }
  function pct(v, d) { return (v * 100).toLocaleString("fr-FR", { maximumFractionDigits: d == null ? 1 : d }) + " %"; }
  var NS = "http://www.w3.org/2000/svg";
  function sv(name, attrs, parent) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  var seedRnd = function (seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; };
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }

  /* ================= model ================= */
  var T = D.totals;
  var tracks = D.tracks.slice().sort(function (a, b) { return b.s - a.s; });
  tracks.forEach(function (t, i) { t.rank = i + 1; t.key = tkey(t.t); t.name = t.t.split(" - ")[0]; t.projects = []; t.certs = []; t.route = t.i || ("r" + t.rank); });
  var maxS = tracks[0].s;
  var byId = {}, byKey = {};
  tracks.forEach(function (t) { if (t.i) byId[t.i] = t; if (!byKey[t.key]) byKey[t.key] = t; });
  function findTrack(id, title) {
    if (id && byId[id]) return byId[id];
    var k = tkey(title); if (byKey[k]) return byKey[k];
    for (var i = 0; i < tracks.length; i++) if (lev1(tracks[i].key, k)) return tracks[i];
    return null;
  }

  var LV = { "Or": 1, "Double Or": 2, "Platine": 3, "Double Platine": 4, "Triple Platine": 5, "Diamant": 6, "Double Diamant": 7, "Triple Diamant": 8, "Quadruple Diamant": 9 };
  function family(n) { return /diamant/i.test(n) ? "diamant" : /platine/i.test(n) ? "platine" : "or"; }
  function medalLabel(n) { var m = n.match(/^(Double|Triple|Quadruple) (.+)$/); return m ? m[2] + " ×" + { Double: 2, Triple: 3, Quadruple: 4 }[m[1]] : n; }
  function medal(n) { return el("span", "medal m-" + family(n), medalLabel(n)); }
  var certs = (C.certs || []).slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
  function isNew(c) { return !!(c.seen && C.checked && (asDate(C.checked) - asDate(c.seen)) / 864e5 <= 7); }
  certs.forEach(function (c) {
    c.key = tkey(c.t);
    if (c.c === "Singles") { var t = findTrack(null, c.t); if (t) { c.track = t; t.certs.push(c); } }
  });
  tracks.forEach(function (t) { t.certs.sort(function (a, b) { return a.d < b.d ? -1 : 1; }); t.best = t.certs.reduce(function (b, c) { return !b || (LV[c.n] || 0) > (LV[b.n] || 0) ? c : b; }, null); t.fam = t.best ? family(t.best.n) : "none"; });

  var projects = (A.projects || []).map(function (p) {
    var o = { slug: p.slug, t: p.t, spotify: p.spotify, editions: p.editions, s: p.s, d: p.d, raw: p.tracks || [], key: tkey(p.t) };
    o.items = o.raw.map(function (rt) { return { rt: rt, track: findTrack(rt.i, rt.t) }; });
    o.ms = o.raw.reduce(function (a, rt) { return a + (rt.ms || 0); }, 0);
    o.certs = certs.filter(function (c) { return c.c === "Albums" && c.key === o.key; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    o.best = o.certs.reduce(function (b, c) { return !b || (LV[c.n] || 0) > (LV[b.n] || 0) ? c : b; }, null);
    var trackDates = o.items.map(function (it) { return it.track && it.track.certs[0] ? it.track.certs[0].r : null; }).filter(Boolean).sort();
    o.date = o.certs.length ? o.certs[0].r : (trackDates[0] || "");
    o.dateSrc = o.certs.length ? "snep" : "titres";
    o.lastTrackDate = trackDates[trackDates.length - 1] || o.date;
    o.year = o.date ? o.date.slice(0, 4) : "—";
    var seen = {};
    o.uniq = [];
    o.items.forEach(function (it) { if (it.track && !seen[it.track.rank]) { seen[it.track.rank] = 1; o.uniq.push(it.track); } });
    o.trackStreams = o.uniq.reduce(function (a, t) { return a + t.s; }, 0);
    o.fam = o.best ? family(o.best.n) : (o.uniq.some(function (t) { return t.fam === "diamant"; }) ? "diamant" : "or");
    return o;
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.lastTrackDate < b.lastTrackDate ? -1 : 1); });
  projects.forEach(function (p, i) {
    p.idx = i;
    p.uniq.forEach(function (t) { if (t.projects.indexOf(p) < 0) t.projects.push(p); });
  });
  tracks.forEach(function (t) { t.origin = t.projects[0] || null; });
  var bySlug = {}; projects.forEach(function (p) { bySlug[p.slug] = p; });
  var byRoute = {}; tracks.forEach(function (t) { byRoute[t.route] = t; });

  /* ================= original artworks (guilloché) ================= */
  var TONES = {
    or: ["rgba(245,213,139,", "rgba(214,174,96,", "rgba(138,100,36,"],
    platine: ["rgba(255,255,255,", "rgba(216,220,226,", "rgba(176,138,70,"],
    diamant: ["rgba(233,247,255,", "rgba(191,231,255,", "rgba(214,174,96,"]
  };
  var artCache = {};
  function artwork(p) {
    if (artCache[p.slug]) return artCache[p.slug];
    var S = 720, cv = document.createElement("canvas"); cv.width = cv.height = S;
    var g = cv.getContext("2d"), rnd = seedRnd(hash(p.slug) + 11), tone = TONES[p.fam] || TONES.or, cx = S / 2, cy = S / 2;
    var bg = g.createRadialGradient(cx, cy * .9, 10, cx, cy, S * .75);
    bg.addColorStop(0, ["#221b12", "#141820", "#22130f", "#131a16", "#1c1219", "#1d1a14"][p.idx % 6]); bg.addColorStop(.6, "#0e0c09"); bg.addColorStop(1, "#050403");
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    var img = g.getImageData(0, 0, S, S), px = img.data;
    for (var q = 0; q < px.length; q += 4) { var n = (rnd() - .5) * 18; px[q] += n; px[q + 1] += n; px[q + 2] += n; }
    g.putImageData(img, 0, 0);
    g.lineCap = "round";
    function line(a, w) { g.strokeStyle = tone[a[0]] + a[1] + ")"; g.lineWidth = w; }
    var kind = p.idx % 6, i, t, r;
    g.save(); g.beginPath(); g.rect(36, 36, S - 72, S - 72); g.clip();
    if (kind === 0) {
      for (i = 0; i < 50; i++) { var R = 30 + i * 6.4; line([i % 4 === 0 ? 2 : i % 2 ? 1 : 0, .7 - i * .006], i % 4 === 0 ? 1.3 : .8); g.beginPath(); for (t = 0; t <= 361; t++) { var th = t / 180 * Math.PI; r = R + 7 * Math.sin(12 * th + i * .16); g.lineTo(cx + Math.cos(th) * r, cy + Math.sin(th) * r); } g.stroke(); }
    } else if (kind === 1) {
      for (var y = 40; y < S - 30; y += 9) { line([y % 3 < 1 ? 0 : 1, .45], .7); g.beginPath(); for (var x = 30; x <= S - 30; x += 4) g.lineTo(x, y + 9 * Math.sin(x / 26 + y / 37) + 4 * Math.sin(x / 9)); g.stroke(); }
      g.fillStyle = "rgba(8,7,5,.94)"; g.beginPath(); g.arc(cx, cy, 190, 0, Math.PI * 2); g.fill();
      for (i = 0; i < 40; i++) { line([1, .6], .7); g.beginPath(); g.arc(cx, cy, 30 + i * 4, 0, Math.PI * 2); g.stroke(); }
    } else if (kind === 2) {
      for (t = 0; t < 360; t += 2.5) { var a2 = t / 180 * Math.PI, r2 = 320 + 22 * Math.sin(t / 180 * Math.PI * 9); line([t % 15 === 0 ? 0 : 2, .55], t % 15 === 0 ? 1.4 : .7); g.beginPath(); g.moveTo(cx + Math.cos(a2) * 70, cy + Math.sin(a2) * 70); g.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2); g.stroke(); }
      for (i = 0; i < 8; i++) { line([0, .8], 1.2); g.beginPath(); g.arc(cx, cy, 70 + i * 34, 0, Math.PI * 2); g.stroke(); }
    } else if (kind === 3) {
      for (i = 0; i < 46; i++) { var s3 = 20 + i * 13.5; line([i % 4 === 0 ? 0 : 1, .5], .7); g.save(); g.translate(cx, cy); g.rotate(i * 2.4 * Math.PI / 180); g.strokeRect(-s3 / 2, -s3 / 2, s3, s3); g.restore(); }
    } else if (kind === 4) {
      for (var arm = 0; arm < 18; arm++) { line([arm % 3 === 0 ? 0 : 1, .6], .9); g.beginPath(); for (t = 0; t < 520; t++) { var th4 = t / 60 + arm / 18 * Math.PI * 2; r = 18 + t * .62; g.lineTo(cx + Math.cos(th4) * r, cy + Math.sin(th4) * r); } g.stroke(); }
      for (arm = 0; arm < 18; arm++) { line([2, .5], .7); g.beginPath(); for (t = 0; t < 520; t++) { var th5 = -t / 60 + arm / 18 * Math.PI * 2; r = 18 + t * .62; g.lineTo(cx + Math.cos(th5) * r, cy + Math.sin(th5) * r); } g.stroke(); }
    } else {
      var rings = [0, 70, 150, 240, 330], k = 16;
      for (var ri = 1; ri < rings.length; ri++) {
        for (var v = 0; v < k; v++) {
          var a0 = (v + (ri % 2) * .5) / k * Math.PI * 2, a1 = (v + 1 + (ri % 2) * .5) / k * Math.PI * 2, ai = (v + ((ri + 1) % 2) * .5) / k * Math.PI * 2;
          var P0 = [cx + Math.cos(a0) * rings[ri], cy + Math.sin(a0) * rings[ri]], P1 = [cx + Math.cos(a1) * rings[ri], cy + Math.sin(a1) * rings[ri]], Pi = [cx + Math.cos(ai) * rings[ri - 1], cy + Math.sin(ai) * rings[ri - 1]];
          line([ri % 2, .75], 1); g.beginPath(); g.moveTo(P0[0], P0[1]); g.lineTo(P1[0], P1[1]); g.lineTo(Pi[0], Pi[1]); g.closePath(); g.stroke();
          line([2, .35], .5); for (var h = 1; h < 6; h++) { g.beginPath(); g.moveTo(Pi[0] + (P0[0] - Pi[0]) * h / 6, Pi[1] + (P0[1] - Pi[1]) * h / 6); g.lineTo(Pi[0] + (P1[0] - Pi[0]) * h / 6, Pi[1] + (P1[1] - Pi[1]) * h / 6); g.stroke(); }
        }
      }
    }
    g.restore();
    if (p.fam === "diamant") {
      var pr = g.createLinearGradient(0, 0, S, S);
      pr.addColorStop(0, "rgba(191,231,255,.10)"); pr.addColorStop(.5, "rgba(240,220,255,.06)"); pr.addColorStop(1, "rgba(255,242,200,.10)");
      g.globalCompositeOperation = "screen"; g.fillStyle = pr; g.fillRect(0, 0, S, S); g.globalCompositeOperation = "source-over";
    }
    g.fillStyle = "rgba(6,5,4,.92)"; g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill();
    line([0, .95], 1.4); g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.stroke();
    line([1, .7], .8); g.beginPath(); g.arc(cx, cy, 27, 0, Math.PI * 2); g.stroke();
    for (i = 0; i < 24; i++) { var ad = i / 24 * Math.PI * 2; g.fillStyle = tone[0] + ".8)"; g.beginPath(); g.arc(cx + Math.cos(ad) * 20, cy + Math.sin(ad) * 20, 1.1, 0, Math.PI * 2); g.fill(); }
    line([1, .55], 1); g.strokeRect(20.5, 20.5, S - 41, S - 41);
    line([2, .45], 1); g.strokeRect(28.5, 28.5, S - 57, S - 57);
    var vg = g.createRadialGradient(cx, cy, S * .35, cx, cy, S * .78);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = vg; g.fillRect(0, 0, S, S);
    artCache[p.slug] = cv.toDataURL("image/jpeg", .9);
    return artCache[p.slug];
  }

  /* ================= live counter ================= */
  var dayEnd = asDate(D.updated).getTime() + 12 * 3600e3;
  function estimate() { return T.s + T.d * Math.max(0, (Date.now() - dayEnd) / 1000) / 86400; }
  var counters = [$("t-counter"), $("n-counter")], lastC = "";
  function tick() { var txt = fmt(estimate()); if (txt === lastC) return; lastC = txt; counters.forEach(function (c) { if (c) c.textContent = txt; }); }
  tick(); setInterval(tick, REDUCED ? 5000 : 110);
  var goal = (Math.floor(T.s / 1e9) + 1) * 1e9, goalProg = (T.s - (goal - 1e9)) / 1e9, goalDays = inDays(goal - T.s, T.d);

  /* ================= navigation between worlds ================= */
  var WORLDS = ["trident", "archive", "numbers", "legacy", "vault"];
  var NAMES = { trident: "The Trident", archive: "The Archive", numbers: "The Numbers", legacy: "The Legacy", vault: "The Vault" };
  function go(w) {
    if (room.classList.contains("open")) closeRoom(true);
    var target = $(w); if (!target) return;
    target.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
    if (history.replaceState) history.replaceState(null, "", "#" + w);
  }
  document.querySelectorAll("[data-go]").forEach(function (b) {
    b.addEventListener("click", function () { go(b.dataset.go); });
    b.addEventListener("mouseenter", function () { if (window.WN_SCENE) window.WN_SCENE.highlight(b.dataset.go); });
    b.addEventListener("mouseleave", function () { if (window.WN_SCENE) window.WN_SCENE.highlight(null); });
  });
  $("rail").querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); go(a.dataset.w); }); });
  document.querySelector(".mark").addEventListener("click", function (e) { e.preventDefault(); go("trident"); });
  document.querySelector(".cue").addEventListener("click", function (e) { e.preventDefault(); go("archive"); });

  var worldEls = WORLDS.map($), gates = [].slice.call(document.querySelectorAll(".gate")), railLinks = [].slice.call($("rail").querySelectorAll("a"));
  var styleMemo = new WeakMap();
  function setVar(node, name, v) {
    var m = styleMemo.get(node); if (!m) { m = {}; styleMemo.set(node, m); }
    var s = v.toFixed(3); if (m[name] === s) return; m[name] = s; node.style.setProperty(name, s);
  }
  var active = "trident", ticking = false;
  function frame() {
    ticking = false;
    var vh = window.innerHeight, y = window.scrollY, docH = document.documentElement.scrollHeight;
    var current = "trident";
    worldEls.forEach(function (w, i) {
      var r = w.getBoundingClientRect();
      if (i < worldEls.length - 1) setVar(w, "--exit", REDUCED ? 0 : (r.bottom < vh ? smooth(clamp((vh - r.bottom) / (vh * .9), 0, 1)) : 0));
      if (r.top <= vh * .5 && r.bottom > vh * .5) current = w.id;
    });
    gates.forEach(function (g) {
      var r = g.getBoundingClientRect(), span = Math.max(1, r.height - vh), p = clamp(-r.top / span, 0, 1);
      if (r.top <= vh * .5 && r.bottom > vh * .5) current = p > .55 ? g.dataset.to : WORLDS[WORLDS.indexOf(g.dataset.to) - 1];
      if (REDUCED) { setVar(g, "--title", 1); setVar(g, "--line", 1); setVar(g, "--open", p > .6 ? 1 : 0); return; }
      if (r.bottom < 0 || r.top > vh) return;
      setVar(g, "--title", smooth(clamp(p / .38, 0, 1)));
      setVar(g, "--line", smooth(clamp((p - .08) / .34, 0, 1)));
      setVar(g, "--open", smooth(clamp((p - .6) / .36, 0, 1)));
    });
    setVar($("rail"), "--prog", clamp(y / Math.max(1, docH - vh), 0, 1));
    if (current !== active) {
      active = current;
      railLinks.forEach(function (a) { a.setAttribute("aria-current", String(a.dataset.w === active)); });
      $("rail-count").textContent = "0" + (WORLDS.indexOf(active) + 1) + " / 05";
    }
    window.WN_TRIDENT_VISIBLE = $("trident").getBoundingClientRect().bottom > 0;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  railLinks[0].setAttribute("aria-current", "true");
  frame();

  /* ================= 02 Archive ================= */
  (function archive() {
    var gal = $("gallery");
    if (!projects.length) { gal.appendChild(el("p", "vempty", "Les projets n'ont pas pu être chargés. Rechargez la page dans un instant.")); return; }
    $("archive-sub").textContent = projects.length + " projets, de " + projects[0].t + " à " + projects[projects.length - 1].t + ". Touchez une œuvre pour entrer dans le projet.";
    projects.forEach(function (p, i) {
      var b = el("button", "work"); b.type = "button"; b.setAttribute("aria-label", p.t + ", " + p.year + ". Ouvrir le projet.");
      var fr = el("div", "frame"); fr.style.setProperty("--delay", (-i * 1.3) + "s");
      var im = new Image(); im.alt = ""; im.decoding = "async"; im.src = artwork(p);
      fr.append(im, el("span", "shadow"));
      var cap = el("div", "cap"), st = el("div", "st");
      var s1 = el("span"); s1.append(el("b", "num", compact(p.s)), " streams");
      st.append(s1, el("span", null, p.raw.length + " titres"));
      if (p.best) st.appendChild(medal(p.best.n));
      cap.append(el("h3", null, p.t), el("span", "yr", p.year), st);
      b.append(fr, cap);
      b.addEventListener("click", function () { openRoute("projet", p.slug); });
      if (!REDUCED) {
        b.addEventListener("pointermove", function (e) {
          if (e.pointerType === "touch") return;
          var r = fr.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y2 = (e.clientY - r.top) / r.height - .5;
          fr.style.transform = "rotateY(" + (x * 16).toFixed(2) + "deg) rotateX(" + (-y2 * 12).toFixed(2) + "deg) translateZ(30px)";
        });
        b.addEventListener("pointerleave", function () { fr.style.transform = ""; });
      }
      gal.appendChild(b);
    });
  })();

  /* ================= 03 Numbers ================= */
  (function numbers() {
    $("numbers-sub").textContent = "Relevé Spotify du " + longDate(D.updated) + ". Tous les chiffres viennent de kworb et du SNEP.";
    var k = $("n-kpis");
    function kpi(v, label, cls) { var d = el("div"); var b = el("b", "num " + (cls || ""), v); d.append(b, el("span", null, label)); k.appendChild(d); return b; }
    kpi("+" + fmt(T.d), "streams en 24 h");
    kpi(fmt(T.s), "chiffre officiel du " + shortDate(D.updated));
    kpi(String(T.n), "titres suivis");
    kpi(compact(T.feat), "en featuring");

    // gauge
    var gauge = $("n-gauge"), size = 150, R = 62;
    var svg = sv("svg", { viewBox: "0 0 150 150", role: "img", "aria-label": pct(goalProg) + " du chemin vers " + goal / 1e9 + " milliards" }, gauge);
    var defs = sv("defs", {}, svg), gg = sv("linearGradient", { id: "gg", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    sv("stop", { offset: "0", "stop-color": "#f5d58b" }, gg); sv("stop", { offset: "1", "stop-color": "#8a6424" }, gg);
    for (var t = 0; t < 60; t++) { var a = t / 60 * Math.PI * 2 - Math.PI / 2; sv("line", { x1: 75 + Math.cos(a) * 70, y1: 75 + Math.sin(a) * 70, x2: 75 + Math.cos(a) * (t % 5 ? 67 : 64), y2: 75 + Math.sin(a) * (t % 5 ? 67 : 64), stroke: "rgba(214,174,96,.35)", "stroke-width": 1 }, svg); }
    sv("circle", { cx: 75, cy: 75, r: R, fill: "none", stroke: "rgba(255,255,255,.06)", "stroke-width": 6 }, svg);
    var C2 = 2 * Math.PI * R;
    var arc = sv("circle", { cx: 75, cy: 75, r: R, fill: "none", stroke: "url(#gg)", "stroke-width": 6, "stroke-linecap": "round", "stroke-dasharray": C2, "stroke-dashoffset": C2, transform: "rotate(-90 75 75)", style: "transition: stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1); filter: drop-shadow(0 0 6px rgba(245,213,139,.6))" }, svg);
    var tx = sv("text", { x: 75, y: 80, "text-anchor": "middle", fill: "#f3ede2", style: "font: 700 22px Archivo, sans-serif" }, svg); tx.textContent = pct(goalProg);
    var gp = el("p"); gp.append(el("b", "num", (goal / 1e9) + " milliards"), "estimés vers le " + longDate(addDays(D.updated, isFinite(goalDays) ? goalDays : 0)) + ", soit dans " + daysLabel(goalDays) + " au rythme actuel.");
    gauge.appendChild(gp);
    onceVisible($("p-gauge"), function () { arc.setAttribute("stroke-dashoffset", String(C2 * (1 - goalProg))); });

    // ranking bars
    var mState = { m: "s", r: "all" };
    function drawBars() {
      var list = tracks.filter(function (t) { return mState.r === "all" || (mState.r === "lead" ? !t.f : t.f); });
      var val = function (t) { return mState.m === "d" ? t.d : t.s; };
      list = list.slice().sort(function (a, b) { return val(b) - val(a); }).slice(0, 12);
      var max = Math.max.apply(null, list.map(val)), box = $("n-bars"); box.textContent = "";
      list.forEach(function (t, i) {
        var b = el("button", "bar"); b.type = "button";
        var tr = el("span", "tr"), fill = el("i"); tr.appendChild(fill);
        var v = mState.m === "d" ? "+" + fmt(t.d) : mState.m === "share" ? pct(t.s / T.s, 2) : fmt(t.s);
        b.append(el("span", "r num", String(i + 1)), el("span", "n", t.name + (t.f ? " (feat.)" : "")), tr, el("span", "v num", v));
        b.setAttribute("aria-label", t.name + ", " + v + ". Ouvrir la fiche.");
        b.addEventListener("click", function () { openRoute("titre", t.route); });
        box.appendChild(b);
        requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = (val(t) / max * 100).toFixed(1) + "%"; }); });
      });
      document.querySelectorAll("[data-m]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.m === mState.m)); });
      document.querySelectorAll("[data-r]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.r === mState.r)); });
    }
    document.querySelectorAll("[data-m]").forEach(function (x) { x.addEventListener("click", function () { mState.m = x.dataset.m; drawBars(); }); });
    document.querySelectorAll("[data-r]").forEach(function (x) { x.addEventListener("click", function () { mState.r = x.dataset.r; drawBars(); }); });
    onceVisible($("p-rank"), drawBars);

    // donut by project of origin
    (function donut() {
      var box = $("n-donut"), COLORS = ["#f5d58b", "#d6ae60", "#8a6424", "#d8dce2", "#bfe7ff", "#b5524a", "#6f6656"];
      var parts = projects.map(function (p, i) { return { label: p.t, p: p, v: tracks.filter(function (t) { return t.origin === p; }).reduce(function (a, t) { return a + t.s; }, 0), c: COLORS[i % 6] }; });
      var rest = tracks.filter(function (t) { return !t.origin; }).reduce(function (a, t) { return a + t.s; }, 0);
      if (rest) parts.push({ label: "Hors projet (singles, featurings)", v: rest, c: COLORS[6] });
      var total = parts.reduce(function (a, x) { return a + x.v; }, 0);
      var svg2 = sv("svg", { viewBox: "0 0 190 190", width: 190, height: 190, role: "img", "aria-label": "Répartition des streams par projet" }, box);
      var ul = el("ul", "legend"); box.appendChild(ul);
      var tip = el("div", "ttip"); box.style.position = "relative"; box.appendChild(tip);
      var a0 = -Math.PI / 2, paths = [], items = [];
      parts.forEach(function (x, i) {
        var a1 = a0 + x.v / total * Math.PI * 2, ro = 92, ri = 58, large = a1 - a0 > Math.PI ? 1 : 0;
        var d = "M" + (95 + Math.cos(a0) * ro) + " " + (95 + Math.sin(a0) * ro) + " A" + ro + " " + ro + " 0 " + large + " 1 " + (95 + Math.cos(a1) * ro) + " " + (95 + Math.sin(a1) * ro) +
          " L" + (95 + Math.cos(a1) * ri) + " " + (95 + Math.sin(a1) * ri) + " A" + ri + " " + ri + " 0 " + large + " 0 " + (95 + Math.cos(a0) * ri) + " " + (95 + Math.sin(a0) * ri) + " Z";
        var path = sv("path", { d: d, fill: x.c, stroke: "#080705", "stroke-width": 1.5, tabindex: 0, "aria-label": x.label + " : " + pct(x.v / total) }, svg2);
        var li = el("li"), b = el("button"); b.type = "button";
        var ic = el("i"); ic.style.background = x.c;
        b.append(ic, el("span", "t", x.label), el("span", "v", pct(x.v / total) + ", " + compact(x.v)));
        li.appendChild(b); ul.appendChild(li);
        function on(e) {
          paths.forEach(function (pp, j) { pp.classList.toggle("dim", j !== i); pp.classList.toggle("hl", j === i); });
          items.forEach(function (it, j) { it.classList.toggle("hl", j === i); });
          tip.textContent = ""; tip.append(el("b", null, x.label), document.createTextNode(fmt(x.v) + " streams, " + pct(x.v / total)));
          var r = box.getBoundingClientRect(), pr = path.getBoundingClientRect();
          tip.style.left = (pr.left - r.left + pr.width / 2) + "px"; tip.style.top = (pr.top - r.top + pr.height / 2) + "px";
          tip.classList.add("on");
        }
        function off() { paths.forEach(function (pp) { pp.classList.remove("dim", "hl"); }); items.forEach(function (it) { it.classList.remove("hl"); }); tip.classList.remove("on"); }
        function open() { if (x.p) openRoute("projet", x.p.slug); else { go("vault"); setVaultProject("none"); } }
        [path, b].forEach(function (n) { n.addEventListener("mouseenter", on); n.addEventListener("focus", on); n.addEventListener("mouseleave", off); n.addEventListener("blur", off); n.addEventListener("click", open); });
        paths.push(path); items.push(b); a0 = a1;
      });
    })();

    // milestones
    (function miles() {
      var list = tracks.filter(function (t) { return t.d > 0; }).map(function (t) { var st = nextStep(t.s); return { t: t, st: st, days: inDays(st - t.s, t.d), prog: (t.s - (st - stepOf(t.s))) / stepOf(t.s) }; })
        .sort(function (a, b) { return a.days - b.days; }).slice(0, 7);
      var ul = $("n-miles");
      list.forEach(function (x) {
        var li = el("li"), b = el("button"); b.type = "button";
        var p = el("span", "p"), i = el("i"); i.style.width = (x.prog * 100).toFixed(1) + "%"; p.appendChild(i);
        b.append(el("span", "t", x.t.name), el("span", "d", daysLabel(x.days)), p, el("span", "s", compact(x.st) + " streams, vers le " + longDate(addDays(D.updated, x.days)) + " (" + fmt(x.st - x.t.s) + " à faire)"));
        b.addEventListener("click", function () { openRoute("titre", x.t.route); });
        li.appendChild(b); ul.appendChild(li);
      });
    })();

    // history
    var Hs = (D.history || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    $("n-hist-sub").textContent = Hs.length + (Hs.length > 1 ? " relevés depuis le " + longDate(Hs[0].date) + ". La courbe s'allonge à chaque mise à jour." : " relevé.");
    function drawHist() {
      var box = $("n-hist"), old = box.querySelector("svg"); if (old) old.remove();
      if (!Hs.length) return;
      var W = Math.max(280, box.clientWidth), H = 240, pl = 6, pr = 6, pt = 30, pb = 26;
      var s = sv("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Évolution des streams cumulés" });
      var df = sv("defs", {}, s), ga = sv("linearGradient", { id: "ha", x1: 0, y1: 0, x2: 0, y2: 1 }, df);
      sv("stop", { offset: "0", "stop-color": "#d6ae60", "stop-opacity": ".35" }, ga); sv("stop", { offset: "1", "stop-color": "#d6ae60", "stop-opacity": "0" }, ga);
      var t0 = asDate(Hs[0].date).getTime(), t1 = asDate(Hs[Hs.length - 1].date).getTime();
      var vals = Hs.map(function (h) { return h.s; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = Math.max((hi - lo) * .15, hi * .0005); lo -= pad; hi += pad;
      var X = function (d) { return t1 === t0 ? W / 2 : pl + (asDate(d).getTime() - t0) / (t1 - t0) * (W - pl - pr); };
      var Y = function (v) { return pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb); };
      for (var g = 0; g <= 3; g++) { var gy = pt + g * (H - pt - pb) / 3; sv("line", { x1: pl, x2: W - pr, y1: gy, y2: gy, stroke: "rgba(214,174,96,.12)" }, s); }
      if (Hs.length > 1) {
        var dl = Hs.map(function (h, i) { return (i ? "L" : "M") + X(h.date).toFixed(1) + " " + Y(h.s).toFixed(1); }).join(" ");
        sv("path", { d: dl + " L" + X(Hs[Hs.length - 1].date) + " " + (H - pb) + " L" + X(Hs[0].date) + " " + (H - pb) + " Z", fill: "url(#ha)" }, s);
        sv("path", { d: dl, fill: "none", stroke: "#f5d58b", "stroke-width": 2, style: "filter:drop-shadow(0 0 6px rgba(245,213,139,.6))" }, s);
      }
      var tip = $("n-hist-tip");
      Hs.forEach(function (h, i) {
        var last = i === Hs.length - 1;
        var c = sv("circle", { cx: X(h.date), cy: Y(h.s), r: last ? 5 : 3.5, fill: last ? "#f5d58b" : "#080705", stroke: "#f5d58b", "stroke-width": 1.5, tabindex: 0, "aria-label": shortDate(h.date) + " : " + fmt(h.s) }, s);
        var hit = sv("circle", { cx: X(h.date), cy: Y(h.s), r: 16, fill: "transparent" }, s);
        function on() { tip.textContent = ""; tip.append(el("b", null, longDate(h.date)), document.createTextNode(fmt(h.s) + " streams")); var sc = box.clientWidth / W; tip.style.left = clamp(X(h.date) * sc, 80, box.clientWidth - 80) + "px"; tip.style.top = (Y(h.s) * sc) + "px"; tip.classList.add("on"); }
        function off() { tip.classList.remove("on"); }
        [c, hit].forEach(function (n) { n.addEventListener("mouseenter", on); n.addEventListener("mouseleave", off); n.addEventListener("focus", on); n.addEventListener("blur", off); n.addEventListener("touchstart", on, { passive: true }); });
      });
      var a0 = sv("text", { x: pl, y: H - 6, class: "ax" }, s); a0.textContent = shortDate(Hs[0].date);
      if (Hs.length > 1) { var a1 = sv("text", { x: W - pr, y: H - 6, "text-anchor": "end", class: "ax" }, s); a1.textContent = shortDate(Hs[Hs.length - 1].date); }
      var lb = sv("text", { x: X(Hs[Hs.length - 1].date), y: Y(Hs[Hs.length - 1].s) - 12, "text-anchor": Hs.length > 1 ? "end" : "middle", fill: "#f3ede2", style: "font: 700 12px Archivo, sans-serif" }, s); lb.textContent = compact(Hs[Hs.length - 1].s);
      box.insertBefore(s, tip);
    }
    drawHist();
    var rh; window.addEventListener("resize", function () { clearTimeout(rh); rh = setTimeout(drawHist, 150); });

    // face-to-face
    (function cmp() {
      var A1 = $("cmp-a"), B1 = $("cmp-b");
      tracks.forEach(function (t) { [A1, B1].forEach(function (s) { var o = el("option", null, "n° " + t.rank + "  " + t.name + (t.f ? " (feat.)" : "")); o.value = t.route; s.appendChild(o); }); });
      A1.value = tracks[0].route; B1.value = tracks[1].route;
      function draw() {
        var a = byRoute[A1.value], b = byRoute[B1.value], box = $("n-cmp"); box.textContent = "";
        var rows = [
          ["Streams", a.s, b.s, fmt, false],
          ["Écoutes en 24 h", a.d, b.d, function (v) { return "+" + fmt(v); }, false],
          ["Rang", a.rank, b.rank, function (v) { return "n° " + v; }, true],
          ["Part du total", a.s / T.s, b.s / T.s, function (v) { return pct(v, 2); }, false],
          ["Prochain palier dans", inDays(nextStep(a.s) - a.s, a.d), inDays(nextStep(b.s) - b.s, b.d), daysLabel, true],
          ["Certification", a.best ? LV[a.best.n] : 0, b.best ? LV[b.best.n] : 0, null, false]
        ];
        rows.forEach(function (r) {
          var row = el("div", "row"), max = Math.max(r[1], r[2]) || 1;
          function side(v, cls, t, other) {
            var s = el("div", "side " + cls), win = r[4] ? v < other : v > other;
            if (win) s.classList.add("win");
            if (r[0] === "Certification") { if (t.best) s.appendChild(medal(t.best.n)); else s.appendChild(el("b", null, "Aucune")); }
            else s.appendChild(el("b", null, r[3](v)));
            var tr = el("span", "tr"), i = el("i"), ratio = r[4] ? (isFinite(v) ? Math.min(r[1], r[2]) / v : 0) : v / max;
            i.style.width = (clamp(ratio, 0, 1) * 100).toFixed(1) + "%"; tr.appendChild(i); s.appendChild(tr);
            return s;
          }
          row.append(side(r[1], "a", a, r[2]), el("span", "k", r[0]), side(r[2], "b", b, r[1]));
          box.appendChild(row);
        });
      }
      A1.addEventListener("change", draw); B1.addEventListener("change", draw);
      draw();
    })();
  })();

  /* ================= 04 Legacy ================= */
  var drawer = $("drawer");
  (function legacy() {
    var fams = [["diamant", "Diamant"], ["platine", "Platine"], ["or", "Or"]];
    $("legacy-sub").textContent = certs.length + " certifications SNEP, de la première le " + longDate(certs.length ? certs[certs.length - 1].d : "") + " à la dernière le " + longDate(certs.length ? certs[0].d : "") + ". Choisissez une récompense pour lire son cartel.";
    var cart = $("cartels");
    fams.forEach(function (f) {
      var list = certs.filter(function (c) { return family(c.n) === f[0]; }), s = list.filter(function (c) { return c.c === "Singles"; }).length;
      var d = el("div"); d.append(el("span", "k m-" + f[0], f[1]), el("b", "num", String(list.length)), el("span", "s", s + " singles" + (list.length - s ? ", " + (list.length - s) + " albums" : "")));
      cart.appendChild(d);
    });
    var lstate = { c: "all", o: "recent" }, selected = null;
    function name(c) { if (c.c === "Albums") { var p = projects.filter(function (x) { return x.key === c.key; })[0]; return p ? p.t : c.t; } return c.track ? c.track.name : c.t.charAt(0) + c.t.slice(1).toLowerCase(); }
    function draw() {
      var mus = $("museum"); mus.textContent = "";
      fams.forEach(function (f) {
        var list = certs.filter(function (c) { return family(c.n) === f[0] && (lstate.c === "all" || c.c === lstate.c); });
        if (lstate.o === "old") list = list.slice().reverse();
        if (!list.length) return;
        var lev = el("div", "level"), h = el("h3", null, f[1]); h.appendChild(el("span", null, list.length + " récompense" + (list.length > 1 ? "s" : "")));
        var cor = el("div", "corridor"), wall = el("div", "wall");
        list.forEach(function (c) {
          var b = el("button", "plaque p-" + f[0] + (c.c === "Albums" ? " lp" : "")); b.type = "button";
          var fr = el("div", "pframe"), mat = el("div", "pmat"), disc = el("div", "disc"), plate = el("div", "plate", medalLabel(c.n) + " " + c.d.slice(0, 4));
          mat.append(disc, plate); fr.appendChild(mat);
          var cap = el("div", "pcap"); cap.append(el("b", null, name(c)), el("span", null, (c.c === "Albums" ? "Album, " : "") + longDate(c.d)));
          b.append(fr, cap);
          b.setAttribute("aria-label", name(c) + ", " + medalLabel(c.n) + " le " + longDate(c.d) + ". Lire le cartel.");
          b.addEventListener("click", function () { if (selected) selected.classList.remove("sel"); selected = b; b.classList.add("sel"); openDrawer(c, f[0]); });
          wall.appendChild(b);
        });
        cor.appendChild(wall); lev.append(h, cor); mus.appendChild(lev);
      });
      document.querySelectorAll("[data-lc]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.lc === lstate.c)); });
      document.querySelectorAll("[data-lo]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.lo === lstate.o)); });
    }
    document.querySelectorAll("[data-lc]").forEach(function (x) { x.addEventListener("click", function () { lstate.c = x.dataset.lc; draw(); }); });
    document.querySelectorAll("[data-lo]").forEach(function (x) { x.addEventListener("click", function () { lstate.o = x.dataset.lo; draw(); }); });
    draw();
    var mus = $("museum");
    mus.addEventListener("pointermove", function (e) { var r = mus.getBoundingClientRect(); mus.style.setProperty("--lx", (e.clientX - r.left) + "px"); mus.style.setProperty("--ly", (e.clientY - r.top) + "px"); });
    function openDrawer(c, fam) {
      var body = $("drawer-body"); body.textContent = "";
      var dd = el("div", "plaque p-" + fam + " bigdisc"); dd.style.transform = "none"; dd.style.width = "160px";
      var fr = el("div", "pframe"), mat = el("div", "pmat"); mat.append(el("div", "disc"), el("div", "plate", medalLabel(c.n))); fr.appendChild(mat); dd.appendChild(fr);
      body.append(dd, el("span", "kick", "Certification SNEP"), el("h4", null, name(c)), el("p", "who", c.a));
      var dl = el("dl");
      [["Niveau", medalLabel(c.n)], ["Type", c.c === "Albums" ? "Album" : "Single"], ["Date du constat", longDate(c.d)], ["Date de sortie", longDate(c.r)], ["Obtenu en", took(c.r, c.d) || "—"], ["Labels", c.l]].forEach(function (r) { dl.append(el("dt", null, r[0]), el("dd", null, r[1])); });
      body.appendChild(dl);
      if (c.c === "Albums") { var p = projects.filter(function (x) { return x.key === c.key; })[0]; if (p) { var bp = el("button", "btn", "Entrer dans le projet"); bp.type = "button"; bp.addEventListener("click", function () { closeDrawer(); openRoute("projet", p.slug); }); body.appendChild(bp); } }
      else if (c.track) { var bt = el("button", "btn", "Ouvrir la fiche du titre"); bt.type = "button"; bt.addEventListener("click", function () { closeDrawer(); openRoute("titre", c.track.route); }); body.appendChild(bt); }
      drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); $("drawer-x").focus();
    }
    window.WN_openCertDrawer = openDrawer;
  })();
  function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); var s = document.querySelector(".plaque.sel"); if (s) { s.classList.remove("sel"); s.focus({ preventScroll: true }); } }
  $("drawer-x").addEventListener("click", closeDrawer);

  /* ================= 05 Vault ================= */
  var vstate = { q: "", role: "all", cert: "all", proj: "all", sort: "s", dir: -1 };
  function setVaultProject(v) { vstate.proj = v; $("v-proj").value = v; drawVault(); }
  (function vaultInit() {
    $("vault-sub").textContent = T.n + " titres où Werenoi est en tête d'affiche ou invité. Classés par streams Spotify.";
    var sel = $("v-proj");
    projects.forEach(function (p) { var o = el("option", null, p.t + " (" + p.year + ")"); o.value = p.slug; sel.appendChild(o); });
    var o2 = el("option", null, "Hors projet"); o2.value = "none"; sel.appendChild(o2);
    $("vq").addEventListener("input", function (e) { vstate.q = e.target.value; drawVault(); });
    $("vq").addEventListener("keydown", function (e) { if (e.key === "Escape") { e.target.value = ""; vstate.q = ""; drawVault(); } });
    $("vq-clear").addEventListener("click", function () { $("vq").value = ""; vstate.q = ""; drawVault(); $("vq").focus(); });
    $("v-role").addEventListener("change", function (e) { vstate.role = e.target.value; drawVault(); });
    $("v-cert").addEventListener("change", function (e) { vstate.cert = e.target.value; drawVault(); });
    sel.addEventListener("change", function (e) { vstate.proj = e.target.value; drawVault(); });
    document.querySelectorAll(".vhead [data-sort]").forEach(function (b) {
      b.addEventListener("click", function () { var s = b.dataset.sort; if (vstate.sort === s) vstate.dir = -vstate.dir; else { vstate.sort = s; vstate.dir = (s === "t" || s === "p") ? 1 : -1; } drawVault(); });
    });
  })();
  function drawVault() {
    var q = norm(vstate.q.trim());
    var rows = tracks.filter(function (t) {
      if (vstate.role === "lead" && t.f) return false;
      if (vstate.role === "feat" && !t.f) return false;
      if (vstate.cert !== "all" && t.fam !== vstate.cert) return false;
      if (vstate.proj === "none" && t.projects.length) return false;
      if (vstate.proj !== "all" && vstate.proj !== "none" && !t.projects.some(function (p) { return p.slug === vstate.proj; })) return false;
      return !q || norm(t.t).indexOf(q) !== -1;
    });
    rows.sort(function (a, b) {
      var r;
      if (vstate.sort === "t") r = a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true });
      else if (vstate.sort === "p") r = (a.origin ? a.origin.idx : 99) - (b.origin ? b.origin.idx : 99) || a.rank - b.rank;
      else r = a[vstate.sort] - b[vstate.sort];
      return r * vstate.dir;
    });
    var ol = $("vlist"); ol.textContent = "";
    var frag = document.createDocumentFragment();
    rows.forEach(function (t) {
      var li = el("li"), b = el("button", "vrow"); b.type = "button";
      var rk = el("span", "rk num", String(t.rank));
      if (typeof t.p === "number" && t.p !== t.rank) rk.appendChild(el("span", "mv " + (t.p > t.rank ? "up" : "down"), (t.p > t.rank ? "▲" : "▼") + Math.abs(t.p - t.rank)));
      var tt = el("span", "tt"); tt.appendChild(el("strong", null, t.name));
      if (t.f) tt.appendChild(el("span", "chip", "feat."));
      if (t.best) tt.appendChild(medal(t.best.n));
      if (t.n) tt.appendChild(el("span", "chip new", "nouveau"));
      var nums = el("span", "nums"); nums.append(el("span", "s r", fmt(t.s)), el("span", "d r", "+" + fmt(t.d)));
      b.append(rk, tt, el("span", "pj", t.origin ? t.origin.t : "Hors projet"), nums);
      b.addEventListener("click", function () { openRoute("titre", t.route); });
      li.appendChild(b); frag.appendChild(li);
    });
    ol.appendChild(frag);
    $("vcount").textContent = rows.length + (rows.length > 1 ? " titres" : " titre");
    $("vempty").hidden = rows.length > 0;
    if (!rows.length) $("vempty").textContent = "Aucun titre ne correspond. Effacez la recherche ou changez de filtre.";
    $("vq-clear").hidden = !vstate.q;
    document.querySelectorAll(".vhead [data-sort]").forEach(function (b) { b.setAttribute("aria-sort", b.dataset.sort === vstate.sort ? (vstate.dir < 0 ? "descending" : "ascending") : "none"); });
  }
  drawVault();
  function focusSearch() { go("vault"); setTimeout(function () { $("vq").focus({ preventScroll: true }); }, REDUCED ? 0 : 900); }
  $("seek").addEventListener("click", focusSearch);
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); focusSearch(); }
    if (e.key === "Escape") { if (room.classList.contains("open")) backFromRoom(); else if (drawer.classList.contains("open")) closeDrawer(); }
  });
  if (D.fetched) $("fetched").textContent = "Dernière collecte : " + new Date(D.fetched).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }) + " (heure de Paris).";

  /* ================= rooms: project & track pages ================= */
  var room = $("room"), roomBody = $("room-body"), pushed = 0, lastFocus = null, roomKind = null;
  function openRoute(kind, key) { lastFocus = document.activeElement; pushed++; location.hash = "#/" + kind + "/" + key; }
  function backFromRoom() { if (pushed > 0) { pushed--; history.back(); } else { location.hash = "#" + (roomKind === "projet" ? "archive" : "vault"); } }
  $("room-back").addEventListener("click", backFromRoom);
  function closeRoom(silent) {
    room.classList.remove("open"); document.documentElement.classList.remove("locked"); roomKind = null;
    if (!silent && lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function route() {
    var m = location.hash.match(/^#\/(projet|titre)\/(.+)$/);
    if (!m) { if (room.classList.contains("open")) closeRoom(); var w = location.hash.slice(1); if (WORLDS.indexOf(w) >= 0 && !route.first) { /* anchor handled by browser */ } return; }
    var kind = m[1], key = decodeURIComponent(m[2]);
    roomBody.textContent = "";
    if (kind === "projet" && bySlug[key]) renderProject(bySlug[key]);
    else if (kind === "titre" && byRoute[key]) renderTrack(byRoute[key]);
    else { roomBody.appendChild(el("p", "vempty wrap", "Cette page n'existe pas ou plus.")); }
    roomKind = kind;
    $("room-back-label").textContent = kind === "projet" ? "Retour à la galerie" : "Retour";
    room.scrollTop = 0;
    document.documentElement.classList.add("locked");
    room.classList.remove("open"); void room.offsetWidth; room.classList.add("open");
    setTimeout(function () { room.focus({ preventScroll: true }); }, 50);
  }
  window.addEventListener("hashchange", route);

  function renderProject(p) {
    var w = el("div", "wrap album-room");
    var left = el("div", "ar-art"), tilt = el("div", "tilt"), im = new Image(); im.alt = "Œuvre originale créée pour " + p.t; im.src = artwork(p);
    tilt.appendChild(im); left.appendChild(tilt);
    var sp = el("a", "btn", "Voir le projet sur Spotify"); sp.href = "https://open.spotify.com/album/" + encodeURIComponent(p.spotify); sp.target = "_blank"; sp.rel = "noopener";
    left.append(sp, el("p", "note", "Œuvre originale du site. La pochette officielle est sur Spotify."));
    if (!REDUCED) {
      left.addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; var r = tilt.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; tilt.style.transform = "perspective(1200px) rotateY(" + ((x - .5) * 14).toFixed(2) + "deg) rotateX(" + ((.5 - y) * 10).toFixed(2) + "deg)"; tilt.style.setProperty("--mx", (x * 100) + "%"); tilt.style.setProperty("--my", (y * 100) + "%"); });
      left.addEventListener("pointerleave", function () { tilt.style.transform = ""; });
    }
    var right = el("div");
    right.append(el("span", "kick", "Projet " + (p.idx + 1) + " sur " + projects.length), el("h1", null, p.t));
    var facts = el("div", "facts");
    function fact(v, l) { var d = el("div"); d.append(el("b", "num", v), el("span", null, l)); facts.appendChild(d); }
    fact(p.year, p.dateSrc === "snep" ? "sorti le " + longDate(p.date) : "année de sortie des titres");
    fact(String(p.raw.length), "titres, " + durLong(p.ms));
    fact(compact(p.s), "streams, édition la plus écoutée");
    fact("+" + fmt(p.d), "streams de l'album en 24 h");
    fact(compact(p.trackStreams), "streams cumulés de ses titres");
    fact(String(p.editions), p.editions > 1 ? "éditions sur Spotify" : "édition sur Spotify");
    right.appendChild(facts);
    right.appendChild(el("h2", null, "Certifications"));
    var aw = el("div", "awards");
    if (p.certs.length) p.certs.forEach(function (c) { var a = el("div", "award"); a.append(medal(c.n), el("span", null, "le " + longDate(c.d) + (took(c.r, c.d) ? ", obtenu en " + took(c.r, c.d) : ""))); aw.appendChild(a); });
    else aw.appendChild(el("p", "note", "Pas de certification d'album au SNEP pour ce projet. Ses titres certifiés sont signalés dans la tracklist."));
    var tcert = p.uniq.filter(function (t) { return t.best; }).length;
    right.appendChild(aw);
    right.appendChild(el("h2", null, "Tracklist"));
    right.appendChild(el("p", "note", tcert + " titre" + (tcert > 1 ? "s" : "") + " certifié" + (tcert > 1 ? "s" : "") + " sur " + p.raw.length + ". Cliquez sur un titre pour ouvrir sa fiche."));
    var ol = el("ol", "tracklist");
    p.items.forEach(function (it, i) {
      var li = el("li"), b = el("button", "tk"); b.type = "button";
      var nm = el("span", "nm"), t = it.track;
      nm.appendChild(el("strong", null, it.rt.t));
      var others = (it.rt.a || "").split(/,\s*/).filter(function (x) { return x && !/^werenoi$/i.test(x); });
      if (others.length) nm.appendChild(el("em", null, "avec " + others.join(", ")));
      if (t && t.best) nm.appendChild(medal(t.best.n));
      b.append(el("span", "no num", String(i + 1)), nm, el("span", "du num", dur(it.rt.ms || 0)), el("span", "s num", t ? fmt(t.s) : "—"), el("span", "d num", t ? "+" + fmt(t.d) : ""));
      if (t) b.addEventListener("click", function () { openRoute("titre", t.route); });
      else { b.disabled = true; b.style.cursor = "default"; }
      li.appendChild(b); ol.appendChild(li);
    });
    right.appendChild(ol);
    var pg = el("div", "pager"), prev = projects[p.idx - 1], next = projects[p.idx + 1];
    function pbtn(q, label) { var b = el("button"); b.type = "button"; if (!q) { b.style.visibility = "hidden"; return b; } b.append(el("span", null, label), el("b", null, q.t)); b.addEventListener("click", function () { pushed++; location.hash = "#/projet/" + q.slug; }); return b; }
    pg.append(pbtn(prev, "Projet précédent"), pbtn(next, "Projet suivant"));
    right.appendChild(pg);
    w.append(left, right); roomBody.appendChild(w);
  }

  function renderTrack(t) {
    var w = el("div", "wrap track-room");
    w.appendChild(el("span", "ghost num", String(t.rank)));
    w.appendChild(el("span", "kick", "Titre n° " + t.rank + " sur " + T.n + (t.f ? ", en featuring" : "")));
    w.appendChild(el("h1", null, t.name));
    var credits = [];
    p0: for (var i = 0; i < t.projects.length; i++) { var it = t.projects[i].items.filter(function (x) { return x.track === t; })[0]; if (it && it.rt.a) { credits = it.rt.a.split(/,\s*/); break p0; } }
    if (!credits.length && t.certs.length) credits = [t.certs[t.certs.length - 1].a];
    if (credits.length) w.appendChild(el("p", "who", credits.join(", ")));
    if (t.projects.length) {
      var fr = el("div", "from");
      t.projects.forEach(function (p) { var b = el("button", "linkchip", p.t + " (" + p.year + ")"); b.type = "button"; b.addEventListener("click", function () { pushed++; location.hash = "#/projet/" + p.slug; }); fr.appendChild(b); });
      w.appendChild(fr);
    }
    var grid = el("div", "track-grid"), L = el("div"), R = el("div");
    var facts = el("div", "facts");
    function fact(v, l) { var d = el("div"); d.append(el("b", "num", v), el("span", null, l)); facts.appendChild(d); }
    fact(fmt(t.s), "streams Spotify");
    fact("+" + fmt(t.d), "streams en 24 h");
    fact(pct(t.s / T.s, 2), "des streams de Werenoi");
    var mv = typeof t.p === "number" ? t.p - t.rank : null;
    fact(mv == null ? "n° " + t.rank : (mv > 0 ? "▲ " + mv : mv < 0 ? "▼ " + (-mv) : "="), mv == null ? "rang au cumul" : "places depuis le relevé précédent");
    fact(fmt(t.d * 30), "streams sur 30 jours à ce rythme");
    fact(t.projects.length ? String(t.projects.length) : "—", t.projects.length > 1 ? "projets le contiennent" : t.projects.length ? "projet le contient" : "hors projet");
    L.appendChild(facts);
    var st = nextStep(t.s), prev = st - stepOf(t.s), days = inDays(st - t.s, t.d);
    var ms = el("div", "milestone"); ms.appendChild(el("h2", null, "Prochain palier"));
    var line = el("div", "line"), li2 = el("i"); li2.style.width = ((t.s - prev) / (st - prev) * 100).toFixed(1) + "%"; line.appendChild(li2);
    var pp = el("p"); pp.append(el("b", null, compact(st) + " streams"), " dans " + daysLabel(days) + (isFinite(days) ? ", vers le " + longDate(addDays(D.updated, days)) : "") + ". Encore " + fmt(st - t.s) + " streams.");
    ms.append(line, pp); L.appendChild(ms);
    var sp = el("a", "btn", "Écouter sur Spotify"); sp.style.marginTop = "34px";
    sp.href = t.i ? "https://open.spotify.com/track/" + encodeURIComponent(t.i) : "https://open.spotify.com/search/" + encodeURIComponent(t.name + " Werenoi");
    sp.target = "_blank"; sp.rel = "noopener"; L.appendChild(sp);
    R.appendChild(el("h2", null, "Certifications"));
    var tl = el("ol", "timeline");
    if (t.certs.length) t.certs.forEach(function (c) { var li = el("li"); var tm = el("time", null, longDate(c.d)); tm.dateTime = c.d; li.append(tm, medal(c.n), el("span", "note", took(c.r, c.d) ? "atteint " + took(c.r, c.d) + " après la sortie" : "")); tl.appendChild(li); });
    else { var li3 = el("li"); li3.appendChild(el("span", "none", "Pas encore certifié par le SNEP.")); tl.appendChild(li3); }
    R.appendChild(tl);
    grid.append(L, R); w.appendChild(grid);
    var nb = el("div", "neighbors"), up = tracks[t.rank - 2], down = tracks[t.rank];
    function nbtn(q, label) { var b = el("button"); b.type = "button"; if (!q) { b.style.visibility = "hidden"; return b; } b.append(el("span", null, label), el("b", null, q.name)); b.addEventListener("click", function () { pushed++; location.hash = "#/titre/" + q.route; }); return b; }
    nb.append(nbtn(up, "n° " + (t.rank - 1) + ", juste devant"), nbtn(down, "n° " + (t.rank + 1) + ", juste derrière"));
    w.appendChild(nb);
    roomBody.appendChild(w);
  }

  /* ================= misc ================= */
  function onceVisible(node, fn) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(node);
  }
  (function grain() {
    var c = document.createElement("canvas"); c.width = c.height = 160;
    var g = c.getContext("2d"), im = g.createImageData(160, 160);
    for (var i = 0; i < im.data.length; i += 4) { var v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
    $("grain").style.backgroundImage = "url(" + c.toDataURL() + ")";
  })();

  // WebGL guard: show the drawn trident if 3D is unavailable or never starts
  (function webglGuard() {
    var host = $("trident"), cv = $("trident-canvas"), ok = false;
    try { var t = document.createElement("canvas"), gl = t.getContext("webgl2") || t.getContext("webgl"); ok = !!gl; var lose = gl && gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext(); } catch (e) { ok = false; }
    if (!ok) { host.classList.add("no-webgl"); return; }
    setTimeout(function () { if (!cv.classList.contains("ready")) host.classList.add("no-webgl"); }, 9000);
  })();

  // shared with the 3D trident scene
  window.WN = { go: go, reduced: REDUCED, names: NAMES, goalProg: goalProg,
    lightDest: function (w) { document.querySelectorAll("[data-go]").forEach(function (b) { b.classList.toggle("lit", b.dataset.go === w); }); } };

  route.first = true;
  if (/^#\/(projet|titre)\//.test(location.hash)) route();
  route.first = false;
})();
