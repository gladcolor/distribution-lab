/* Distributions in the Field: the interactive lessons. Needs core.js and chart.js. */
(function () {
  'use strict';
  var DL = window.DL;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var F = {
    int: function (v) { return Math.round(v).toLocaleString('en-US'); },
    d1: function (v) { return v.toFixed(1); },
    d2: function (v) { return v.toFixed(2); },
    pct: function (v) { var p = 100 * v; return ((p > 0 && p < 9.95) || (p > 99.05 && p < 99.995) ? p.toFixed(1) : p.toFixed(0)) + '%'; }
  };
  function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }
  function maxOf(a) { var m = -Infinity; for (var i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  // Shares at 0..top, without pooling the values above top into the last cell.
  function shares(sample, top) { return DL.tally(sample, top + 1).slice(0, top + 1); }

  var labs = [];
  function redrawAll() { labs.forEach(function (l) { l.draw(); }); }

  /* ---------- one lab: title, legend, controls, canvases, summary tiles ---------- */
  function makeLab(id, cfg) {
    var root = document.getElementById(id);
    var lab = { v: {}, c: {}, tiles: {}, labels: {}, inputs: {}, handlers: {}, root: root, draw: function () {}, onParam: null };
    var legend = (cfg.legend || []).map(function (l) { return '<li><span class="sw sw-' + l[0] + '"></span>' + l[1] + '</li>'; }).join('');
    root.innerHTML = '<div class="lab-head"><h3>' + cfg.title + '</h3>' + (legend ? '<ul class="legend">' + legend + '</ul>' : '') + '</div>' +
      '<div class="lab-body"><div class="controls"></div><div class="stage ' + (cfg.stageClass || '') + '"></div></div><div class="tiles"></div>' +
      (cfg.caption ? '<figcaption>' + cfg.caption + '</figcaption>' : '');
    var ctrl = $('.controls', root), tiles = $('.tiles', root);
    lab.stage = $('.stage', root);
    function changed(name) { if (lab.onParam) lab.onParam(name); lab.draw(); }

    (cfg.controls || []).forEach(function (c) {
      if (c.type === 'range') {
        var map = c.map || function (x) { return x; }, fmt = c.fmt || String;
        var w = el('label', 'ctl', '<span class="ctl-top"><span class="ctl-l">' + c.label + '</span><output></output></span>');
        var inp = el('input');
        inp.type = 'range'; inp.min = c.min; inp.max = c.max; inp.step = c.step; inp.value = c.value;
        w.appendChild(inp);
        if (c.hint) w.appendChild(el('span', 'ctl-hint', c.hint));
        var out = $('output', w);
        var read = function () { lab.v[c.name] = map(parseFloat(inp.value)); out.textContent = fmt(lab.v[c.name]); };
        inp.addEventListener('input', function () { read(); changed(c.name); });
        read();
        lab.inputs[c.name] = { input: inp, read: read };
        ctrl.appendChild(w);
      } else if (c.type === 'button') {
        var b = el('button', 'btn' + (c.primary ? ' primary' : '') + (c.quiet ? ' quiet' : ''), c.label);
        b.type = 'button';
        b.addEventListener('click', function () { if (lab.handlers[c.name]) lab.handlers[c.name](); });
        ctrl.appendChild(b);
      } else if (c.type === 'seg') {
        var g = el('div', 'seg');
        g.setAttribute('role', 'group');
        g.setAttribute('aria-label', c.label);
        lab.v[c.name] = c.value;
        c.options.forEach(function (o) {
          var sb = el('button', '', o[1]);
          sb.type = 'button';
          sb.setAttribute('aria-pressed', String(o[0] === c.value));
          sb.addEventListener('click', function () {
            lab.v[c.name] = o[0];
            $$('button', g).forEach(function (x) { x.setAttribute('aria-pressed', String(x === sb)); });
            changed(c.name);
          });
          g.appendChild(sb);
        });
        if (c.showLabel) ctrl.appendChild(el('span', 'ctl-l seg-l', c.label));
        ctrl.appendChild(g);
      } else if (c.type === 'check') {
        var cw = el('label', 'chk', '<input type="checkbox"' + (c.value ? ' checked' : '') + '><span>' + c.label + '</span>');
        var cb = $('input', cw);
        lab.v[c.name] = !!c.value;
        cb.addEventListener('change', function () { lab.v[c.name] = cb.checked; changed(c.name); });
        ctrl.appendChild(cw);
      }
    });

    (cfg.canvases || []).forEach(function (c) {
      var wrap = el('div', 'plot ' + (c.cls || ''));
      if (c.title) wrap.appendChild(el('p', 'plot-title', c.title));
      var cv = el('canvas');
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', c.aria);
      if (c.h) cv.style.height = c.h + 'px';
      wrap.appendChild(cv);
      lab.stage.appendChild(wrap);
      lab.c[c.name] = cv;
    });

    (cfg.tiles || []).forEach(function (t) {
      var d = el('div', 'tile', '<span class="tv">.</span><span class="tl">' + t[1] + '</span>');
      tiles.appendChild(d);
      lab.tiles[t[0]] = $('.tv', d);
      lab.labels[t[0]] = $('.tl', d);
    });
    lab.tile = function (name, text, label) { lab.tiles[name].textContent = text; if (label != null) lab.labels[name].textContent = label; };
    lab.on = function (name, fn) { lab.handlers[name] = fn; };
    labs.push(lab);
    return lab;
  }
  function logSlider(name, label, lo, hi, value, hint) {
    return { type: 'range', name: name, label: label, min: lo, max: hi, step: 0.02, value: Math.log10(value), map: function (x) { return Math.pow(10, x); }, fmt: F.d2, hint: hint };
  }

  /* ---------- hero: a Galton board ---------- */
  function galton() {
    var cv = $('#galton'), ROWS = 10, BEADS = 180, beads = [], start = 0, raf = 0, seed = 11, running = false;
    function reset() {
      running = true;
      var u = DL.rng(seed++);
      beads = [];
      for (var i = 0; i < BEADS; i++) {
        var path = [0], pos = 0;
        for (var r = 0; r < ROWS; r++) { pos += u() < 0.5 ? -0.5 : 0.5; path.push(pos); }
        beads.push({ path: path, t0: i * 34 });
      }
      start = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      var s = DL.setup(cv), ctx = s.ctx, W = s.w, H = s.h;
      var top = 10, rowH = (H * 0.5) / ROWS, cx = W / 2, dx = Math.min((W - 20) / (ROWS + 1), 36);
      var binTop = top + rowH * ROWS + 8, binH = H - binTop - 4, t = now - start, active = false, i, r;
      var counts = new Array(ROWS + 1).fill(0);
      ctx.fillStyle = DL.css('--ref');
      for (r = 0; r < ROWS; r++) for (i = 0; i <= r; i++) { ctx.beginPath(); ctx.arc(cx + (i - r / 2) * dx, top + (r + 0.5) * rowH, 2, 0, 6.2832); ctx.fill(); }
      ctx.fillStyle = DL.css('--c1');
      beads.forEach(function (b) {
        var e = (t - b.t0) / 75;
        if (e < 0) { active = true; return; }
        if (e >= ROWS) { counts[b.path[ROWS] + ROWS / 2]++; return; }
        active = true;
        var k = Math.floor(e), f = e - k, hop = Math.sin(f * Math.PI) * rowH * 0.18;
        ctx.beginPath(); ctx.arc(cx + (b.path[k] + (b.path[k + 1] - b.path[k]) * f) * dx, top + (k + f) * rowH - hop, 3.2, 0, 6.2832); ctx.fill();
      });
      var unit = Math.min(binH / (BEADS * 0.27), 6), bw = dx * 0.78;
      for (i = 0; i <= ROWS; i++) {
        if (!counts[i]) continue;
        var x = cx + (i - ROWS / 2) * dx, h = counts[i] * unit;
        ctx.globalAlpha = 0.9; ctx.fillRect(x - bw / 2, binTop + binH - h, bw, h); ctx.globalAlpha = 1;
      }
      if (!active) {
        ctx.strokeStyle = DL.css('--c2'); ctx.lineWidth = 2.25; ctx.beginPath();
        for (i = 0; i <= ROWS; i++) {
          var y = binTop + binH - BEADS * DL.pmfBinom(i, ROWS, 0.5) * unit, xx = cx + (i - ROWS / 2) * dx;
          if (i) ctx.lineTo(xx, y); else ctx.moveTo(xx, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = DL.css('--axis'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - (ROWS / 2 + 0.6) * dx, binTop + binH + 0.5); ctx.lineTo(cx + (ROWS / 2 + 0.6) * dx, binTop + binH + 0.5); ctx.stroke();
      running = active;
      if (active) raf = requestAnimationFrame(frame);
    }
    $('#galton-again').addEventListener('click', reset);
    // on a resize or a theme change, repaint the finished board; a running animation repaints itself
    labs.push({ draw: function () { if (start && !running) frame(start + 1e7); } });
    reset();
  }

  /* ---------- lesson 0: what a distribution is ---------- */
  function labDips() {
    var M = 3, K = 1.2, TOP = 12;
    var lab = makeLab('lab-dips', {
      title: 'Dip, count, repeat',
      legend: [['sim', 'Your dips'], ['theory', 'Long-run shape']],
      controls: [
        { type: 'button', name: 'one', label: 'Take 1 dip' },
        { type: 'button', name: 'twenty', label: 'Take 20 dips', primary: true },
        { type: 'button', name: 'many', label: 'Take 500 dips' },
        { type: 'check', name: 'show', label: 'Show the long-run shape', value: false },
        { type: 'button', name: 'reset', label: 'Start over', quiet: true }
      ],
      canvases: [{ name: 'hist', h: 300, aria: 'Bar chart of how often each larval count turned up in your dips' }],
      tiles: [['n', 'dips taken'], ['mean', 'mean per dip'], ['var', 'variance'], ['zero', 'dips with no larvae']],
      caption: 'Each bar is the share of your dips that caught that many larvae. With few dips the bars jump around. With many, they settle into a fixed shape: the distribution.'
    });
    var chips = el('p', 'chips');
    lab.stage.insertBefore(chips, lab.stage.firstChild);
    var counts = [], recent = [], u = DL.rng(101), timer = 0, theory = [], acc = 0, k;
    for (k = 0; k <= TOP; k++) { theory.push(DL.pmfNB(k, M, K)); acc += theory[k]; }
    theory.push(1 - acc);
    function add(n) { for (var i = 0; i < n; i++) { var c = DL.rNB(u, M, K); counts.push(c); recent.push(c); } recent = recent.slice(-12); }
    function take(n) {
      clearInterval(timer);
      if (n === 1) { add(1); lab.draw(); return; }
      var steps = Math.min(n, 25), per = n / steps, done = 0;
      timer = setInterval(function () { add(per); done++; lab.draw(); if (done >= steps) clearInterval(timer); }, 42);
    }
    lab.on('one', function () { take(1); });
    lab.on('twenty', function () { take(20); });
    lab.on('many', function () { take(500); });
    lab.on('reset', function () { clearInterval(timer); counts = []; recent = []; lab.draw(); });
    lab.draw = function () {
      var n = counts.length, sh = DL.tally(counts, TOP + 1), xs = range(0, TOP + 1);
      var layers = [{ type: 'bars', xs: xs, ys: sh, w: 0.8, color: '--c1' }];
      if (lab.v.show) layers.push({ type: 'line', xs: xs, ys: theory, color: '--c2', dots: 3 });
      DL.plot(lab.c.hist, {
        x: { min: -0.7, max: TOP + 1.7, ticks: [0, 2, 4, 6, 8, 10, 12, 13], tickLabels: { 13: '13+' }, label: 'Larvae counted in one dip' },
        y: { min: 0, max: Math.max(0.32, maxOf(sh) * 1.12), pct: true, label: 'Share of dips' }, layers: layers
      });
      chips.innerHTML = n ? 'Latest dips: ' + recent.map(function (c) { return '<span>' + c + '</span>'; }).join('') : 'No dips yet. Press a button to start.';
      lab.tile('n', F.int(n));
      lab.tile('mean', n ? F.d2(DL.mean(counts)) : '.');
      lab.tile('var', n > 1 ? F.d1(DL.variance(counts)) : '.');
      lab.tile('zero', n ? F.pct(sh[0]) : '.');
    };
    DL.hover(lab.c.hist, function (xv) {
      var c = Math.round(xv);
      if (c < 0 || c > TOP + 1 || !counts.length) return null;
      return { x: c, html: '<b>' + (c > TOP ? '13 or more' : c) + ' larvae</b><br>Your dips: ' + F.pct(DL.tally(counts, TOP + 1)[c]) + (lab.v.show ? '<br>Long run: ' + F.pct(theory[c]) : '') };
    });
    add(6);
  }

  /* ---------- lesson 1: binomial ---------- */
  function labBinom() {
    var NS = 300, seed = 201, sample = null;
    var lab = makeLab('lab-binom', {
      title: 'Positive dips out of n',
      legend: [['sim', '300 simulated habitats'], ['theory', 'Binomial']],
      controls: [
        { type: 'range', name: 'n', label: 'Dips per habitat', min: 5, max: 50, step: 1, value: 20, fmt: F.int },
        { type: 'range', name: 'p', label: 'Chance a dip is positive', min: 0.02, max: 0.98, step: 0.01, value: 0.25, fmt: F.pct },
        { type: 'button', name: 'run', label: 'Survey 300 new habitats', primary: true }
      ],
      canvases: [{ name: 'pmf', h: 300, aria: 'Bar chart of the number of positive dips per habitat, with the binomial distribution drawn over it' }],
      tiles: [['exp', 'positive dips expected'], ['sd', 'typical spread (standard deviation)'], ['p0', 'habitats with no positive dip'], ['p1', 'habitats with at least one']],
      caption: 'Every simulated habitat gets the same number of dips, and every dip has the same chance of holding larvae.'
    });
    function resample() { var u = DL.rng(seed); sample = []; for (var i = 0; i < NS; i++) sample.push(DL.rBinom(u, lab.v.n, lab.v.p)); }
    lab.on('run', function () { seed++; resample(); lab.draw(); });
    lab.onParam = resample;
    function theory() { return range(0, lab.v.n).map(function (k) { return DL.pmfBinom(k, lab.v.n, lab.v.p); }); }
    lab.draw = function () {
      var n = lab.v.n, p = lab.v.p, xs = range(0, n), th = theory(), sh = DL.tally(sample, n);
      DL.plot(lab.c.pmf, {
        x: { min: -0.7, max: n + 0.7, label: 'Positive dips in one habitat', n: 8 },
        y: { min: 0, max: Math.max(maxOf(th), maxOf(sh)) * 1.14, pct: true, label: 'Share of habitats' },
        layers: [{ type: 'bars', xs: xs, ys: sh, w: 0.8, color: '--c1' }, { type: 'line', xs: xs, ys: th, color: '--c2', dots: n > 34 ? 2 : 3 }]
      });
      lab.tile('exp', F.d1(n * p));
      lab.tile('sd', F.d1(Math.sqrt(n * p * (1 - p))));
      lab.tile('p0', F.pct(Math.pow(1 - p, n)));
      lab.tile('p1', F.pct(1 - Math.pow(1 - p, n)));
    };
    DL.hover(lab.c.pmf, function (xv) {
      var k = Math.round(xv);
      if (k < 0 || k > lab.v.n) return null;
      return { x: k, html: '<b>' + k + ' positive dip' + (k === 1 ? '' : 's') + '</b><br>Binomial: ' + F.pct(DL.pmfBinom(k, lab.v.n, lab.v.p)) + '<br>Simulated: ' + F.pct(DL.tally(sample, lab.v.n)[k]) };
    });
    resample();
  }

  function labDetect() {
    var lab = makeLab('lab-detect', {
      title: 'How many dips until you find them?',
      legend: [['theory', 'Chance of at least one positive dip'], ['ref', 'Your target']],
      controls: [
        { type: 'range', name: 'p', label: 'Chance one dip finds larvae', min: 0.01, max: 0.6, step: 0.01, value: 0.1, fmt: F.pct },
        { type: 'seg', name: 'target', label: 'Detection target', showLabel: true, value: '0.95', options: [['0.8', '80%'], ['0.9', '90%'], ['0.95', '95%'], ['0.99', '99%']] }
      ],
      canvases: [{ name: 'curve', h: 280, aria: 'Line chart of the chance of detecting larvae against the number of dips' }],
      tiles: [['need', 'dips needed'], ['p5', 'detection chance with 5 dips'], ['p20', 'detection chance with 20 dips'], ['miss', 'chance that 20 dips all miss']],
      caption: 'The curve climbs fast at first and then flattens. The last few percent of certainty cost the most dips.'
    });
    var need = 1;
    lab.draw = function () {
      var p = lab.v.p, target = parseFloat(lab.v.target);
      need = Math.max(1, Math.ceil(Math.log(1 - target) / Math.log(1 - p) - 1e-9));
      var xmax = Math.max(40, Math.min(480, Math.ceil(need * 1.35 / 10) * 10)), xs = range(0, xmax);
      var ys = xs.map(function (n) { return 1 - Math.pow(1 - p, n); });
      DL.plot(lab.c.curve, {
        x: { min: 0, max: xmax, label: 'Number of dips' },
        y: { min: 0, max: 1.04, pct: true, ticks: [0, 0.25, 0.5, 0.75, 1], label: 'Chance of finding larvae' },
        layers: [
          { type: 'hline', y: target, color: '--ref', dash: [5, 4], label: F.pct(target) + ' target', align: 'right' },
          { type: 'vline', x: need, color: '--ref', dash: [2, 3] },
          { type: 'line', xs: xs, ys: ys, color: '--c2', width: 2.5 },
          { type: 'point', x: need, y: 1 - Math.pow(1 - p, need), color: '--c2', label: need + (need === 1 ? ' dip' : ' dips'), bold: true, dy: 16, dx: 10 }
        ]
      });
      lab.tile('need', F.int(need));
      lab.tile('p5', F.pct(1 - Math.pow(1 - p, 5)));
      lab.tile('p20', F.pct(1 - Math.pow(1 - p, 20)));
      lab.tile('miss', F.pct(Math.pow(1 - p, 20)));
    };
    DL.hover(lab.c.curve, function (xv) {
      var n = Math.max(0, Math.round(xv));
      return { x: n, html: '<b>' + n + ' dips</b><br>Chance of finding larvae: ' + F.pct(1 - Math.pow(1 - lab.v.p, n)) };
    });
  }

  /* ---------- lessons 2 and 3: random or clumped ---------- */
  function labField() {
    var G = 12, seed = 301, pts = [], counts = [], fit = {};
    var lab = makeLab('lab-field', {
      title: 'Scatter larvae over a pond, then dip everywhere',
      legend: [['sim', 'Your 144 dips'], ['alt', 'Poisson, same mean'], ['theory', 'Negative binomial fit']],
      stageClass: 'two',
      controls: [
        { type: 'range', name: 'mean', label: 'Average larvae per dip', min: 0.5, max: 8, step: 0.5, value: 2, fmt: F.d1 },
        { type: 'range', name: 'clump', label: 'Clumping', min: 0, max: 1, step: 0.05, value: 0, fmt: function (v) { return v < 0.01 ? 'none (random)' : v < 0.35 ? 'mild' : v < 0.7 ? 'strong' : 'very strong'; } },
        { type: 'button', name: 'new', label: 'Scatter again', primary: true }
      ],
      canvases: [
        { name: 'field', cls: 'square', title: 'The pond from above. Each square is one dip.', aria: 'Map of larvae scattered over a pond surface divided into 144 squares' },
        { name: 'hist', h: 320, title: 'How many dips caught each count', aria: 'Bar chart of larvae per dip, compared with a Poisson distribution and a negative binomial distribution' }
      ],
      tiles: [['mean', 'mean per dip'], ['var', 'variance'], ['ratio', 'variance to mean ratio (1 = random)'], ['k', 'aggregation k (small = clumped)'], ['zero', 'empty dips']],
      caption: 'Left: darker squares caught more larvae. Right: the same dips as a distribution. Hover over a square or a bar to read it.'
    });
    function scatter() { var u = DL.rng(seed); pts = DL.field(u, lab.v.mean * G * G, lab.v.clump); counts = DL.quadratCounts(pts, G); }
    lab.on('new', function () { seed++; scatter(); lab.draw(); });
    lab.onParam = scatter;
    function drawField() {
      var s = DL.setup(lab.c.field), ctx = s.ctx, W = s.w, H = s.h, cell = W / G, mx = Math.max(1, maxOf(counts)), i;
      ctx.fillStyle = DL.css('--field'); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = DL.css('--c1');
      for (i = 0; i < counts.length; i++) {
        if (!counts[i]) continue;
        ctx.globalAlpha = 0.08 + 0.5 * counts[i] / mx;
        ctx.fillRect((i % G) * cell, Math.floor(i / G) * cell, cell, cell);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = DL.css('--field-line'); ctx.lineWidth = 1; ctx.beginPath();
      for (i = 1; i < G; i++) { var q = Math.round(i * cell) + 0.5; ctx.moveTo(q, 0); ctx.lineTo(q, H); ctx.moveTo(0, q); ctx.lineTo(W, q); }
      ctx.stroke();
      ctx.fillStyle = DL.css('--ink');
      var r = Math.max(1.3, Math.min(2.3, W / 240));
      for (i = 0; i < pts.length; i++) { ctx.beginPath(); ctx.arc(pts[i][0] * W, pts[i][1] * H, r, 0, 6.2832); ctx.fill(); }
    }
    lab.draw = function () {
      drawField();
      var m = DL.mean(counts), v = DL.variance(counts), top = Math.min(45, Math.max(8, maxOf(counts))), xs = range(0, top), sh = shares(counts, top);
      var k = v > m * 1.08 && m > 0 ? m * m / (v - m) : Infinity;
      fit = { m: m, k: k, top: top, sh: sh };
      var po = xs.map(function (x) { return DL.pmfPoisson(x, m); });
      var layers = [{ type: 'bars', xs: xs, ys: sh, w: 0.8, color: '--c1' }, { type: 'line', xs: xs, ys: po, color: '--c3', dash: [6, 4], width: 2.25 }];
      var nb = isFinite(k) ? xs.map(function (x) { return DL.pmfNB(x, m, k); }) : null;
      if (nb) layers.push({ type: 'line', xs: xs, ys: nb, color: '--c2', dots: top > 30 ? 2 : 3 });
      DL.plot(lab.c.hist, {
        x: { min: -0.7, max: top + 0.7, label: 'Larvae in one dip', n: 8 },
        y: { min: 0, max: Math.max(maxOf(sh), maxOf(po)) * 1.14, pct: true, label: 'Share of dips' }, layers: layers
      });
      lab.tile('mean', F.d2(m));
      lab.tile('var', F.d1(v));
      lab.tile('ratio', F.d1(v / m));
      lab.tile('k', isFinite(k) ? F.d2(k) : 'none');
      lab.tile('zero', F.pct(sh[0]), 'empty dips (Poisson expects ' + F.pct(Math.exp(-m)) + ')');
    };
    DL.hover(lab.c.hist, function (xv) {
      var c = Math.round(xv);
      if (c < 0 || c > fit.top) return null;
      return { x: c, html: '<b>' + c + ' larvae</b><br>Your dips: ' + F.pct(fit.sh[c]) + '<br>Poisson: ' + F.pct(DL.pmfPoisson(c, fit.m)) + (isFinite(fit.k) ? '<br>Negative binomial: ' + F.pct(DL.pmfNB(c, fit.m, fit.k)) : '') };
    });
    var tip = DL.tipFor(lab.c.field);
    lab.c.field.addEventListener('pointermove', function (e) {
      var r = lab.c.field.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      var cx = Math.min(G - 1, Math.max(0, Math.floor(px / r.width * G))), cy = Math.min(G - 1, Math.max(0, Math.floor(py / r.height * G))), c = counts[cy * G + cx];
      tip.show(px, py, 'This dip caught <b>' + c + '</b> ' + (c === 1 ? 'larva' : 'larvae'));
    });
    lab.c.field.addEventListener('pointerleave', tip.hide);
    scatter();
  }

  function labNB() {
    var NS = 300, seed = 401, sample = [], top = 10;
    var lab = makeLab('lab-nb', {
      title: 'Shape of the negative binomial',
      legend: [['sim', '300 simulated dips'], ['theory', 'Negative binomial'], ['alt', 'Poisson, same mean']],
      controls: [
        { type: 'range', name: 'mean', label: 'Mean larvae per dip', min: 0.5, max: 20, step: 0.5, value: 4, fmt: F.d1 },
        logSlider('k', 'Aggregation k', -1, 1.3, 0.8, 'Small k: strong clumping. Large k: close to random.'),
        { type: 'check', name: 'pois', label: 'Compare with Poisson', value: true },
        { type: 'button', name: 'run', label: 'Take 300 new dips', primary: true }
      ],
      canvases: [{ name: 'pmf', h: 310, aria: 'Bar chart of simulated larvae per dip with the negative binomial and Poisson distributions drawn over it' }],
      tiles: [['var', 'variance'], ['ratio', 'variance to mean ratio'], ['zero', 'dips with no larvae'], ['need', 'dips needed for a standard error of 20% of the mean']],
      caption: 'Both curves have the same mean. Only the negative binomial can put many dips at zero and a few far to the right at the same time.'
    });
    function resample() { var u = DL.rng(seed); sample = []; for (var i = 0; i < NS; i++) sample.push(DL.rNB(u, lab.v.mean, lab.v.k)); }
    lab.on('run', function () { seed++; resample(); lab.draw(); });
    lab.onParam = function (name) { if (name !== 'pois') resample(); };
    lab.draw = function () {
      var m = lab.v.mean, k = lab.v.k;
      top = Math.min(70, Math.max(8, DL.upper(function (x) { return DL.pmfNB(x, m, k); }, 0.985, 500)));
      var xs = range(0, top), nb = xs.map(function (x) { return DL.pmfNB(x, m, k); }), sh = shares(sample, top);
      var layers = [{ type: 'bars', xs: xs, ys: sh, w: 0.8, color: '--c1' }];
      var ymax = Math.max(maxOf(nb), maxOf(sh));
      if (lab.v.pois) {
        var po = xs.map(function (x) { return DL.pmfPoisson(x, m); });
        layers.push({ type: 'line', xs: xs, ys: po, color: '--c3', dash: [6, 4], width: 2.25 });
        ymax = Math.max(ymax, maxOf(po));
      }
      layers.push({ type: 'line', xs: xs, ys: nb, color: '--c2', dots: top > 34 ? 2 : 3 });
      DL.plot(lab.c.pmf, { x: { min: -0.7, max: top + 0.7, label: 'Larvae in one dip', n: 8 }, y: { min: 0, max: ymax * 1.14, pct: true, label: 'Share of dips' }, layers: layers });
      var v = m + m * m / k;
      lab.tile('var', F.d1(v));
      lab.tile('ratio', F.d1(v / m));
      lab.tile('zero', F.pct(DL.pmfNB(0, m, k)));
      lab.tile('need', F.int(Math.ceil((1 / m + 1 / k) / 0.04)));
    };
    DL.hover(lab.c.pmf, function (xv) {
      var c = Math.round(xv);
      if (c < 0 || c > top) return null;
      return { x: c, html: '<b>' + c + ' larvae</b><br>Negative binomial: ' + F.pct(DL.pmfNB(c, lab.v.mean, lab.v.k)) + (lab.v.pois ? '<br>Poisson: ' + F.pct(DL.pmfPoisson(c, lab.v.mean)) : '') + '<br>Simulated: ' + F.pct(shares(sample, top)[c]) };
    });
    resample();
  }

  /* ---------- lesson 4: zero inflation ---------- */
  function labZI() {
    var NS = 400, seed = 501, sample = [], top = 10;
    var lab = makeLab('lab-zi', {
      title: 'Two kinds of zero',
      legend: [['sim', '400 simulated habitats'], ['theory', 'Zero-inflated negative binomial'], ['zero', 'Zeros from habitats that cannot hold larvae']],
      controls: [
        { type: 'range', name: 'pi', label: 'Habitats that cannot hold larvae', min: 0, max: 0.9, step: 0.05, value: 0.35, fmt: F.pct },
        { type: 'range', name: 'mean', label: 'Mean count where larvae can live', min: 1, max: 30, step: 1, value: 6, fmt: F.int },
        logSlider('k', 'Aggregation k', -0.7, 1, 0.7),
        { type: 'check', name: 'zoom', label: 'Zoom in on the counts above zero', value: false },
        { type: 'button', name: 'run', label: 'Survey 400 new habitats', primary: true }
      ],
      canvases: [{ name: 'pmf', h: 310, aria: 'Bar chart of larval counts per habitat with a tall bar at zero, split into unsuitable habitats and suitable habitats that had no larvae' }],
      tiles: [['z', 'habitats with a zero count'], ['zs', 'zeros from unsuitable habitats'], ['zc', 'zeros from suitable habitats'], ['mean', 'mean count over all habitats']],
      caption: 'The gray block at zero is the share of habitats that cannot hold larvae at all. The rest of the zero bar comes from suitable habitats where the dips happened to find nothing.'
    });
    function resample() { var u = DL.rng(seed); sample = []; for (var i = 0; i < NS; i++) sample.push(DL.rZINB(u, lab.v.pi, lab.v.mean, lab.v.k)); }
    lab.on('run', function () { seed++; resample(); lab.draw(); });
    lab.onParam = function (name) { if (name !== 'zoom') resample(); };
    lab.draw = function () {
      var pi = lab.v.pi, m = lab.v.mean, k = lab.v.k;
      top = Math.min(70, Math.max(8, DL.upper(function (x) { return DL.pmfNB(x, m, k); }, 0.975, 500)));
      var xs = range(0, top), th = xs.map(function (x) { return DL.pmfZINB(x, pi, m, k); }), sh = shares(sample, top);
      var rest = Math.max(maxOf(th.slice(1)), maxOf(sh.slice(1)));
      var ymax = lab.v.zoom ? rest * 1.5 : Math.max(th[0], sh[0], rest) * 1.12;
      DL.plot(lab.c.pmf, {
        x: { min: -0.9, max: top + 0.7, label: 'Larvae counted in one habitat', n: 8 },
        y: { min: 0, max: ymax, pct: true, label: 'Share of habitats' },
        layers: [
          { type: 'bars', xs: xs, ys: sh, w: 0.74, color: '--c1' },
          { type: 'bars', xs: [0], ys: [Math.min(pi, sh[0])], w: 0.74, color: '--zero' },
          { type: 'line', xs: xs, ys: th, color: '--c2', dots: top > 34 ? 2 : 3 },
          lab.v.zoom ? { type: 'text', x: 0, y: ymax, dx: 16, dy: 14, label: 'zero bar continues to ' + F.pct(th[0]) } : null
        ]
      });
      lab.tile('z', F.pct(th[0]));
      lab.tile('zs', F.pct(pi));
      lab.tile('zc', F.pct(th[0] - pi));
      lab.tile('mean', F.d1((1 - pi) * m));
    };
    DL.hover(lab.c.pmf, function (xv) {
      var c = Math.round(xv);
      if (c < 0 || c > top) return null;
      return { x: c, html: '<b>' + c + ' larvae</b><br>Model: ' + F.pct(DL.pmfZINB(c, lab.v.pi, lab.v.mean, lab.v.k)) + '<br>Simulated: ' + F.pct(shares(sample, top)[c]) + (c === 0 ? '<br>Unsuitable habitats: ' + F.pct(lab.v.pi) : '') };
    });
    resample();
  }

  /* ---------- lesson 5: lognormal ---------- */
  function labLognormal() {
    var NS = 400, seed = 601, sample = [];
    var lab = makeLab('lab-lognormal', {
      title: 'A long right tail, and what the logarithm does to it',
      legend: [['sim', '400 simulated habitats'], ['theory', 'Lognormal']],
      controls: [
        { type: 'range', name: 'median', label: 'Median density', min: 1, max: 100, step: 1, value: 20, fmt: F.int },
        { type: 'range', name: 'sigma', label: 'Spread (standard deviation of the logs)', min: 0.2, max: 1.6, step: 0.05, value: 0.9, fmt: F.d2 },
        { type: 'seg', name: 'axis', label: 'Horizontal axis', value: 'lin', options: [['lin', 'Natural scale'], ['log', 'Log scale']] },
        { type: 'button', name: 'run', label: 'Measure 400 new habitats', primary: true }
      ],
      canvases: [{ name: 'pdf', h: 310, aria: 'Histogram of simulated larval densities with the lognormal curve drawn over it' }],
      tiles: [['median', 'median (half the habitats are below this)'], ['mean', 'mean'], ['ratio', 'mean divided by median'], ['top', 'share of all larvae in the densest 10% of habitats']],
      caption: 'On the natural scale the hill leans left with a long tail. Switch to the log scale and the same data form a symmetric bell.'
    });
    function resample() { var u = DL.rng(seed); sample = []; for (var i = 0; i < NS; i++) sample.push(DL.rLognormal(u, Math.log(lab.v.median), lab.v.sigma)); }
    lab.on('run', function () { seed++; resample(); lab.draw(); });
    lab.onParam = function (name) { if (name !== 'axis') resample(); };
    lab.draw = function () {
      var med = lab.v.median, sg = lab.v.sigma, mu = Math.log(med), mean = Math.exp(mu + sg * sg / 2), B = 30, i;
      var edges = [], h = new Array(B).fill(0), cx = [], cy = [], dens, spec;
      if (lab.v.axis === 'lin') {
        var xmax = Math.exp(mu + 2.2 * sg), bw = xmax / B;
        sample.forEach(function (v) { var b = Math.floor(v / bw); if (b < B) h[b]++; });
        for (i = 0; i < B; i++) edges.push([i * bw, (i + 1) * bw]);
        dens = h.map(function (c) { return c / (NS * bw); });
        for (i = 1; i <= 240; i++) { var x = xmax * i / 240; cx.push(x); cy.push(DL.pdfLognormal(x, mu, sg)); }
        spec = { x: { min: 0, max: xmax, label: 'Larval density (for example, larvae per litre)' } };
      } else {
        var a = (mu - 3.2 * sg) / Math.LN10, b2 = (mu + 3.2 * sg) / Math.LN10, lw = (b2 - a) / B;
        sample.forEach(function (v) { var b = Math.floor((Math.log10(v) - a) / lw); if (b >= 0 && b < B) h[b]++; });
        for (i = 0; i < B; i++) edges.push([Math.pow(10, a + i * lw), Math.pow(10, a + (i + 1) * lw)]);
        dens = h.map(function (c) { return c / (NS * lw); });
        for (i = 0; i <= 240; i++) { var t = a + (b2 - a) * i / 240; cx.push(Math.pow(10, t)); cy.push(DL.pdfNormal(t * Math.LN10, mu, sg) * Math.LN10); }
        spec = { x: { min: Math.pow(10, a), max: Math.pow(10, b2), log: true, label: 'Larval density, log scale: each step multiplies by the same factor' } };
      }
      spec.y = { min: 0, max: Math.max(maxOf(cy), maxOf(dens)) * 1.16, hideTicks: true, label: 'Share of habitats (taller = more common)' };
      spec.layers = [
        { type: 'bars', edges: edges, ys: dens, color: '--c1' },
        { type: 'line', xs: cx, ys: cy, color: '--c2', width: 2.5 },
        { type: 'vline', x: med, color: '--ink', dash: [2, 3], label: 'median', align: 'right', labelY: 4 },
        { type: 'vline', x: mean, color: '--ink', label: 'mean', labelY: 24 }
      ];
      DL.plot(lab.c.pdf, spec);
      lab.tile('median', F.d1(med));
      lab.tile('mean', F.d1(mean));
      lab.tile('ratio', F.d2(mean / med));
      lab.tile('top', F.pct(1 - DL.cdfNormal(1.2815515655 - sg)));
    };
    resample();
  }

  /* ---------- lesson 6: survival ---------- */
  function labSurvival() {
    var NS = 300, DAYS = 45, seed = 701, lives = [];
    var lab = makeLab('lab-survival', {
      title: 'A cohort of adult mosquitoes, day by day',
      legend: [['sim', '300 simulated mosquitoes still alive'], ['theory', 'Expected share alive'], ['band', 'Old enough to transmit']],
      controls: [
        { type: 'range', name: 'p', label: 'Chance of surviving one day', min: 0.6, max: 0.98, step: 0.01, value: 0.85, fmt: F.pct },
        { type: 'range', name: 'n', label: 'Days the parasite needs inside the mosquito', min: 5, max: 20, step: 1, value: 10, fmt: F.int },
        { type: 'button', name: 'run', label: 'Release 300 new mosquitoes', primary: true }
      ],
      canvases: [{ name: 'curve', h: 300, aria: 'Chart of the share of mosquitoes still alive on each day after emergence' }],
      tiles: [['alive', 'live long enough to transmit'], ['life', 'average life in days'], ['half', 'days until half are dead'], ['inf', 'infective days per mosquito that emerges']],
      caption: 'Move daily survival by a few points and watch the share that reaches the shaded zone. That steep response is why adult survival matters so much for transmission.'
    });
    function resample() { var u = DL.rng(seed); lives = []; for (var i = 0; i < NS; i++) lives.push(DL.rLifeDays(u, lab.v.p)); }
    lab.on('run', function () { seed++; resample(); lab.draw(); });
    lab.onParam = function (name) { if (name === 'p') resample(); };
    function alive(t) { var c = 0; for (var i = 0; i < lives.length; i++) if (lives[i] >= t) c++; return c / lives.length; }
    lab.draw = function () {
      var p = lab.v.p, n = lab.v.n, xs = range(0, DAYS);
      DL.plot(lab.c.curve, {
        x: { min: -0.7, max: DAYS + 0.7, label: 'Days since emergence', n: 9 },
        y: { min: 0, max: 1.04, pct: true, ticks: [0, 0.25, 0.5, 0.75, 1], label: 'Share still alive' },
        layers: [
          { type: 'band', x0: n - 0.5, x1: DAYS + 0.7, color: '--c3', alpha: 0.13 },
          { type: 'bars', xs: xs, ys: xs.map(alive), w: 0.8, color: '--c1' },
          { type: 'line', xs: xs, ys: xs.map(function (t) { return Math.pow(p, t); }), color: '--c2', dots: 2.5 },
          { type: 'vline', x: n - 0.5, color: '--c3', label: 'parasite ready on day ' + n, labelY: 4 }
        ]
      });
      lab.tile('alive', F.pct(Math.pow(p, n)));
      lab.tile('life', F.d1(-1 / Math.log(p)));
      lab.tile('half', F.d1(Math.log(0.5) / Math.log(p)));
      lab.tile('inf', F.d2(Math.pow(p, n) / -Math.log(p)));
    };
    DL.hover(lab.c.curve, function (xv) {
      var t = Math.round(xv);
      if (t < 0 || t > DAYS) return null;
      return { x: t, html: '<b>Day ' + t + '</b><br>Expected alive: ' + F.pct(Math.pow(lab.v.p, t)) + '<br>Simulated alive: ' + F.pct(alive(t)) };
    });
    resample();
  }

  /* ---------- lesson 7: beta ---------- */
  function labBeta() {
    var lab = makeLab('lab-beta', {
      title: 'What the survey says about the true share',
      legend: [['theory', 'Plausibility of each true share'], ['band', 'Middle 95%']],
      controls: [
        { type: 'range', name: 'n', label: 'Habitats checked', min: 5, max: 200, step: 1, value: 20, fmt: F.int },
        { type: 'range', name: 'x', label: 'Habitats found positive', min: 0, max: 20, step: 1, value: 3, fmt: F.int }
      ],
      canvases: [{ name: 'pdf', h: 290, aria: 'Curve showing which true shares of positive habitats are plausible after the survey' }],
      tiles: [['obs', 'share positive in the sample'], ['ci', 'plausible range for the true share (95%)'], ['w', 'width of that range']],
      caption: 'The curve is a beta distribution. Its peak sits at the share you observed, and its width is your uncertainty. Check more habitats and it narrows.'
    });
    lab.onParam = function (name) {
      if (name !== 'n') return;
      var xi = lab.inputs.x;
      xi.input.max = lab.v.n;
      if (parseFloat(xi.input.value) > lab.v.n) xi.input.value = lab.v.n;
      xi.read();
    };
    lab.draw = function () {
      var n = lab.v.n, x = Math.min(lab.v.x, n), a = x + 1, b = n - x + 1, q = DL.betaQuantiles(a, b, [0.025, 0.975]);
      var xs = [], ys = [], bx = [], by = [], i;
      for (i = 0; i <= 500; i++) {
        var t = i / 500, d = DL.pdfBeta(t, a, b);
        xs.push(t); ys.push(d);
        if (t >= q[0] && t <= q[1]) { bx.push(t); by.push(d); }
      }
      DL.plot(lab.c.pdf, {
        x: { min: 0, max: 1, pct: true, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: 'True share of habitats that are positive' },
        y: { min: 0, max: maxOf(ys) * 1.16, hideTicks: true, label: 'Plausibility (taller = more plausible)' },
        layers: [
          bx.length > 1 ? { type: 'line', xs: bx, ys: by, color: '--c3', fill: 0.2, width: 0 } : null,
          { type: 'line', xs: xs, ys: ys, color: '--c2', width: 2.5 },
          { type: 'vline', x: x / n, color: '--ink', dash: [2, 3], label: 'observed ' + F.pct(x / n), align: x / n > 0.7 ? 'right' : 'left' }
        ]
      });
      lab.tile('obs', x + ' of ' + n + ' = ' + F.pct(x / n));
      lab.tile('ci', F.pct(q[0]) + ' to ' + F.pct(q[1]));
      lab.tile('w', (100 * (q[1] - q[0])).toFixed(0) + ' points');
    };
  }

  /* ---------- lesson 8: central limit theorem ---------- */
  function labCLT() {
    var SIZES = [1, 2, 5, 10, 30, 100], MEAN = 5, R = 1000, seed = 801, means = [], timer = 0;
    var lab = makeLab('lab-clt', {
      title: 'From one skewed count to the average of many',
      legend: [['sim', 'Averages from simulated surveys'], ['theory', 'Normal curve predicted by the theorem']],
      stageClass: 'two',
      controls: [
        { type: 'range', name: 'n', label: 'Habitats averaged in one survey', min: 0, max: 5, step: 1, value: 3, map: function (i) { return SIZES[i]; }, fmt: F.int },
        logSlider('k', 'Aggregation k of single counts', -0.5, 0.7, 0.6, 'Smaller k means more skew in single counts.'),
        { type: 'button', name: 'run', label: 'Run 1,000 new surveys', primary: true }
      ],
      canvases: [
        { name: 'pop', h: 280, title: 'One habitat: the count is strongly skewed', aria: 'Distribution of the larval count in a single habitat' },
        { name: 'means', h: 280, title: 'One survey: the average over its habitats', aria: 'Histogram of survey averages with a normal curve drawn over it' }
      ],
      tiles: [['mu', 'true mean count'], ['sd1', 'spread of single counts'], ['pred', 'predicted spread of the averages'], ['obs', 'spread of the simulated averages']],
      caption: 'Left: counts in single habitats, far from a bell. Right: averages over n habitats. Raise n and the averages pull together into a bell around the true mean.'
    });
    function simulate(animate) {
      clearInterval(timer);
      var u = DL.rng(seed), n = lab.v.n, k = lab.v.k, all = [], i, j;
      for (i = 0; i < R; i++) { var s = 0; for (j = 0; j < n; j++) s += DL.rNB(u, MEAN, k); all.push(s / n); }
      if (!animate) { means = all; return; }
      means = [];
      timer = setInterval(function () { means = all.slice(0, means.length + 100); lab.draw(); if (means.length >= R) clearInterval(timer); }, 70);
    }
    lab.on('run', function () { seed++; simulate(true); });
    lab.onParam = function () { simulate(false); };
    lab.draw = function () {
      var n = lab.v.n, k = lab.v.k, v = MEAN + MEAN * MEAN / k, sd = Math.sqrt(v / n), i;
      var top = Math.min(60, Math.max(10, DL.upper(function (x) { return DL.pmfNB(x, MEAN, k); }, 0.98, 400))), xs = range(0, top);
      var pm = xs.map(function (x) { return DL.pmfNB(x, MEAN, k); });
      DL.plot(lab.c.pop, {
        x: { min: -0.7, max: top + 0.7, label: 'Larvae counted in one habitat', n: 6 }, y: { min: 0, max: maxOf(pm) * 1.14, pct: true, label: 'Share of habitats' },
        layers: [{ type: 'line', xs: xs, ys: pm, color: '--c2', dots: top > 34 ? 2 : 3, fill: 0.14 }, { type: 'vline', x: MEAN, color: '--ink', dash: [2, 3], label: 'mean ' + MEAN }]
      });
      var lo = Math.max(0, MEAN - 4 * sd), hi = n === 1 ? top + 0.5 : MEAN + 4.6 * sd;
      var bw = Math.max(1, Math.ceil((hi - lo) / 34 * n)) / n, B = Math.ceil((hi - lo) / bw), h = new Array(B).fill(0), edges = [], cx = [], cy = [];
      lo = Math.max(0, Math.floor(lo / bw) * bw) - (n === 1 ? 0.5 : bw / 2);
      means.forEach(function (m) { var b = Math.floor((m - lo) / bw); if (b >= 0 && b < B) h[b]++; });
      for (i = 0; i < B; i++) edges.push([lo + i * bw, lo + (i + 1) * bw]);
      var dens = h.map(function (c) { return means.length ? c / (means.length * bw) : 0; });
      for (i = 0; i <= 200; i++) { var x = lo + (B * bw) * i / 200; cx.push(x); cy.push(DL.pdfNormal(x, MEAN, sd)); }
      DL.plot(lab.c.means, {
        x: { min: lo, max: lo + B * bw, label: 'Average larvae per habitat in one survey', n: 6 },
        y: { min: 0, max: Math.max(maxOf(cy), maxOf(dens)) * 1.16, hideTicks: true, label: 'Share of surveys' },
        layers: [{ type: 'bars', edges: edges, ys: dens, color: '--c1' }, { type: 'line', xs: cx, ys: cy, color: '--c2', width: 2.5 }, { type: 'vline', x: MEAN, color: '--ink', dash: [2, 3] }]
      });
      lab.tile('mu', F.d1(MEAN));
      lab.tile('sd1', F.d1(Math.sqrt(v)));
      lab.tile('pred', F.d2(sd));
      lab.tile('obs', means.length > 1 ? F.d2(Math.sqrt(DL.variance(means))) : '.');
    };
    simulate(false);
  }

  /* ---------- lesson 9: bootstrap and permutation ---------- */
  function labResample() {
    var N = 60, HALF = 30, R = 2000, seed = 901, round = 0, counts = [], zl = [], noise = [], order = [], obs = 0, dist = [];
    var lab = makeLab('lab-resample', {
      title: 'One survey, two questions',
      legend: [['sim', '2,000 resampled values'], ['theory', 'Value in your survey'], ['band', 'Shaded: see the tiles below']],
      controls: [
        { type: 'range', name: 'skill', label: 'Ranking skill', min: 0, max: 0.95, step: 0.05, value: 0.5, fmt: function (v) { return v < 0.01 ? 'none (random)' : F.d2(v); }, hint: '0 is a ranking that knows nothing. Near 1 it almost matches the true order.' },
        { type: 'seg', name: 'mode', label: 'Question', value: 'boot', options: [['boot', 'How precise? (bootstrap)'], ['perm', 'Better than chance? (permutation)']] },
        { type: 'button', name: 'again', label: 'Resample again' },
        { type: 'button', name: 'new', label: 'New survey of 60 habitats', primary: true }
      ],
      canvases: [
        { name: 'strip', h: 130, title: 'Your survey: 60 habitats in the model\'s ranked order. Bar height is the larvae counted.', aria: 'Bars for 60 habitats in ranked order, the top-ranked half highlighted' },
        { name: 'hist', h: 250, title: 'Share of larvae in the top-ranked half, over 2,000 resamples', aria: 'Histogram of the resampled statistic with the observed value marked' }
      ],
      tiles: [['obs', 'of larvae are in the top-ranked half'], ['res', 'bootstrap 95% interval'], ['rnd', 'expected under random order'], ['r', 'resamples']],
      caption: 'Bootstrap: resample the habitats with replacement and recompute. Permutation: shuffle the ranking so it carries no information and recompute.'
    });
    function survey() {
      var u = DL.rng(seed), i;
      counts = []; noise = [];
      for (i = 0; i < N; i++) { counts.push(DL.rZINB(u, 0.25, 12, 0.6)); noise.push(DL.rNormal(u)); }
      var l = counts.map(function (c) { return Math.log(1 + c); }), m = DL.mean(l), sd = Math.sqrt(DL.variance(l)) || 1;
      zl = l.map(function (v) { return (v - m) / sd; });
    }
    function rank() {
      var s = lab.v.skill, sc = counts.map(function (c, i) { return s * zl[i] + Math.sqrt(1 - s * s) * noise[i]; });
      order = range(0, N - 1).sort(function (a, b) { return sc[b] - sc[a]; });
      obs = DL.topShare(counts, order, HALF);
      var u = DL.rng(seed * 7919 + round * 104729 + 17), pos = new Array(N), r, i;
      for (i = 0; i < N; i++) pos[order[i]] = i;
      dist = [];
      for (r = 0; r < R; r++) {
        var idx;
        if (lab.v.mode === 'boot') {
          idx = [];
          for (i = 0; i < N; i++) idx.push(Math.floor(u() * N));
          idx.sort(function (a, b) { return pos[a] - pos[b]; });
        } else {
          idx = DL.shuffle(u, range(0, N - 1));
        }
        var t = DL.topShare(counts, idx, HALF);
        if (isFinite(t)) dist.push(t);
      }
      dist.sort(function (a, b) { return a - b; });
    }
    lab.on('new', function () { seed++; round = 0; survey(); rank(); lab.draw(); });
    lab.on('again', function () { round++; rank(); lab.draw(); });
    lab.onParam = rank;
    lab.draw = function () {
      var boot = lab.v.mode === 'boot', i;
      DL.plot(lab.c.strip, {
        x: { min: 0.3, max: N + 0.7, ticks: [1, 10, 20, 30, 40, 50, 60], label: 'Rank given by the model (1 = treat first)' },
        y: { min: 0, max: Math.max(5, maxOf(counts)) * 1.1, hideTicks: true },
        layers: [
          { type: 'bars', xs: range(1, N), ys: order.map(function (o) { return counts[o]; }), w: 0.8, colors: range(1, N).map(function (r) { return r <= HALF ? '--c1' : '--zero'; }) },
          { type: 'vline', x: HALF + 0.5, color: '--ref', dash: [4, 3], label: 'top half', align: 'right' }
        ]
      });
      var lo = Math.min(0.2, Math.floor(Math.min(dist[0], obs) * 20) / 20), bw = 0.02, B = Math.round((1 - lo) / bw), h = new Array(B).fill(0), edges = [];
      dist.forEach(function (t) { h[Math.min(B - 1, Math.floor((t - lo) / bw))]++; });
      for (i = 0; i < B; i++) edges.push([lo + i * bw, lo + (i + 1) * bw]);
      var sh = h.map(function (c) { return c / dist.length; }), q = [DL.quantile(dist, 0.025), DL.quantile(dist, 0.975)];
      var ge = dist.filter(function (t) { return t >= obs - 1e-12; }).length, pv = (ge + 1) / (dist.length + 1);
      DL.plot(lab.c.hist, {
        x: { min: lo, max: 1, pct: true, label: 'Share of larvae in the top-ranked half of habitats' },
        y: { min: 0, max: maxOf(sh) * 1.2, pct: true, label: 'Share of resamples' },
        layers: [
          boot ? { type: 'band', x0: q[0], x1: q[1], color: '--c3', alpha: 0.16 } : { type: 'band', x0: obs, x1: 1, color: '--c3', alpha: 0.16 },
          { type: 'bars', edges: edges, ys: sh, color: '--c1' },
          boot ? null : { type: 'vline', x: 0.5, color: '--ref', dash: [5, 4], label: 'random order', align: 'right', labelY: 24 },
          { type: 'vline', x: obs, color: '--c2', width: 2.5, label: 'your survey ' + F.pct(obs), bold: true, align: obs > 0.8 ? 'right' : 'left', labelY: 4 }
        ]
      });
      lab.tile('obs', F.pct(obs));
      if (boot) lab.tile('res', F.pct(q[0]) + ' to ' + F.pct(q[1]), 'bootstrap 95% interval (shaded)');
      else lab.tile('res', pv < 0.001 ? 'below 0.001' : pv.toFixed(3), 'P value: share of shuffles at or above your survey (shaded)');
      lab.tile('rnd', '50%');
      lab.tile('r', F.int(dist.length));
    };
    survey();
    rank();
  }

  /* ---------- lesson 10: concentration ---------- */
  function labConcentration() {
    var N = 400, MEAN = 20, seed = 1001, cc = null, counts = [];
    var lab = makeLab('lab-concentration', {
      title: 'Where are the larvae?',
      legend: [['theory', 'Most productive habitats first (the ceiling)'], ['ref', 'Random order'], ['band', 'Habitats you treat']],
      controls: [
        { type: 'range', name: 'top', label: 'Habitats you can treat', min: 0.05, max: 1, step: 0.05, value: 0.2, fmt: F.pct },
        { type: 'range', name: 'pi', label: 'Habitats with no larvae at all', min: 0, max: 0.8, step: 0.05, value: 0.3, fmt: F.pct },
        logSlider('k', 'Aggregation k among the rest', -0.7, 0.7, 0.6, 'Smaller k: a few habitats hold most of the larvae.'),
        { type: 'button', name: 'new', label: 'New survey of 400 habitats', primary: true }
      ],
      canvases: [{ name: 'curve', h: 330, aria: 'Coverage curve: share of larvae covered against share of habitats treated, most productive first, compared with random order' }],
      tiles: [['hold', 'of larvae are in the habitats you treat'], ['rand', 'if you picked habitats at random'], ['need', 'of habitats hold 80% of the larvae'], ['gini', 'Gini coefficient (0 = even, 1 = all in one)']],
      caption: 'Sort the habitats from most to least productive and add up the larvae. The more clumped the counts, the higher the curve bulges above the diagonal.'
    });
    function survey() { var u = DL.rng(seed); counts = []; for (var i = 0; i < N; i++) counts.push(DL.rZINB(u, lab.v.pi, MEAN, lab.v.k)); cc = DL.concentration(counts); }
    lab.on('new', function () { seed++; survey(); lab.draw(); });
    lab.onParam = function (name) { if (name !== 'top') survey(); };
    lab.draw = function () {
      var top = lab.v.top, y = cc.y[Math.round(top * N)], need = 0;
      while (need < N && cc.y[need] < 0.8) need++;
      DL.plot(lab.c.curve, {
        x: { min: 0, max: 1, pct: true, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: 'Habitats treated, most productive first' },
        y: { min: 0, max: 1.04, pct: true, ticks: [0, 0.25, 0.5, 0.75, 1], label: 'Share of all larvae covered' },
        layers: [
          { type: 'band', x0: 0, x1: top, color: '--c3', alpha: 0.13 },
          { type: 'line', xs: [0, 1], ys: [0, 1], color: '--ref', dash: [6, 4], width: 2 },
          { type: 'line', xs: cc.x, ys: cc.y, color: '--c2', width: 2.75 },
          { type: 'point', x: top, y: top, color: '--ref', r: 4 },
          { type: 'point', x: top, y: y, color: '--c2', label: F.pct(y) + ' of larvae', bold: true, dx: top > 0.7 ? -10 : 10, dy: 16, align: top > 0.7 ? 'right' : 'left' }
        ]
      });
      lab.tile('hold', F.pct(y));
      lab.tile('rand', F.pct(top));
      lab.tile('need', F.pct(need / N));
      lab.tile('gini', F.d2(cc.gini));
    };
    DL.hover(lab.c.curve, function (xv) {
      var i = Math.max(0, Math.min(N, Math.round(xv * N)));
      return { x: i / N, html: '<b>Top ' + F.pct(i / N) + ' of habitats</b><br>hold ' + F.pct(cc.y[i]) + ' of the larvae<br>Random order: ' + F.pct(i / N) };
    });
    survey();
  }

  /* ---------- page furniture ---------- */
  function quizzes() {
    $$('.quiz').forEach(function (q) {
      var right = parseInt(q.getAttribute('data-answer'), 10), fb = $('.fb', q), opts = $$('button', q);
      opts.forEach(function (b, i) {
        b.addEventListener('click', function () {
          opts.forEach(function (o) { o.classList.remove('yes', 'no'); });
          b.classList.add(i === right ? 'yes' : 'no');
          fb.textContent = (i === right ? 'Correct. ' : 'Not quite. ') + q.getAttribute('data-why');
          fb.className = 'fb ' + (i === right ? 'yes' : 'no');
        });
      });
    });
  }

  function nav() {
    var links = $$('.toc a'), map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        if (map[e.target.id]) map[e.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    $$('main section[id]').forEach(function (s) { io.observe(s); });
  }

  function theme() {
    var btn = $('#theme'), root = document.documentElement;
    btn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', dark ? 'light' : 'dark');
      redrawAll();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', redrawAll);
    }
  }

  function start() {
    galton();
    labDips(); labBinom(); labDetect(); labField(); labNB(); labZI(); labLognormal(); labSurvival(); labBeta(); labCLT(); labResample(); labConcentration();
    quizzes(); nav(); theme();
    redrawAll();
    var t = 0;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(redrawAll, 120); });
    window.DLReady = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
