/* RidgeGuard Risk Management — site behaviour. No dependencies. */
(function () {
  "use strict";

  var D = window.RG_DATA || { portfolios: {}, tails: {} };
  var CFG = window.RG_CONFIG || {};
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";

  var COLORS = {
    gold: "#e0b24e", goldHi: "#ecc867", teal: "#22a090", peri: "#7380ec", coral: "#d9603f",
    text2: "#bdb6aa", text3: "#8f897e"
  };
  var MARKET_COLOR = { "^NSEI": COLORS.coral, "^STOXX50E": COLORS.peri, "^GSPC": COLORS.teal };

  /* ───────── helpers ───────── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function tween(dur, fn, done) {
    if (REDUCED) { fn(1); if (done) done(); return; }
    var t0 = performance.now();
    function step(now) {
      var t = clamp((now - t0) / dur, 0, 1);
      fn(easeOut(t));
      if (t < 1) requestAnimationFrame(step); else if (done) done();
    }
    requestAnimationFrame(step);
  }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + "%"; }
  function signPct(v, d) { return (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d == null ? 1 : d) + "%"; }
  function minus(s) { return String(s).replace(/^-/, "−"); }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTHS_L = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function parseDate(s) { var p = s.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function fmtDateLong(s) { var d = parseDate(s); return d.getUTCDate() + " " + MONTHS_L[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function fmtMonYr(d) { return MONTHS[d.getUTCMonth()] + " " + String(d.getUTCFullYear()); }
  function fmtYears(y) {
    if (!isFinite(y)) return "never";
    if (y < 100) return (y < 10 ? y.toFixed(1) : Math.round(y)) + " years";
    if (y < 1e6) return Math.round(y).toLocaleString("en-US") + " years";
    var e = Math.floor(Math.log10(y)), m = y / Math.pow(10, e);
    return m.toFixed(m < 9.95 ? 0 : 0).replace(/\.0$/, "") + " × 10<sup>" + e + "</sup> years";
  }

  /* Student-t density (location/scale) */
  function lgamma(x) {
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; var a = c[0], t = x + g + 0.5;
    for (var i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function tpdf(x, df, loc, sc) {
    var z = (x - loc) / sc;
    var lc = lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI);
    return Math.exp(lc - (df + 1) / 2 * Math.log(1 + z * z / df)) / sc;
  }
  function npdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }

  /* ───────── config links ───────── */
  $$(".js-mailto").forEach(function (a) {
    if (CFG.contactEmail) a.href = "mailto:" + CFG.contactEmail + "?subject=" + encodeURIComponent("RidgeGuard briefing request");
  });
  $$(".js-login").forEach(function (a) {
    if (CFG.loginUrl) { a.href = CFG.loginUrl; a.target = "_blank"; a.rel = "noopener"; }
  });
  var yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  /* ───────── nav ───────── */
  var nav = $("#top-nav"), bar = $(".nav__progress span");
  var toggle = $(".nav__toggle"), menu = $("#mobile-menu");
  function onScroll() {
    var y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle("is-scrolled", y > 24);
    if (bar) bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  function closeMenu() { toggle.setAttribute("aria-expanded", "false"); menu.hidden = true; toggle.setAttribute("aria-label", "Open menu"); }
  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    menu.hidden = open;
    if (!open) nav.classList.add("is-scrolled");
  });
  $$("#mobile-menu a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  window.addEventListener("resize", function () { if (window.innerWidth > 1080) closeMenu(); });

  var navLinks = $$(".nav__links a");
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      navLinks.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id); });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$("main section[id]").forEach(function (s) { spy.observe(s); });

  /* ───────── reveal + counters ───────── */
  var revealObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      revealObs.unobserve(e.target);
      var c = e.target.querySelector("[data-count]");
      if (c) countUp(c);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach(function (n) { revealObs.observe(n); });

  function countUp(n) {
    var target = +n.getAttribute("data-count"), th = n.getAttribute("data-format") === "thousands";
    tween(1400, function (t) {
      var v = Math.round(target * t);
      n.textContent = th ? v.toLocaleString("en-US") : v;
    });
  }

  /* ───────── atmosphere: drifting smoke, dust and rare tail flares ───────── */
  (function atmosphere() {
    var smoke = $(".atmos__smoke"), sparks = $(".atmos__sparks");
    if (!smoke || !sparks) return;
    var sc = smoke.getContext("2d"), pc = sparks.getContext("2d");
    var SW = 0, SH = 0, img = null, PW = 0, PH = 0, dpr = 1;

    // value noise
    var P = new Uint8Array(512);
    (function () { var a = []; for (var i = 0; i < 256; i++) a[i] = i; var seed = 1337;
      for (i = 255; i > 0; i--) { seed = (seed * 16807) % 2147483647; var j = seed % (i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
      for (i = 0; i < 512; i++) P[i] = a[i & 255]; })();
    function fade(t) { return t * t * (3 - 2 * t); }
    function vn(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; xi &= 255; yi &= 255;
      var a = P[P[xi] + yi] / 255, b = P[P[xi + 1] + yi] / 255, c = P[P[xi] + yi + 1] / 255, d = P[P[xi + 1] + yi + 1] / 255;
      var u = fade(xf), v = fade(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y) { var s = 0, amp = .5, f = 1; for (var o = 0; o < 4; o++) { s += amp * vn(x * f, y * f); f *= 2.03; amp *= .5; } return s; }

    // palettes the backdrop drifts through as the page scrolls: ember, oxblood, jade, ember
    var PAL = [
      [[6, 6, 7], [58, 30, 12], [150, 104, 38]],
      [[6, 5, 7], [62, 14, 26], [128, 60, 44]],
      [[5, 7, 7], [12, 44, 38], [96, 92, 52]],
      [[6, 6, 7], [64, 34, 12], [160, 112, 40]]
    ];
    function lerp(a, b, t) { return a + (b - a) * t; }
    function pal(t) {
      var x = clamp(t, 0, .999) * (PAL.length - 1), i = Math.floor(x), f = x - i;
      return PAL[i].map(function (c, k) { return [lerp(c[0], PAL[i + 1][k][0], f), lerp(c[1], PAL[i + 1][k][1], f), lerp(c[2], PAL[i + 1][k][2], f)]; });
    }

    function size() {
      var W = window.innerWidth, H = window.innerHeight;
      var k = Math.max(W, H) > 1400 ? 9 : 7;
      SW = Math.ceil(W / k); SH = Math.ceil(H / k);
      smoke.width = SW; smoke.height = SH; img = sc.createImageData(SW, SH);
      dpr = Math.min(window.devicePixelRatio || 1, 2); PW = W; PH = H;
      sparks.width = W * dpr; sparks.height = H * dpr; pc.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawSmoke(t) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var prog = max > 0 ? window.scrollY / max : 0;
      var cols = pal(prog), c0 = cols[0], c1 = cols[1], c2 = cols[2];
      var d = img.data, sy = window.scrollY * 0.00035, asp = SW / SH;
      for (var y = 0; y < SH; y++) {
        var ny = y / SH * 2.2 + sy;
        for (var x = 0; x < SW; x++) {
          var nx = x / SW * 2.2 * asp;
          // domain warp gives the slow, curling smoke
          var qx = fbm(nx + t * .021, ny - t * .013), qy = fbm(nx + 5.2 - t * .017, ny + 1.3 + t * .019);
          var v = fbm(nx + 2.4 * qx + t * .008, ny + 2.4 * qy);
          v = clamp((v - .34) * 1.85, 0, 1);
          var hi = Math.pow(v, 3.2);                 // only the densest wisps glow
          var lo = v * (1 - hi);
          var i = (y * SW + x) * 4;
          d[i] = c0[0] + c1[0] * lo + c2[0] * hi;
          d[i + 1] = c0[1] + c1[1] * lo + c2[1] * hi;
          d[i + 2] = c0[2] + c1[2] * lo + c2[2] * hi;
          d[i + 3] = 255;
        }
      }
      sc.putImageData(img, 0, 0);
    }

    // dust motes and rare flares
    var motes = [], flares = [], nextFlare = 2500;
    function seedMotes() {
      motes = [];
      var n = Math.round(PW * PH / 26000);
      for (var i = 0; i < n; i++) motes.push({ x: Math.random() * PW, y: Math.random() * PH, r: Math.random() * 1.1 + .3,
        vx: (Math.random() - .5) * 6, vy: -(Math.random() * 6 + 2), ph: Math.random() * 6.28, sp: Math.random() * .8 + .4 });
    }
    function drawSparks(t, dt) {
      pc.clearRect(0, 0, PW, PH);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.x += m.vx * dt / 1000; m.y += m.vy * dt / 1000;
        if (m.y < -4) { m.y = PH + 4; m.x = Math.random() * PW; }
        if (m.x < -4) m.x = PW + 4; if (m.x > PW + 4) m.x = -4;
        var a = .18 + .32 * (.5 + .5 * Math.sin(t * m.sp + m.ph));
        pc.fillStyle = "rgba(236,200,120," + a.toFixed(3) + ")";
        pc.beginPath(); pc.arc(m.x, m.y, m.r, 0, 6.283); pc.fill();
      }
      nextFlare -= dt;
      if (nextFlare <= 0) {
        flares.push({ x: PW * (.08 + Math.random() * .84), y: PH * (.12 + Math.random() * .76), age: 0, life: 3200 + Math.random() * 1600,
          hot: Math.random() < .3 });
        nextFlare = 3800 + Math.random() * 4200;
      }
      flares = flares.filter(function (f) {
        f.age += dt; var k = f.age / f.life; if (k >= 1) return false;
        var a = Math.sin(Math.PI * Math.min(k * 1.6, 1)) * (1 - k);
        var col = f.hot ? "217,96,63" : "236,200,103";
        var g = pc.createRadialGradient(f.x, f.y, 0, f.x, f.y, 90);
        g.addColorStop(0, "rgba(" + col + "," + (.55 * a).toFixed(3) + ")");
        g.addColorStop(.15, "rgba(" + col + "," + (.16 * a).toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + col + ",0)");
        pc.fillStyle = g; pc.beginPath(); pc.arc(f.x, f.y, 90, 0, 6.283); pc.fill();
        pc.strokeStyle = "rgba(" + col + "," + (.22 * (1 - k)).toFixed(3) + ")"; pc.lineWidth = 1;
        pc.beginPath(); pc.arc(f.x, f.y, 6 + k * 120, 0, 6.283); pc.stroke();
        pc.fillStyle = "rgba(255,240,210," + (.9 * a).toFixed(3) + ")";
        pc.beginPath(); pc.arc(f.x, f.y, 1.6, 0, 6.283); pc.fill();
        return true;
      });
    }

    size(); seedMotes();
    var t0 = performance.now();
    drawSmoke(0); drawSparks(0, 0);
    var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { size(); seedMotes(); drawSmoke((performance.now() - t0) / 1000); }, 150); });
    if (REDUCED) { window.addEventListener("scroll", function () { drawSmoke(0); }, { passive: true }); return; }
    var last = 0, acc = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      if (document.hidden) { last = now; return; }
      var dt = last ? Math.min(now - last, 60) : 16; last = now; acc += dt;
      var t = (now - t0) / 1000;
      drawSparks(t, dt);
      if (acc >= 42) { acc = 0; drawSmoke(t); }   // smoke at ~24 fps is plenty
    }
    requestAnimationFrame(loop);
  })();

  /* ───────── hero field: drifting ridges built from heavy-tailed walks ───────── */
  (function heroField() {
    var cv = $(".hero__field"); if (!cv) return;
    var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = 1, layers = [], running = true, last = 0;
    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
    function tdraw(r, df) { // Student-t via normal / sqrt(chi2/df)
      var u1 = r() || 1e-9, u2 = r();
      var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      var c = 0; for (var i = 0; i < df; i++) { var a = r() || 1e-9, b = r(); var g = Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); c += g * g; }
      return z / Math.sqrt(c / df);
    }
    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var hero = cv.parentNode, pr = $(".proof", hero);
      if (pr) hero.style.setProperty("--proof-h", (hero.getBoundingClientRect().bottom - pr.getBoundingClientRect().top) + "px");
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var specs = [
        { base: .80, amp: 22, col: "140,120,96", a: .07, speed: 6, seed: 11, lw: 1 },
        { base: .88, amp: 26, col: "160,70,60", a: .08, speed: 10, seed: 23, lw: 1 },
        { base: .97, amp: 30, col: "217,171,71", a: .22, speed: 16, seed: 37, lw: 1.4 }
      ];
      layers = specs.map(function (s) {
        var r = rng(s.seed * 7919), pts = [], y = 0, n = 420;
        for (var i = 0; i < n; i++) { y += tdraw(r, 3) * 0.9 - y * 0.035; pts.push(y); }
        return { s: s, pts: pts, off: 0 };
      });
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      layers.forEach(function (L) {
        var s = L.s, n = L.pts.length, step = Math.max(W / 160, 6);
        L.off = (L.off + dt * s.speed / 1000) % n;
        var g = ctx.createLinearGradient(0, H * s.base - 80, 0, H);
        g.addColorStop(0, "rgba(" + s.col + "," + (s.a * 0.55) + ")");
        g.addColorStop(1, "rgba(" + s.col + ",0)");
        ctx.beginPath();
        var cols = Math.ceil(W / step) + 2, first = true;
        for (var i = 0; i < cols; i++) {
          var idx = (i + L.off), i0 = Math.floor(idx) % n, i1 = (i0 + 1) % n, f = idx - Math.floor(idx);
          var v = L.pts[i0] * (1 - f) + L.pts[i1] * f;
          var x = i * step, y = H * s.base - Math.max(v, -2) * s.amp / 4 - s.amp;
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(" + s.col + "," + (s.a * 2.2) + ")"; ctx.lineWidth = s.lw; ctx.stroke();
        ctx.lineTo(W + step, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      });
    }
    function loop(now) {
      if (!running) return;
      var dt = last ? Math.min(now - last, 50) : 16; last = now;
      draw(dt); requestAnimationFrame(loop);
    }
    build(); draw(0);
    window.addEventListener("resize", function () { build(); draw(0); });
    if (REDUCED) return;
    new IntersectionObserver(function (e) {
      running = e[0].isIntersecting; last = 0;
      if (running) requestAnimationFrame(loop);
    }).observe(cv);
  })();

  /* ───────── crash card rotator ───────── */
  (function crashCard() {
    var body = $(".crash-card__body"); if (!body) return;
    var dots = $$(".crash-card__dots i");
    var keys = ["^NSEI", "^STOXX50E", "^GSPC"].filter(function (k) { return D.tails[k]; });
    var i = 0;
    function render(k) {
      var t = D.tails[k], w = t.worst[0];
      $(".crash-card__index", body).textContent = t.index;
      $(".crash-card__move", body).textContent = signPct(w.ret, 2);
      $(".crash-card__date", body).textContent = fmtDateLong(w.date);
      $(".crash-card__odds .n", body).innerHTML = fmtYears(w.normal_years);
      $(".crash-card__odds .t", body).innerHTML = fmtYears(w.t_years);
    }
    if (keys.length) render(keys[0]);
    if (REDUCED || keys.length < 2) return;
    setInterval(function () {
      if (document.hidden) return;
      body.classList.add("is-out");
      setTimeout(function () {
        i = (i + 1) % keys.length; render(keys[i]);
        dots.forEach(function (d, j) { d.classList.toggle("on", j === i); });
        body.classList.remove("is-out");
      }, 450);
    }, 5200);
  })();

  /* ───────── generic tooltip ───────── */
  function makeTip(host) { var t = h("div", "tip"); host.appendChild(t); return t; }
  function placeTip(tip, host, x, y) {
    var w = tip.offsetWidth, hh = tip.offsetHeight, W = host.clientWidth;
    var left = x + 16; if (left + w > W) left = x - w - 16; if (left < 0) left = 0;
    var top = clamp(y - hh / 2, 0, host.clientHeight - hh);
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }

  /* ───────── tail chart ───────── */
  (function tails() {
    var host = $("#tail-chart"); if (!host || !D.tails["^NSEI"]) return;
    var tip = makeTip(host);
    var cur = "^NSEI", bars = [], heights = null, svg, g, W, H, M = { t: 10, r: 10, b: 30, l: 46 };
    var X0 = -12, X1 = 12, YMIN = Math.log10(4e-5), YMAX = Math.log10(0.8);
    var started = false;

    function dens(t) {
      var hh = t.hist, n = t.n;
      return hh.counts.map(function (c) { return c / (n * hh.w); });
    }
    function sx(v) { return M.l + (v - X0) / (X1 - X0) * (W - M.l - M.r); }
    function sy(d) { if (d <= 0) return H - M.b; var l = clamp(Math.log10(d), YMIN, YMAX); return M.t + (YMAX - l) / (YMAX - YMIN) * (H - M.t - M.b); }

    function frame() {
      host.querySelectorAll("svg").forEach(function (n) { n.remove(); });
      W = host.clientWidth; H = host.clientHeight;
      svg = el("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" }); host.insertBefore(svg, tip);
      var ax = el("g", { class: "axis" }, svg);
      [-1, -2, -3, -4].forEach(function (e) {
        var y = sy(Math.pow(10, e));
        el("line", { x1: M.l, x2: W - M.r, y1: y, y2: y }, ax);
        var tx = el("text", { x: M.l - 8, y: y + 4, "text-anchor": "end" }, ax); tx.textContent = "10" ;
        var sup = el("tspan", { dy: -6, "font-size": 9 }, tx); sup.textContent = String(e).replace("-", "−");
      });
      var stepX = W < 520 ? 4 : 2;
      for (var v = -12; v <= 12; v += stepX) {
        var x = sx(v);
        el("line", { x1: x, x2: x, y1: H - M.b, y2: H - M.b + 5, class: v === 0 ? "zero" : "" }, ax);
        var t = el("text", { x: x, y: H - M.b + 19, "text-anchor": "middle" }, ax); t.textContent = v === 0 ? "0" : minus(v) + "σ";
      }
      // shaded zones beyond ±4σ
      [[-12, -4], [4, 12]].forEach(function (z) {
        el("rect", { x: sx(z[0]), width: sx(z[1]) - sx(z[0]), y: M.t, height: H - M.t - M.b, fill: "rgba(217,96,63,.06)" }, svg);
      });
      var zl = el("text", { x: sx(-8), y: M.t + 16, "text-anchor": "middle", fill: COLORS.text3, "font-size": 12 }, svg); zl.textContent = "beyond 4σ";
      var zr = el("text", { x: sx(8), y: M.t + 16, "text-anchor": "middle", fill: COLORS.text3, "font-size": 12 }, svg); zr.textContent = "beyond 4σ";
      g = el("g", {}, svg);
      bars = D.tails[cur].hist.counts.map(function (_, i) {
        var lo = X0 + i * D.tails[cur].hist.w;
        var x = sx(lo) + 1, w = Math.max(sx(lo + D.tails[cur].hist.w) - sx(lo) - 2, 1);
        return el("rect", { x: x, width: w, y: H - M.b, height: 0, rx: 1.5, fill: "rgba(200,190,172,.30)" }, g);
      });
      el("path", { class: "c-norm", fill: "none", stroke: COLORS.text2, "stroke-width": 2, "stroke-dasharray": "5 5" }, svg);
      el("path", { class: "c-t", fill: "none", stroke: COLORS.goldHi, "stroke-width": 2.25, "stroke-linejoin": "round" }, svg);
      el("line", { class: "hl", y1: M.t, y2: H - M.b, stroke: "rgba(239,235,227,.35)", "stroke-width": 1, opacity: 0 }, svg);
      var hit = el("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", onMove);
      hit.addEventListener("pointerleave", function () { tip.classList.remove("on"); svg.querySelector(".hl").setAttribute("opacity", 0); paintBars(null); });
    }

    function curvePath(fn) {
      var d = "", started = false;
      for (var v = X0; v <= X1 + 1e-9; v += 0.05) {
        var y = fn(v); if (y < Math.pow(10, YMIN)) { started = false; continue; }
        d += (started ? "L" : "M") + sx(v).toFixed(1) + "," + sy(y).toFixed(1); started = true;
      }
      return d;
    }

    function paintBars(hi) {
      var c = MARKET_COLOR[cur];
      bars.forEach(function (b, i) {
        var lo = X0 + i * D.tails[cur].hist.w, far = Math.abs(lo + D.tails[cur].hist.w / 2) > 4;
        b.setAttribute("fill", i === hi ? "#efebe3" : far ? c : "rgba(200,190,172,.30)");
      });
    }

    function draw(animate) {
      var t = D.tails[cur], target = dens(t);
      var from = heights || target.map(function () { return 0; });
      paintBars(null);
      tween(animate ? 900 : 0, function (k) {
        heights = target.map(function (v, i) { return from[i] + (v - from[i]) * k; });
        bars.forEach(function (b, i) {
          var d = heights[i];
          if (d <= 0) { b.setAttribute("height", 0); b.setAttribute("y", H - M.b); return; }
          var y = sy(d); b.setAttribute("y", y); b.setAttribute("height", Math.max(H - M.b - y, 0));
        });
      });
      heights = target;
      svg.querySelector(".c-norm").setAttribute("d", curvePath(npdf));
      var tp = svg.querySelector(".c-t");
      tp.setAttribute("d", curvePath(function (x) { return tpdf(x, t.t_df, t.t_loc, t.t_scale); }));
      if (animate && !REDUCED) {
        var L = tp.getTotalLength(); tp.style.transition = "none";
        tp.style.strokeDasharray = L; tp.style.strokeDashoffset = L;
        tp.getBoundingClientRect();
        tp.style.transition = "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1) .2s"; tp.style.strokeDashoffset = 0;
      }
      side(t);
    }

    function onMove(ev) {
      var r = svg.getBoundingClientRect(), x = ev.clientX - r.left;
      var t = D.tails[cur], w = t.hist.w;
      var v = X0 + (x - M.l) / (W - M.l - M.r) * (X1 - X0), i = clamp(Math.floor((v - X0) / w), 0, t.hist.counts.length - 1);
      var lo = X0 + i * w, hi = lo + w;
      var obs = t.hist.counts[i];
      var expN = t.n * (ncdf(hi) - ncdf(lo));
      var hl = svg.querySelector(".hl"); hl.setAttribute("x1", sx(lo + w / 2)); hl.setAttribute("x2", sx(lo + w / 2)); hl.setAttribute("opacity", 1);
      paintBars(i);
      tip.innerHTML = '<div class="tip__h">' + minus(lo.toFixed(1)) + "σ to " + minus(hi.toFixed(1)) + "σ</div>" +
        '<div class="tip__r"><span>Days observed</span><b>' + obs.toLocaleString("en-US") + "</b></div>" +
        '<div class="tip__r"><span>Normal model expects</span><b>' + fmtExp(expN) + "</b></div>";
      tip.classList.add("on"); placeTip(tip, host, x, ev.clientY - r.top);
    }
    function fmtExp(v) { if (v >= 10) return Math.round(v).toLocaleString("en-US"); if (v >= 0.01) return v.toFixed(2); if (v === 0) return "0"; return "≈ 0"; }
    function ncdf(x) { // Abramowitz–Stegun 7.1.26 via erf
      var s = x < 0 ? -1 : 1, z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
      var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
      return 0.5 * (1 + s * y);
    }

    function side(t) {
      var k = $("#t-kurt"), from = parseFloat(k.textContent) || 0;
      tween(700, function (p) { k.textContent = (from + (t.kurtosis - from) * p).toFixed(1); });
      var ex = t.exceed["4"];
      $("#t-obs").textContent = ex[0]; $("#t-exp").textContent = ex[1].toFixed(1); $("#t-n").textContent = t.n.toLocaleString("en-US");
      var box = $("#t-dots"); box.innerHTML = "";
      var c = MARKET_COLOR[cur];
      for (var i = 0; i < ex[0]; i++) { var d = h("i"); d.style.background = c; box.appendChild(d); }
      var dots = $$("i", box);
      dots.forEach(function (d, j) { setTimeout(function () { d.classList.add("on"); }, REDUCED ? 0 : 18 * j); });
    }

    function rarity() {
      var host2 = $("#rarity"); if (!host2) return;
      ["^NSEI", "^STOXX50E", "^GSPC"].forEach(function (k) {
        var t = D.tails[k]; if (!t) return;
        var col = h("div", "rarity__col"); col.style.setProperty("--c", MARKET_COLOR[k]); col.setAttribute("role", "rowgroup");
        col.appendChild(h("h4", null, t.region + " <small>" + t.index + "</small>"));
        t.worst.slice(0, 3).forEach(function (w) {
          var row = h("div", "rarity__row"); row.setAttribute("role", "row");
          row.innerHTML = '<span class="rarity__move" role="cell">' + signPct(w.ret, 1) + '</span>' +
            '<span class="rarity__date" role="cell">' + fmtDateLong(w.date) + '</span><span></span>' +
            '<div class="rarity__odds" role="cell"><span class="n">Normal: once in ' + fmtYears(w.normal_years) + '</span><span class="t">Heavy-tailed: ' + fmtYears(w.t_years) + "</span></div>";
          col.appendChild(row);
        });
        host2.appendChild(col);
      });
      var leg = h("p", "rarity__legend", "<span>For scale, the universe is about 1.4 × 10<sup>10</sup> years old.</span>");
      host2.appendChild(leg);
    }

    function start() { frame(); draw(true); }
    rarity();
    new IntersectionObserver(function (e, o) { if (e[0].isIntersecting && !started) { started = true; start(); o.disconnect(); } }, { threshold: 0.2 }).observe(host);

    $$("#tails [role=tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#tails [role=tab]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
        cur = b.getAttribute("data-market");
        if (!started) { started = true; frame(); }
        draw(true);
      });
    });
    var rt; window.addEventListener("resize", function () { if (!started) return; clearTimeout(rt); rt = setTimeout(function () { heights = null; frame(); draw(false); }, 150); });
  })();

  /* ───────── wealth chart ───────── */
  (function wealth() {
    var host = $("#wealth-chart"); if (!host || !D.portfolios.india_family_office) return;
    var tip = makeTip(host);
    var pf = "india_family_office", sc = "1M", started = false;
    var SC_NAME = { "1M": "Monthly", "3M": "Quarterly", "12M": "Annual" };
    var BENCH_COLORS = [COLORS.teal, COLORS.peri, COLORS.coral];
    function benches() {
      return Object.keys(D.portfolios[pf].bench).map(function (k, i) {
        return { key: k, label: k.replace("Mean-variance", "Mean–variance"), color: BENCH_COLORS[i % 3] };
      });
    }
    var svg, W, H, M = { t: 14, r: 128, b: 30, l: 44 }, dom, shown = null;
    var DPM = 21; // trading days per month in the synthetic calendar
    function monthOf(i) { return Math.floor(i / DPM) + (i % DPM === 0 && i ? 0 : 1); }

    function series() {
      var P = D.portfolios[pf];
      var out = [{ key: "rg", label: "RidgeGuard", color: COLORS.goldHi, path: P.schemes[sc].path, main: true }];
      benches().forEach(function (b) { out.push({ key: b.key, label: b.label, color: b.color, path: P.bench[b.key].path }); });
      return out;
    }
    function domain() {
      var P = D.portfolios[pf], lo = Infinity, hi = -Infinity;
      ["1M", "3M", "12M"].forEach(function (k) { P.schemes[k].path.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }); });
      benches().forEach(function (b) { P.bench[b.key].path.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }); });
      var pad = (hi - lo) * 0.08; return [lo - pad, hi + pad];
    }
    function sx(i, n) { return M.l + i / (n - 1) * (W - M.l - M.r); }
    function sy(v) { return M.t + (dom[1] - v) / (dom[1] - dom[0]) * (H - M.t - M.b); }
    function pathD(arr) {
      var n = arr.length, d = "";
      for (var i = 0; i < n; i++) d += (i ? "L" : "M") + sx(i, n).toFixed(1) + "," + sy(arr[i]).toFixed(1);
      return d;
    }

    function frame() {
      host.querySelectorAll("svg").forEach(function (n) { n.remove(); });
      W = host.clientWidth; H = host.clientHeight;
      M.r = W < 560 ? 12 : 128;
      var P = D.portfolios[pf];
      dom = domain();
      var n = P.schemes[sc].path.length;
      svg = el("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" }); host.insertBefore(svg, tip);
      var defs = el("defs", {}, svg);
      var lg = el("linearGradient", { id: "rg-fill", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el("stop", { offset: 0, "stop-color": COLORS.gold, "stop-opacity": .28 }, lg);
      el("stop", { offset: 1, "stop-color": COLORS.gold, "stop-opacity": 0 }, lg);

      var ax = el("g", { class: "axis" }, svg);
      var span = dom[1] - dom[0], step = span > 1.2 ? 0.5 : span > 0.6 ? 0.2 : span > 0.3 ? 0.1 : 0.05;
      for (var v = Math.ceil(dom[0] / step) * step; v <= dom[1]; v += step) {
        var y = sy(v);
        el("line", { x1: M.l, x2: W - M.r, y1: y, y2: y, class: Math.abs(v - 1) < 1e-6 ? "zero" : "" }, ax);
        var t = el("text", { x: M.l - 8, y: y + 4, "text-anchor": "end" }, ax); t.textContent = Math.round(v * 100);
      }
      // tick every six months of simulated time
      var stepM = W < 560 ? 12 : 6;
      for (var mth = 0; mth * DPM <= n - 1; mth += stepM) {
        var x = sx(mth * DPM, n);
        el("line", { x1: x, x2: x, y1: H - M.b, y2: H - M.b + 5 }, ax);
        var tl = el("text", { x: x, y: H - M.b + 19, "text-anchor": "middle" }, ax);
        tl.textContent = mth === 0 ? "Start" : mth % 12 === 0 ? "Year " + (mth / 12) : "Month " + mth;
      }
      el("path", { class: "w-area", fill: "url(#rg-fill)" }, svg);
      series().slice().reverse().forEach(function (s) {
        el("path", { class: "w-line", "data-k": s.key, fill: "none", stroke: s.color, "stroke-width": s.main ? 2.75 : 1.6,
          "stroke-opacity": s.main ? 1 : .85, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      });
      el("g", { class: "w-labels" }, svg);
      el("line", { class: "w-x", y1: M.t, y2: H - M.b, stroke: "rgba(239,235,227,.35)", opacity: 0 }, svg);
      el("g", { class: "w-pts" }, svg);
      var hit = el("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", onMove);
      hit.addEventListener("pointerleave", function () { tip.classList.remove("on"); svg.querySelector(".w-x").setAttribute("opacity", 0); svg.querySelector(".w-pts").innerHTML = ""; });
    }

    function render(mode) { // mode: "draw" | "morph" | "static"
      var S = series(), rg = S[0].path, n = rg.length;
      var from = shown && shown.length === n ? shown : null;
      var apply = function (k) {
        var cur = from && mode === "morph" ? rg.map(function (v, i) { return from[i] + (v - from[i]) * k; }) : rg;
        S.forEach(function (s) {
          var p = svg.querySelector('.w-line[data-k="' + s.key + '"]');
          p.setAttribute("d", pathD(s.main ? cur : s.path));
        });
        var a = pathD(cur) + "L" + sx(n - 1, n) + "," + (H - M.b) + "L" + sx(0, n) + "," + (H - M.b) + "Z";
        svg.querySelector(".w-area").setAttribute("d", a);
        labels(S, cur);
      };
      if (mode === "morph" && from) tween(700, apply); else apply(1);
      shown = rg.slice();
      if (mode === "draw" && !REDUCED) {
        $$(".w-line", svg).forEach(function (p, j) {
          var L = p.getTotalLength(); p.style.transition = "none"; p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
          p.getBoundingClientRect();
          p.style.transition = "stroke-dashoffset 1.8s cubic-bezier(.2,.8,.2,1) " + (j * 0.08) + "s"; p.style.strokeDashoffset = 0;
        });
        var ar = svg.querySelector(".w-area"); ar.style.opacity = 0; ar.style.transition = "opacity 1.2s ease .9s";
        requestAnimationFrame(function () { ar.style.opacity = 1; });
      }
    }

    function labels(S, cur) {
      var g = svg.querySelector(".w-labels"); g.innerHTML = "";
      if (W < 560) return;
      var n = cur.length, items = S.map(function (s) { var v = s.main ? cur[n - 1] : s.path[n - 1]; return { s: s, v: v, y: sy(v) }; });
      items.sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 30) items[i].y = items[i - 1].y + 30;
      var over = items[items.length - 1].y - (H - M.b - 6); if (over > 0) items.forEach(function (it) { it.y -= over; });
      items.forEach(function (it) {
        var x = W - M.r + 10;
        el("circle", { cx: W - M.r, cy: sy(it.v), r: 3.5, fill: it.s.color, stroke: "#0b0a0c", "stroke-width": 2 }, g);
        var t1 = el("text", { x: x, y: it.y - 1, fill: "#efebe3", "font-size": 13, "font-weight": 600 }, g); t1.textContent = (it.v * 100).toFixed(1);
        var t2 = el("text", { x: x, y: it.y + 13, fill: COLORS.text3, "font-size": 11.5 }, g); t2.textContent = it.s.label;
      });
    }

    function onMove(ev) {
      var r = svg.getBoundingClientRect(), x = ev.clientX - r.left;
      var S = series(), n = S[0].path.length;
      var i = clamp(Math.round((x - M.l) / (W - M.l - M.r) * (n - 1)), 0, n - 1);
      var X = sx(i, n);
      var xl = svg.querySelector(".w-x"); xl.setAttribute("x1", X); xl.setAttribute("x2", X); xl.setAttribute("opacity", 1);
      var pg = svg.querySelector(".w-pts"); pg.innerHTML = "";
      var rows = S.map(function (s) {
        el("circle", { cx: X, cy: sy(s.path[i]), r: s.main ? 4.5 : 3.5, fill: s.color, stroke: "#0b0a0c", "stroke-width": 2 }, pg);
        return '<div class="tip__r"><span><i style="background:' + s.color + '"></i>' + (s.main ? "RidgeGuard, " + SC_NAME[sc].toLowerCase() : s.label) + "</span><b>" + (s.path[i] * 100).toFixed(1) + "</b></div>";
      });
      tip.innerHTML = '<div class="tip__h">' + (i === 0 ? "Start" : "Month " + monthOf(i) + " · day " + i) + "</div>" + rows.join("");
      tip.classList.add("on"); placeTip(tip, host, x, ev.clientY - r.top);
    }

    function legend() {
      var lg = $("#w-legend"), S = series();
      lg.innerHTML = S.map(function (s) {
        return '<span><i class="sw sw--series" style="background:' + s.color + (s.main ? ";height:3px" : "") + '"></i>' + (s.main ? "RidgeGuard (" + SC_NAME[sc].toLowerCase() + ")" : s.label) + "</span>";
      }).join("");
      var P = D.portfolios[pf];
      $("#pf-name").textContent = P.name;
      $("#pf-desc").textContent = "· " + P.desc;
      $("#w-window").textContent = "Synthetic scenario: " + Math.round(P.days / 252) + " years of simulated trading days with heavy-tailed shocks and one stress episode. Not market data. Benchmarks rebalanced quarterly, except buy and hold. Growth of 100, before costs and taxes.";
    }

    /* metrics */
    var MET = [
      { k: "total_return", label: "Ending value", wide: true, f: function (v) { return (100 * (1 + v)).toFixed(1); }, cmp: function (v) { return (100 * (1 + v)).toFixed(1); } },
      { k: "ann_return", label: "Annual return", f: function (v) { return pct(v); } },
      { k: "volatility", label: "Volatility", f: function (v) { return pct(v); }, lowGood: true },
      { k: "sharpe", label: "Sharpe ratio", f: function (v) { return minus(v.toFixed(2)); } },
      { k: "max_drawdown", label: "Max drawdown", f: function (v) { return minus(pct(v)); } },
      { k: "cvar99", label: "Daily CVaR 99%", f: function (v) { return minus(pct(v, 2)); } },
      { k: "calmar", label: "Calmar ratio", f: function (v) { return minus(v.toFixed(2)); } }
    ];
    var lastVals = {};
    function metrics() {
      var box = $("#metrics"), P = D.portfolios[pf], m = P.schemes[sc], bk = Object.keys(P.bench)[0], ew = P.bench[bk];
      if (!box.children.length) {
        MET.forEach(function (x) {
          var c = h("div", "metric" + (x.wide ? " metric--wide" : ""));
          c.innerHTML = '<p class="metric__k">' + x.label + (x.wide ? " (from 100)" : "") + '</p><p class="metric__v" data-k="' + x.k + '">–</p><p class="metric__b" data-b="' + x.k + '"></p>';
          box.appendChild(c);
        });
      }
      MET.forEach(function (x) {
        var vEl = box.querySelector('[data-k="' + x.k + '"]'), bEl = box.querySelector('[data-b="' + x.k + '"]');
        var to = m[x.k], from = lastVals[x.k] != null ? lastVals[x.k] : to;
        tween(650, function (p) { vEl.textContent = x.f(from + (to - from) * p); });
        lastVals[x.k] = to;
        var b = ew[x.k], better = x.k === "volatility" ? to < b : to > b;
        bEl.innerHTML = bk + ' <span class="' + (better ? "up" : "dn") + '">' + x.f(b) + "</span>";
      });
    }

    function policy() {
      var P = D.portfolios[pf], box = $("#policy-bars");
      var keys = ["1M", "3M", "12M"], ends = keys.map(function (k) { return 100 * (1 + P.schemes[k].total_return); });
      var dds = keys.map(function (k) { return -P.schemes[k].max_drawdown; });
      var maxEnd = Math.max.apply(null, ends), maxDD = Math.max.apply(null, dds);
      if (!box.children.length) {
        keys.forEach(function (k) {
          var r = h("div", "pbar");
          r.innerHTML = '<span class="pbar__name" data-n="' + k + '">' + SC_NAME[k] + '</span><span class="pbar__track"><span class="pbar__fill" style="width:0"></span><span class="pbar__dd" style="width:0"></span></span><span class="pbar__val"></span>';
          box.appendChild(r);
        });
        var key = h("div", "pbar-key", '<span><i style="background:' + COLORS.gold + '"></i>Ending value</span><span><i style="background:' + COLORS.coral + '"></i>Worst drawdown</span>');
        box.appendChild(key);
      }
      var rows = $$(".pbar", box);
      keys.forEach(function (k, i) {
        var r = rows[i];
        $(".pbar__name", r).classList.toggle("is-sel", k === sc);
        $(".pbar__fill", r).style.width = (ends[i] / maxEnd * 100) + "%";
        $(".pbar__dd", r).style.width = (dds[i] / maxDD * 60) + "%";
        $(".pbar__val", r).innerHTML = ends[i].toFixed(1) + "<small>drawdown " + minus(pct(-dds[i])) + "</small>";
      });
      // narrative
      var hiI = ends.indexOf(Math.max.apply(null, ends)), loI = ends.indexOf(Math.min.apply(null, ends));
      var spread = ends[hiI] - ends[loI], txt;
      var bk = Object.keys(P.bench)[0], ewEnd = 100 * (1 + P.bench[bk].total_return);
      if (spread < 3) {
        txt = "In this book the policy barely moves the result: every schedule ends within " + spread.toFixed(1) + " points of the others" + (Math.min.apply(null, ends) > ewEnd ? ", and all three finish above the " + bk.toLowerCase() + " benchmark (" + ewEnd.toFixed(1) + ")" : "") + ". When the outcome is this stable, the case for frequent trading is weak. A less frequent schedule keeps the result while cutting turnover and the tax drag that comes with it.";
      } else if (dds[hiI] > dds[loI]) {
        txt = SC_NAME[keys[hiI]] + " rebalancing ends at " + ends[hiI].toFixed(1) + ", against " + ends[loI].toFixed(1) + " for " + SC_NAME[keys[loI]].toLowerCase() +
          ". The gap comes with a cost: the worst drawdown moves from " + pct(dds[loI]) + " to " + pct(dds[hiI]) + ". Here the rebalancing schedule is a risk decision in its own right, and one a committee should choose deliberately rather than inherit from the calendar.";
      } else {
        txt = SC_NAME[keys[hiI]] + " rebalancing ends at " + ends[hiI].toFixed(1) + ", against " + ends[loI].toFixed(1) + " for " + SC_NAME[keys[loI]].toLowerCase() +
          ", without a deeper drawdown (" + pct(dds[hiI]) + " against " + pct(dds[loI]) + "). Trading less often let the stronger sleeves run through the recovery. That is a property of this path, not a rule, which is why a schedule should be tested on the portfolio it governs rather than assumed.";
      }
      $("#policy-read").textContent = txt;
    }

    function full(mode) { legend(); render(mode); metrics(); policy(); }
    new IntersectionObserver(function (e, o) { if (e[0].isIntersecting && !started) { started = true; frame(); full("draw"); o.disconnect(); } }, { threshold: 0.2 }).observe(host);

    // segmented control thumb
    var seg = $(".seg"), thumb = $(".seg__thumb");
    function moveThumb() {
      var b = $("[aria-checked=true]", seg); if (!b) return;
      thumb.style.width = b.offsetWidth + "px"; thumb.style.transform = "translateX(" + (b.offsetLeft - 4) + "px)";
    }
    moveThumb(); window.addEventListener("resize", moveThumb);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveThumb);

    $$(".seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".seg button").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        sc = b.getAttribute("data-sc"); moveThumb();
        if (!started) { started = true; frame(); full("draw"); return; }
        legend(); render("morph"); metrics(); policy();
      });
    });
    $$("#rebalancing [role=tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#rebalancing [role=tab]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
        pf = b.getAttribute("data-pf"); shown = null; started = true;
        frame(); full("draw");
      });
    });
    var rt; window.addEventListener("resize", function () { if (!started) return; clearTimeout(rt); rt = setTimeout(function () { frame(); render("static"); }, 150); });
  })();

  /* ───────── timeline drag-to-scroll ───────── */
  (function timeline() {
    var tl = $(".timeline"); if (!tl) return;
    var down = false, sx0 = 0, sl0 = 0, moved = false;
    tl.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") return; down = true; moved = false; sx0 = e.clientX; sl0 = tl.scrollLeft; tl.classList.add("is-drag"); });
    window.addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - sx0; if (Math.abs(dx) > 3) moved = true; tl.scrollLeft = sl0 - dx; });
    window.addEventListener("pointerup", function () { down = false; tl.classList.remove("is-drag"); });
    tl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { tl.scrollBy({ left: 280, behavior: "smooth" }); e.preventDefault(); }
      if (e.key === "ArrowLeft") { tl.scrollBy({ left: -280, behavior: "smooth" }); e.preventDefault(); }
    });
  })();
})();
