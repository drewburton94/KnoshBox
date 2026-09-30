/* Desk thermoformer mini-game (ported from the design prototype). */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var cv = $('#cv'); if (!cv) return;
  var INK = '#171512';

  var molds = {
    tray: [0, .55, .55, .2, .55, .55, .2, .55, .55, 0],
    clamshell: [0, .35, .75, .78, .35, .08, .35, .78, .75, .35, 0],
    deep: [0, .05, .3, .8, .95, .95, .8, .3, .05, 0],
    custom: [0, .3, .6, .4, .7, .2, .5, .6, .3, 0]
  };
  var mats = [
    { name: 'PET', line: '#9fd3e3' }, { name: 'HIPS', line: '#faf7f0' }, { name: 'PP', line: '#eadfc0' },
    { name: 'ABS', line: '#3a352f' }, { name: 'PVC', line: '#bccaf2' }
  ];
  var moldList = [['clamshell', 'Clamshell'], ['tray', 'Tray'], ['deep', 'Deep draw'], ['custom', 'Your own']];
  var sizeList = ['14″ × 14″', '16″ × 16″', '18″ × 24″', '40″ × 40″'];
  var SIZE_F = [0.46, 0.54, 0.66, 0.86];

  var st = { mold: 'clamshell', mat: 0, size: 2, temp: 20, stage: 'ready', parts: [], heating: false, dragged: false };
  var sim = { h: 0, v: 0, k: 1, lift: 0, glow: 0, vac: false, eject: false, drag: -1, peak: 0, heating: false };

  var el = {
    status: $('#status'), temp: $('#temp'), fill: $('#tempFill'), lamp: $('#lamp'), hint: $('#dragHint'),
    heat: $('#heatBtn'), vac: $('#vacBtn'), ej: $('#ejBtn'),
    shelf: $('#shelf'), shelfTitle: $('#shelfTitle'), shelfGrid: $('#shelfGrid')
  };

  /* ---- option chips ---- */
  function chips(id, items, cls, get) {
    var box = $(id); box.innerHTML = '';
    items.forEach(function (it, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip ' + cls;
      var lab = get.label(it, i);
      if (cls === 'sw') { var s = document.createElement('span'); s.className = 'swatch'; s.style.background = it.line; b.appendChild(s); }
      b.appendChild(document.createTextNode(lab));
      b.addEventListener('click', function () { if (st.stage !== 'ready') return; get.pick(it, i); renderChips(); });
      b.dataset.on = get.on(it, i) ? '1' : '';
      if (get.on(it, i)) b.classList.add('on');
      b.setAttribute('aria-pressed', get.on(it, i) ? 'true' : 'false');
      box.appendChild(b);
    });
  }
  function renderChips() {
    chips('#moldOpts', moldList, 'md', { label: function (o) { return o[1]; }, pick: function (o) { st.mold = o[0]; }, on: function (o) { return st.mold === o[0]; } });
    chips('#matOpts', mats, 'sw', { label: function (o) { return o.name; }, pick: function (o, i) { st.mat = i; }, on: function (o, i) { return st.mat === i; } });
    chips('#sizeOpts', sizeList, 'sz', { label: function (o) { return o; }, pick: function (o, i) { st.size = i; }, on: function (o, i) { return st.size === i; } });
  }

  /* ---- actions ---- */
  function setHeat(on) {
    if (on && st.stage !== 'ready') return;
    if (sim.heating === on) return;
    sim.heating = on; st.heating = on; el.heat.classList.toggle('on', on);
  }
  function doVacuum() {
    if (st.stage !== 'ready') return;
    sim.heating = false; st.heating = false; el.heat.classList.remove('on');
    sim.peak = sim.h;
    sim.k = Math.max(0.08, Math.min(1, (Math.min(sim.h, 1) - 0.22) / 0.38));
    sim.vac = true; sim.v = 0; st.stage = 'forming';
  }
  function doEject() {
    if (st.stage !== 'formed') return;
    sim.eject = true; sim.lift = 0; st.stage = 'eject';
  }

  /* ---- simulation ---- */
  function step(dt) {
    var s = sim;
    if (s.heating && st.stage === 'ready') s.h = Math.min(1.12, s.h + dt * 0.3);
    else if (st.stage === 'ready') s.h = Math.max(0, s.h - dt * 0.05);
    else s.h = Math.max(0, s.h - dt * 0.25);
    s.glow += ((s.heating ? 1 : 0) - s.glow) * Math.min(1, dt * 8);
    if (s.vac) { s.v = Math.min(1, s.v + dt * 3.4); if (s.v >= 1) { s.vac = false; st.stage = 'formed'; } }
    if (s.eject) { s.lift = Math.min(1, s.lift + dt * 1.6); if (s.lift >= 1) finishEject(); }
    var shown = st.stage === 'ready' ? s.h : s.peak;
    st.temp = Math.round(20 + Math.min(shown, 1.12) * 170);
  }

  function geo() {
    var W = cv.clientWidth || 1000;
    var fw = W * SIZE_F[st.size], fx0 = (W - fw) / 2, mw = fw * 0.76, mx0 = (W - mw) / 2;
    return { W: W, H: 440, fw: fw, fx0: fx0, fx1: fx0 + fw, mw: mw, mx0: mx0, mx1: mx0 + mw, clampY: 112, baseY: 278, moldH: 126 };
  }
  function pts() { return molds[st.mold]; }
  function moldY(g, x) {
    if (x <= g.mx0 || x >= g.mx1) return g.baseY;
    var p = pts(), t = (x - g.mx0) / g.mw * (p.length - 1), i = Math.floor(t), f = t - i;
    var a = p[i], b = p[Math.min(i + 1, p.length - 1)], m = (1 - Math.cos(f * Math.PI)) / 2;
    return g.baseY - (a + (b - a) * m) * g.moldH;
  }
  function sheetY(g, x, noLift) {
    var s = sim, u = (x - g.fx0) / g.fw, h = st.stage === 'ready' ? s.h : s.peak;
    var sag = g.clampY + Math.min(h, 1) * 95 * Math.sin(Math.PI * u);
    if (h > 1) sag += (h - 1) * 700 * Math.sin(Math.PI * u);
    var my = moldY(g, x), rest = Math.min(sag, my), f = s.v * s.k;
    var edge = Math.max(0, Math.min(1, (x - g.fx0) / 40, (g.fx1 - x) / 40));
    var y = rest + (my - 2 - rest) * f * edge;
    if (!noLift) y -= s.lift * s.lift * 300;
    return y;
  }
  function mix(a, b, t) {
    var p = function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); };
    var A = p(a), B = p(b);
    return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')';
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw() {
    var dpr = window.devicePixelRatio || 1, cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw) return;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = geo(), s = sim, x, y;
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#fbf8f1'; ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = 'rgba(23,21,18,0.06)'; ctx.lineWidth = 1;
    for (x = 0; x < cw; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
    // heater
    var hx0 = g.fx0 - 16, hx1 = g.fx1 + 16;
    if (s.glow > 0.02) {
      var gr = ctx.createLinearGradient(0, 60, 0, 200);
      gr.addColorStop(0, 'rgba(220,50,40,' + 0.35 * s.glow + ')'); gr.addColorStop(1, 'rgba(220,50,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(hx0, 60, hx1 - hx0, 140);
    }
    ctx.fillStyle = INK; rr(ctx, hx0, 26, hx1 - hx0, 36, 12); ctx.fill();
    ctx.fillStyle = mix('#4a453e', '#d8342b', s.glow);
    for (x = hx0 + 18; x < hx1 - 18; x += 22) { rr(ctx, x, 50, 12, 8, 3); ctx.fill(); }
    // platen
    ctx.fillStyle = '#d9d2c4'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    rr(ctx, g.fx0 - 30, g.baseY, g.fw + 60, 30, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; for (x = g.fx0; x < g.fx1; x += 30) { ctx.beginPath(); ctx.arc(x, g.baseY + 15, 2.5, 0, 7); ctx.fill(); }
    // mold
    ctx.beginPath(); ctx.moveTo(g.mx0, g.baseY);
    for (x = g.mx0; x <= g.mx1; x += 3) ctx.lineTo(x, moldY(g, x));
    ctx.lineTo(g.mx1, g.baseY); ctx.closePath();
    var mg = ctx.createLinearGradient(0, g.baseY - g.moldH, 0, g.baseY); mg.addColorStop(0, '#cfcac1'); mg.addColorStop(1, '#a9a399');
    ctx.fillStyle = mg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    // vacuum arrows
    if (s.vac || st.stage === 'forming') {
      ctx.strokeStyle = 'rgba(60,110,230,' + (1 - s.v) + ')'; ctx.lineWidth = 3;
      for (x = g.mx0 + 20; x < g.mx1; x += 46) { y = moldY(g, x) - 30 + s.v * 20; ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x, y); ctx.lineTo(x + 7, y - 7); ctx.stroke(); }
    }
    // sheet
    var mat = mats[st.mat], hh = st.stage === 'ready' ? s.h : Math.max(s.h, 0);
    var col = mix(mat.line, '#e2483c', Math.min(1, hh) * 0.55);
    if ((st.stage === 'ready' ? s.h : s.peak) > 1.02 && st.stage !== 'ready') col = mix(mat.line, '#6b4a2a', 0.45);
    ctx.globalAlpha = st.stage === 'eject' ? 1 - Math.max(0, s.lift - 0.6) / 0.4 : 1;
    ctx.beginPath();
    for (x = g.fx0; x <= g.fx1; x += 2) { y = sheetY(g, x); x === g.fx0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke();
    ctx.globalAlpha = 1;
    // clamps
    ctx.fillStyle = INK;
    [g.fx0 - 22, g.fx1 - 6].forEach(function (cx) { rr(ctx, cx, g.clampY - 16, 28, 32, 6); ctx.fill(); });
    // handles
    if (st.stage === 'ready') {
      var p = pts();
      for (var i = 1; i < p.length - 1; i++) {
        var hx = g.mx0 + i / (p.length - 1) * g.mw, hy = g.baseY - p[i] * g.moldH;
        ctx.beginPath(); ctx.arc(hx, hy, s.drag === i ? 10 : 7, 0, 7); ctx.fillStyle = '#d8342b'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      }
    }
  }

  function finishEject() {
    var g = geo(), s = sim, mat = mats[st.mat];
    var x0 = g.mx0 - 24, x1 = g.mx1 + 24, top = g.baseY - g.moldH - 10, span = g.baseY - top, d = '';
    for (var i = 0; i <= 60; i++) {
      var x = x0 + (x1 - x0) * i / 60, y = sheetY(g, x, true);
      d += (i ? 'L' : 'M') + (i / 60 * 100).toFixed(1) + ' ' + ((y - top) / span * 42).toFixed(1);
    }
    var scorched = s.peak > 1.02, under = s.k < 0.9;
    st.parts.unshift({
      d: d, color: mat.line, name: mat.name + ' · ' + st.mold,
      quality: scorched ? 'scorched' : under ? 'under-formed' : 'perfect',
      tagBg: scorched ? '#e8b48f' : under ? '#f2e28a' : '#b7e3c2'
    });
    st.parts = st.parts.slice(0, 12);
    s.eject = false; s.lift = 0; s.v = 0; s.h = 0; s.peak = 0; st.stage = 'ready';
    renderShelf();
  }

  function renderShelf() {
    if (!st.parts.length) { el.shelf.hidden = true; return; }
    el.shelf.hidden = false;
    el.shelfTitle.textContent = 'Your shelf · ' + st.parts.length + ' formed';
    el.shelfGrid.innerHTML = '';
    var NS = 'http://www.w3.org/2000/svg';
    st.parts.forEach(function (p) {
      var card = document.createElement('div'); card.className = 'part';
      var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-4 -4 108 50'); svg.setAttribute('aria-hidden', 'true');
      [[INK, 5], [p.color, 2.4]].forEach(function (a) {
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', p.d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', a[0]);
        path.setAttribute('stroke-width', a[1]); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
      });
      var meta = document.createElement('div'); meta.className = 'part-meta';
      var n = document.createElement('span'); n.textContent = p.name;
      var q = document.createElement('span'); q.className = 'part-tag'; q.textContent = p.quality; q.style.background = p.tagBg;
      meta.appendChild(n); meta.appendChild(q); card.appendChild(svg); card.appendChild(meta);
      el.shelfGrid.appendChild(card);
    });
  }

  function renderUI() {
    var ready = st.stage === 'ready', msg;
    if (st.stage === 'forming') msg = 'Vacuum on. Pulling the sheet onto the mold.';
    else if (st.stage === 'formed' || st.stage === 'eject') msg = sim.peak > 1.02 ? 'Scorched it. Overheated sheets thin out. Eject and retry.' : sim.k < 0.9 ? 'Too cold to fully form. Eject and heat longer.' : 'Perfect part. Hit EJECT.';
    else if (st.temp < 90) msg = st.heating ? 'Heating…' : 'Hold HEAT to soften the sheet.';
    else if (st.temp < 130) msg = 'Getting soft. Keep heating.';
    else if (st.temp <= 190) msg = 'In the forming window. VACUUM now!';
    else msg = 'Too hot! The sheet is sagging.';
    if (el.status.textContent !== msg) el.status.textContent = msg;
    el.temp.textContent = st.temp + '°C';
    el.fill.style.width = Math.min(100, (st.temp - 20) / 190 * 100) + '%';
    el.lamp.style.background = st.stage === 'formed' ? '#5fcf7f' : st.temp > 190 ? '#e2483c' : st.temp >= 130 ? '#f0c93a' : '#d9d2c4';
    el.hint.hidden = !(ready && !st.dragged && st.parts.length === 0);
    el.vac.disabled = !ready; el.ej.disabled = st.stage !== 'formed';
    cv.style.cursor = ready ? 'grab' : 'default';
  }

  /* ---- input ---- */
  el.heat.addEventListener('pointerdown', function (e) { e.preventDefault(); el.heat.setPointerCapture && el.heat.setPointerCapture(e.pointerId); setHeat(true); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { el.heat.addEventListener(t, function () { setHeat(false); }); });
  el.heat.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); setHeat(true); } });
  el.heat.addEventListener('keyup', function (e) { if (e.key === 'Enter') setHeat(false); });
  el.vac.addEventListener('click', doVacuum);
  el.ej.addEventListener('click', doEject);

  function inView() { var r = cv.getBoundingClientRect(); return !(r.bottom < 0 || r.top > innerHeight); }
  window.addEventListener('keydown', function (e) {
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !inView()) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setHeat(true); }
    else if (e.key === 'v' || e.key === 'V') doVacuum();
    else if (e.key === 'e' || e.key === 'E') doEject();
  });
  window.addEventListener('keyup', function (e) { if (e.code === 'Space') setHeat(false); });
  window.addEventListener('blur', function () { setHeat(false); });

  function pointer(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  cv.addEventListener('pointerdown', function (e) {
    if (st.stage !== 'ready') return;
    var g = geo(), pt = pointer(e), p = pts();
    for (var i = 1; i < p.length - 1; i++) {
      var hx = g.mx0 + i / (p.length - 1) * g.mw, hy = g.baseY - p[i] * g.moldH;
      if (Math.hypot(pt[0] - hx, pt[1] - hy) < 22) {
        if (st.mold !== 'custom') molds.custom = p.slice();
        sim.drag = i; cv.setPointerCapture(e.pointerId);
        st.mold = 'custom'; st.dragged = true; renderChips(); return;
      }
    }
  });
  cv.addEventListener('pointermove', function (e) {
    if (sim.drag < 0) return;
    var g = geo(), pt = pointer(e);
    molds.custom[sim.drag] = Math.max(0, Math.min(1, (g.baseY - pt[1]) / g.moldH));
  });
  ['pointerup', 'pointercancel'].forEach(function (t) { cv.addEventListener(t, function () { sim.drag = -1; }); });

  /* ---- loop (paused while off-screen or tab hidden) ---- */
  var last = performance.now(), visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (!visible) setHeat(false); }).observe(cv);
  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!visible) return;
    step(dt); draw(); renderUI();
  }
  renderChips(); renderShelf(); renderUI();
  requestAnimationFrame(loop);
})();
