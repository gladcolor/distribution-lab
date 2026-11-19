/* Distributions in the Field: the interactive lessons. Needs core.js and chart.js. */
(function () {
  'use strict';
  var DL = window.DL;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  // The English and Chinese pages share this file. The page's lang attribute picks the text.
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  function L(en, zh) { return ZH ? zh : en; }

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
      title: L('Dip, count, repeat', '舀一勺，数一数，再重复'),
      legend: [['sim', L('Your dips', '你舀的勺')], ['theory', L('Long-run shape', '长期形状')]],
      controls: [
        { type: 'button', name: 'one', label: L('Take 1 dip', '舀 1 勺') },
        { type: 'button', name: 'twenty', label: L('Take 20 dips', '舀 20 勺'), primary: true },
        { type: 'button', name: 'many', label: L('Take 500 dips', '舀 500 勺') },
        { type: 'check', name: 'show', label: L('Show the long-run shape', '显示长期形状'), value: false },
        { type: 'button', name: 'reset', label: L('Start over', '重新开始'), quiet: true }
      ],
      canvases: [{ name: 'hist', h: 300, aria: L('Bar chart of how often each larval count turned up in your dips', '柱状图：各个幼虫数在你舀的勺中出现的频率') }],
      tiles: [['n', L('dips taken', '已舀勺数')], ['mean', L('mean per dip', '每勺均值')], ['var', L('variance', '方差')], ['zero', L('dips with no larvae', '没有幼虫的勺')]],
      caption: L('Each bar is the share of your dips that caught that many larvae. With few dips the bars jump around. With many, they settle into a fixed shape: the distribution.', '每根柱子表示舀到相应幼虫数的勺所占的比例。勺数少时柱子跳来跳去，勺数多了就稳定成一个固定的形状，这就是分布。')
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
        x: { min: -0.7, max: TOP + 1.7, ticks: [0, 2, 4, 6, 8, 10, 12, 13], tickLabels: { 13: '13+' }, label: L('Larvae counted in one dip', '一勺中的幼虫数') },
        y: { min: 0, max: Math.max(0.32, maxOf(sh) * 1.12), pct: true, label: L('Share of dips', '勺的占比') }, layers: layers
      });
      chips.innerHTML = n ? L('Latest dips: ', '最近几勺：') + recent.map(function (c) { return '<span>' + c + '</span>'; }).join('') : L('No dips yet. Press a button to start.', '还没有舀。按一个按钮开始。');
      lab.tile('n', F.int(n));
      lab.tile('mean', n ? F.d2(DL.mean(counts)) : '.');
      lab.tile('var', n > 1 ? F.d1(DL.variance(counts)) : '.');
      lab.tile('zero', n ? F.pct(sh[0]) : '.');
    };
    DL.hover(lab.c.hist, function (xv) {
      var c = Math.round(xv);
      if (c < 0 || c > TOP + 1 || !counts.length) return null;
      return { x: c, html: '<b>' + (c > TOP ? L('13 or more', '至少 13') : c) + L(' larvae</b><br>Your dips: ', ' 条幼虫</b><br>你舀的勺：') + F.pct(DL.tally(counts, TOP + 1)[c]) + (lab.v.show ? L('<br>Long run: ', '<br>长期：') + F.pct(theory[c]) : '') };
    });
    add(6);
  }

  /* ---------- lesson 1: binomial ---------- */
  function labBinom() {
    var NS = 300, seed = 201, sample = null;
    var lab = makeLab('lab-binom', {
      title: L('Positive dips out of n', 'n 勺中的阳性勺数'),
      legend: [['sim', L('300 simulated habitats', '300 个模拟孳生地')], ['theory', L('Binomial', '二项分布')]],
      controls: [
        { type: 'range', name: 'n', label: L('Dips per habitat', '每个孳生地舀的勺数'), min: 5, max: 50, step: 1, value: 20, fmt: F.int },
        { type: 'range', name: 'p', label: L('Chance a dip is positive', '一勺为阳性的概率'), min: 0.02, max: 0.98, step: 0.01, value: 0.25, fmt: F.pct },
        { type: 'button', name: 'run', label: L('Survey 300 new habitats', '重新调查 300 个孳生地'), primary: true }
      ],
      canvases: [{ name: 'pmf', h: 300, aria: L('Bar chart of the number of positive dips per habitat, with the binomial distribution drawn over it', '柱状图：每个孳生地的阳性勺数，并叠加二项分布') }],
      tiles: [['exp', L('positive dips expected', '期望阳性勺数')], ['sd', L('typical spread (standard deviation)', '典型离散程度（标准差）')], ['p0', L('habitats with no positive dip', '没有阳性勺的孳生地')], ['p1', L('habitats with at least one', '至少一勺阳性的孳生地')]],
      caption: L('Every simulated habitat gets the same number of dips, and every dip has the same chance of holding larvae.', '每个模拟孳生地舀的勺数相同，每一勺舀到幼虫的概率也相同。')
    });
    function resample() { var u = DL.rng(seed); sample = []; for (var i = 0; i < NS; i++) sample.push(DL.rBinom(u, lab.v.n, lab.v.p)); }
    lab.on('run', function () { seed++; resample(); lab.draw(); });
    lab.onParam = resample;
    function theory() { return range(0, lab.v.n).map(function (k) { return DL.pmfBinom(k, lab.v.n, lab.v.p); }); }
    lab.draw = function () {
      var n = lab.v.n, p = lab.v.p, xs = range(0, n), th = theory(), sh = DL.tally(sample, n);
      DL.plot(lab.c.pmf, {
        x: { min: -0.7, max: n + 0.7, label: L('Positive dips in one habitat', '一个孳生地的阳性勺数'), n: 8 },
        y: { min: 0, max: Math.max(maxOf(th), maxOf(sh)) * 1.14, pct: true, label: L('Share of habitats', '孳生地占比') },
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
      return { x: k, html: '<b>' + k + L(' positive dip' + (k === 1 ? '' : 's'), ' 勺阳性') + L('</b><br>Binomial: ', '</b><br>二项分布：') + F.pct(DL.pmfBinom(k, lab.v.n, lab.v.p)) + L('<br>Simulated: ', '<br>模拟：') + F.pct(DL.tally(sample, lab.v.n)[k]) };
    });
    resample();
  }

  function labDetect() {
    var lab = makeLab('lab-detect', {
      title: L('How many dips until you find them?', '要舀多少勺才能发现幼虫？'),
      legend: [['theory', L('Chance of at least one positive dip', '至少一勺阳性的概率')], ['ref', L('Your target', '你的目标')]],
      controls: [
        { type: 'range', name: 'p', label: L('Chance one dip finds larvae', '一勺发现幼虫的概率'), min: 0.01, max: 0.6, step: 0.01, value: 0.1, fmt: F.pct },
        { type: 'seg', name: 'target', label: L('Detection target', '检出目标'), showLabel: true, value: '0.95', options: [['0.8', '80%'], ['0.9', '90%'], ['0.95', '95%'], ['0.99', '99%']] }
      ],
      canvases: [{ name: 'curve', h: 280, aria: L('Line chart of the chance of detecting larvae against the number of dips', '折线图：发现幼虫的概率随勺数的变化') }],
      tiles: [['need', L('dips needed', '所需勺数')], ['p5', L('detection chance with 5 dips', '舀 5 勺的检出概率')], ['p20', L('detection chance with 20 dips', '舀 20 勺的检出概率')], ['miss', L('chance that 20 dips all miss', '20 勺全部落空的概率')]],
      caption: L('The curve climbs fast at first and then flattens. The last few percent of certainty cost the most dips.', '曲线开始升得很快，随后变平。最后几个百分点的把握最费勺数。')
    });
    var need = 1;
    lab.draw = function () {
      var p = lab.v.p, target = parseFloat(lab.v.target);
      need = Math.max(1, Math.ceil(Math.log(1 - target) / Math.log(1 - p) - 1e-9));
      var xmax = Math.max(40, Math.min(480, Math.ceil(need * 1.35 / 10) * 10)), xs = range(0, xmax);
      var ys = xs.map(function (n) { return 1 - Math.pow(1 - p, n); });
      DL.plot(lab.c.curve, {
        x: { min: 0, max: xmax, label: L('Number of dips', '勺数') },
        y: { min: 0, max: 1.04, pct: true, ticks: [0, 0.25, 0.5, 0.75, 1], label: L('Chance of finding larvae', '发现幼虫的概率') },
        layers: [
          { type: 'hline', y: target, color: '--ref', dash: [5, 4], label: F.pct(target) + L(' target', ' 目标'), align: 'right' },
          { type: 'vline', x: need, color: '--ref', dash: [2, 3] },
          { type: 'line', xs: xs, ys: ys, color: '--c2', width: 2.5 },
          { type: 'point', x: need, y: 1 - Math.pow(1 - p, need), color: '--c2', label: need + L(need === 1 ? ' dip' : ' dips', ' 勺'), bold: true, dy: 16, dx: 10 }
        ]
      });
      lab.tile('need', F.int(need));
      lab.tile('p5', F.pct(1 - Math.pow(1 - p, 5)));
      lab.tile('p20', F.pct(1 - Math.pow(1 - p, 20)));
      lab.tile('miss', F.pct(Math.pow(1 - p, 20)));
    };
    DL.hover(lab.c.curve, function (xv) {
      var n = Math.max(0, Math.round(xv));
      return { x: n, html: '<b>' + n + L(' dips</b><br>Chance of finding larvae: ', ' 勺</b><br>发现幼虫的概率：') + F.pct(1 - Math.pow(1 - lab.v.p, n)) };
    });
  }

  /* ---------- lessons 2 and 3: random or clumped ---------- */
  function labField() {
    var G = 12, seed = 301, pts = [], counts = [], fit = {};
    var lab = makeLab('lab-field', {
      title: L('Scatter larvae over a pond, then dip everywhere', '把幼虫撒进池塘，再处处舀一勺'),
      legend: [['sim', L('Your 144 dips', '你的 144 勺')], ['alt', L('Poisson, same mean', '泊松分布，均值相同')], ['theory', L('Negative binomial fit', '负二项分布拟合')]],
      stageClass: 'two',
      controls: [
        { type: 'range', name: 'mean', label: L('Average larvae per dip', '平均每勺幼虫数'), min: 0.5, max: 8, step: 0.5, value: 2, fmt: F.d1 },
        { type: 'range', name: 'clump', label: L('Clumping', '聚集程度'), min: 0, max: 1, step: 0.05, value: 0, fmt: function (v) { return v < 0.01 ? L('none (random)', '无（随机）') : v < 0.35 ? L('mild', '轻度') : v < 0.7 ? L('strong', '强') : L('very strong', '很强'); } },
        { type: 'button', name: 'new', label: L('Scatter again', '再撒一次'), primary: true }
      ],
      canvases: [
        { name: 'field', cls: 'square', title: L('The pond from above. Each square is one dip.', '俯视池塘。每个方格是一勺。'), aria: L('Map of larvae scattered over a pond surface divided into 144 squares', '示意图：幼虫散布在分成 144 个方格的池塘水面上') },
        { name: 'hist', h: 320, title: L('How many dips caught each count', '舀到各个幼虫数的勺有多少'), aria: L('Bar chart of larvae per dip, compared with a Poisson distribution and a negative binomial distribution', '柱状图：每勺幼虫数，与泊松分布和负二项分布比较') }
      ],
      tiles: [['mean', L('mean per dip', '每勺均值')], ['var', L('variance', '方差')], ['ratio', L('variance to mean ratio (1 = random)', '方差均值比（1 = 随机）')], ['k', L('aggregation k (small = clumped)', '聚集参数 k（越小越聚集）')], ['zero', L('empty dips', '空勺')]],
      caption: L('Left: darker squares caught more larvae. Right: the same dips as a distribution. Hover over a square or a bar to read it.', '左图：颜色越深的方格舀到的幼虫越多。右图：同样这些勺画成分布。把指针移到方格或柱子上可以读数。')
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
        x: { min: -0.7, max: top + 0.7, label: L('Larvae in one dip', '一勺中的幼虫数'), n: 8 },
        y: { min: 0, max: Math.max(maxOf(sh), maxOf(po)) * 1.14, pct: true, label: L('Share of dips', '勺的占比') }, layers: layers
      });
      lab.tile('mean', F.d2(m));
      lab.tile('var', F.d1(v));
      lab.tile('ratio', F.d1(v / m));
      lab.tile('k', isFinite(k) ? F.d2(k) : L('none', '无'));
      lab.tile('zero', F.pct(sh[0]), L('empty dips (Poisson expects ', '空勺（泊松分布预期 ') + F.pct(Math.exp(-m)) + L(')', '）'));
    };
    DL.hover(lab.c.hist, function (xv) {
      var c = Math.round(xv);
      if (c < 0 || c > fit.top) return null;
      return { x: c, html: '<b>' + c + L(' larvae</b><br>Your dips: ', ' 条幼虫</b><br>你舀的勺：') + F.pct(fit.sh[c]) + L('<br>Poisson: ', '<br>泊松分布：') + F.pct(DL.pmfPoisson(c, fit.m)) + (isFinite(fit.k) ? L('<br>Negative binomial: ', '<br>负二项分布：') + F.pct(DL.pmfNB(c, fit.m, fit.k)) : '') };
    });
    var tip = DL.tipFor(lab.c.field);
    lab.c.field.addEventListener('pointermove', function (e) {
      var r = lab.c.field.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      var cx = Math.min(G - 1, Math.max(0, Math.floor(px / r.width * G))), cy = Math.min(G - 1, Math.max(0, Math.floor(py / r.height * G))), c = counts[cy * G + cx];
      tip.show(px, py, L('This dip caught <b>', '这一勺舀到 <b>') + c + '</b> ' + L(c === 1 ? 'larva' : 'larvae', '条幼虫'));
    });
    lab.c.field.addEventListener('pointerleave', tip.hide);
    scatter();
  }

  function labNB() {
    var NS = 300, seed = 401, sample = [], top = 10;
    var lab = makeLab('lab-nb', {
      title: L('Shape of the negative binomial', '负二项分布的形状'),
      legend: [['sim', L('300 simulated dips', '300 勺模拟结果')], ['theory', L('Negative binomial', '负二项分布')], ['alt', L('Poisson, same mean', '泊松分布，均值相同')]],
      controls: [
        { type: 'range', name: 'mean', label: L('Mean larvae per dip', '每勺平均幼虫数'), min: 0.5, max: 20, step: 0.5, value: 4, fmt: F.d1 },
        logSlider('k', L('Aggregation k', '聚集参数 k'), -1, 1.3, 0.8, L('Small k: strong clumping. Large k: close to random.', 'k 小：强烈聚集。k 大：接近随机。')),
        { type: 'check', name: 'pois', label: L('Compare with Poisson', '与泊松分布比较'), value: true },
        { type: 'button', name: 'run', label: L('Take 300 new dips', '重新舀 300 勺'), primary: true }
      ],
      canvases: [{ name: 'pmf', h: 310, aria: L('Bar chart of simulated larvae per dip with the negative binomial and Poisson distributions drawn over it', '柱状图：模拟的每勺幼虫数，并叠加负二项分布和泊松分布') }],
      tiles: [['var', L('variance', '方差')], ['ratio', L('variance to mean ratio', '方差均值比')], ['zero', L('dips with no larvae', '没有幼虫的勺')], ['need', L('dips needed for a standard error of 20% of the mean', '使标准误降到均值的 20% 所需的勺数')]],
      caption: L('Both curves have the same mean. Only the negative binomial can put many dips at zero and a few far to the right at the same time.', '两条曲线的均值相同。只有负二项分布能同时让许多勺为零、少数勺落在很靠右的位置。')
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
      DL.plot(lab.c.pmf, { x: { min: -0.7, max: top + 0.7, label: L('Larvae in one dip', '一勺中的幼虫数'), n: 8 }, y: { min: 0, max: ymax * 1.14, pct: true, label: L('Share of dips', '勺的占比') }, layers: layers });
      var v = m + m * m / k;
      lab.tile('var', F.d1(v));
      lab.tile('ratio', F.d1(v / m));
      lab.tile('zero', F.pct(DL.pmfNB(0, m, k)));
      lab.tile('need', F.int(Math.ceil((1 / m + 1 / k) / 0.04)));
    };
    DL.hover(lab.c.pmf, function (xv) {
      var c = Math.round(xv);
      if (c < 0 || c > top) return null;
      return { x: c, html: '<b>' + c + L(' larvae</b><br>Negative binomial: ', ' 条幼虫</b><br>负二项分布：') + F.pct(DL.pmfNB(c, lab.v.mean, lab.v.k)) + (lab.v.pois ? L('<br>Poisson: ', '<br>泊松分布：') + F.pct(DL.pmfPoisson(c, lab.v.mean)) : '') + L('<br>Simulated: ', '<br>模拟：') + F.pct(shares(sample, top)[c]) };
    });
    resample();
  }

  /* ---------- lesson 4: zero inflation ---------- */
  function labZI() {
    var NS = 400, seed = 501, sample = [], top = 10;
    var lab = makeLab('lab-zi', {
      title: L('Two kinds of zero', '两种零'),
      legend: [['sim', L('400 simulated habitats', '400 个模拟孳生地')], ['theory', L('Zero-inflated negative binomial', '零膨胀负二项分布')], ['zero', L('Zeros from habitats that cannot hold larvae', '不适宜孳生地产生的零')]],
      controls: [
        { type: 'range', name: 'pi', label: L('Habitats that cannot hold larvae', '不适宜的孳生地占比'), min: 0, max: 0.9, step: 0.05, value: 0.35, fmt: F.pct },
        { type: 'range', name: 'mean', label: L('Mean count where larvae can live', '适宜孳生地的平均幼虫数'), min: 1, max: 30, step: 1, value: 6, fmt: F.int },
        logSlider('k', L('Aggregation k', '聚集参数 k'), -0.7, 1, 0.7),
        { type: 'check', name: 'zoom', label: L('Zoom in on the counts above zero', '放大大于零的计数'), value: false },
        { type: 'button', name: 'run', label: L('Survey 400 new habitats', '重新调查 400 个孳生地'), primary: true }
      ],
      canvases: [{ name: 'pmf', h: 310, aria: L('Bar chart of larval counts per habitat with a tall bar at zero, split into unsuitable habitats and suitable habitats that had no larvae', '柱状图：每个孳生地的幼虫数，零处有一根高柱，分为不适宜的孳生地和没有舀到幼虫的适宜孳生地') }],
      tiles: [['z', L('habitats with a zero count', '计数为零的孳生地')], ['zs', L('zeros from unsuitable habitats', '来自不适宜孳生地的零')], ['zc', L('zeros from suitable habitats', '来自适宜孳生地的零')], ['mean', L('mean count over all habitats', '全部孳生地的平均幼虫数')]],
      caption: L('The gray block at zero is the share of habitats that cannot hold larvae at all. The rest of the zero bar comes from suitable habitats where the dips happened to find nothing.', '零处的灰色部分是根本不能养活幼虫的孳生地所占的比例。零柱的其余部分来自适宜的孳生地，只是这几勺恰好什么也没舀到。')
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
        x: { min: -0.9, max: top + 0.7, label: L('Larvae counted in one habitat', '一个孳生地的幼虫数'), n: 8 },
        y: { min: 0, max: ymax, pct: true, label: L('Share of habitats', '孳生地占比') },
        layers: [
          { type: 'bars', xs: xs, ys: sh, w: 0.74, color: '--c1' },
          { type: 'bars', xs: [0], ys: [Math.min(pi, sh[0])], w: 0.74, color: '--zero' },
          { type: 'line', xs: xs, ys: th, color: '--c2', dots: top > 34 ? 2 : 3 },
          lab.v.zoom ? { type: 'text', x: 0, y: ymax, dx: 16, dy: 14, label: L('zero bar continues to ', '零柱一直升到 ') + F.pct(th[0]) } : null
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
      return { x: c, html: '<b>' + c + L(' larvae</b><br>Model: ', ' 条幼虫</b><br>模型：') + F.pct(DL.pmfZINB(c, lab.v.pi, lab.v.mean, lab.v.k)) + L('<br>Simulated: ', '<br>模拟：') + F.pct(shares(sample, top)[c]) + (c === 0 ? L('<br>Unsuitable habitats: ', '<br>不适宜孳生地：') + F.pct(lab.v.pi) : '') };
    });
    resample();
  }

  /* ---------- lesson 5: lognormal ---------- */
  function labLognormal() {
    var NS = 400, seed = 601, sample = [];
    var lab = makeLab('lab-lognormal', {
      title: L('A long right tail, and what the logarithm does to it', '长长的右尾，以及取对数之后的样子'),
      legend: [['sim', L('400 simulated habitats', '400 个模拟孳生地')], ['theory', L('Lognormal', '对数正态分布')]],
      controls: [
        { type: 'range', name: 'median', label: L('Median density', '密度中位数'), min: 1, max: 100, step: 1, value: 20, fmt: F.int },
        { type: 'range', name: 'sigma', label: L('Spread (standard deviation of the logs)', '离散程度（对数值的标准差）'), min: 0.2, max: 1.6, step: 0.05, value: 0.9, fmt: F.d2 },
        { type: 'seg', name: 'axis', label: L('Horizontal axis', '横轴'), value: 'lin', options: [['lin', L('Natural scale', '原始尺度')], ['log', L('Log scale', '对数尺度')]] },
        { type: 'button', name: 'run', label: L('Measure 400 new habitats', '重新测量 400 个孳生地'), primary: true }
      ],
      canvases: [{ name: 'pdf', h: 310, aria: L('Histogram of simulated larval densities with the lognormal curve drawn over it', '直方图：模拟的幼虫密度，并叠加对数正态曲线') }],
      tiles: [['median', L('median (half the habitats are below this)', '中位数（一半孳生地低于此值）')], ['mean', L('mean', '均值')], ['ratio', L('mean divided by median', '均值除以中位数')], ['top', L('share of all larvae in the densest 10% of habitats', '密度最高的 10% 孳生地所占的幼虫比例')]],
      caption: L('On the natural scale the hill leans left with a long tail. Switch to the log scale and the same data form a symmetric bell.', '在原始尺度上，山峰偏向左边，拖着一条长尾。切换到对数尺度，同样的数据变成对称的钟形。')
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
        spec = { x: { min: 0, max: xmax, label: L('Larval density (for example, larvae per litre)', '幼虫密度（例如每升幼虫数）') } };
      } else {
        var a = (mu - 3.2 * sg) / Math.LN10, b2 = (mu + 3.2 * sg) / Math.LN10, lw = (b2 - a) / B;
        sample.forEach(function (v) { var b = Math.floor((Math.log10(v) - a) / lw); if (b >= 0 && b < B) h[b]++; });
        for (i = 0; i < B; i++) edges.push([Math.pow(10, a + i * lw), Math.pow(10, a + (i + 1) * lw)]);
        dens = h.map(function (c) { return c / (NS * lw); });
        for (i = 0; i <= 240; i++) { var t = a + (b2 - a) * i / 240; cx.push(Math.pow(10, t)); cy.push(DL.pdfNormal(t * Math.LN10, mu, sg) * Math.LN10); }
        spec = { x: { min: Math.pow(10, a), max: Math.pow(10, b2), log: true, label: L('Larval density, log scale: each step multiplies by the same factor', '幼虫密度，对数尺度：每一格乘以相同的倍数') } };
      }
      spec.y = { min: 0, max: Math.max(maxOf(cy), maxOf(dens)) * 1.16, hideTicks: true, label: L('Share of habitats (taller = more common)', '孳生地占比（越高越常见）') };
      spec.layers = [
        { type: 'bars', edges: edges, ys: dens, color: '--c1' },
        { type: 'line', xs: cx, ys: cy, color: '--c2', width: 2.5 },
        { type: 'vline', x: med, color: '--ink', dash: [2, 3], label: L('median', '中位数'), align: 'right', labelY: 4 },
        { type: 'vline', x: mean, color: '--ink', label: L('mean', '均值'), labelY: 24 }
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
      title: L('A cohort of adult mosquitoes, day by day', '一批成蚊，一天天过去'),
      legend: [['sim', L('300 simulated mosquitoes still alive', '300 只模拟蚊子中仍存活的')], ['theory', L('Expected share alive', '期望存活比例')], ['band', L('Old enough to transmit', '已到能传播的日龄')]],
      controls: [
        { type: 'range', name: 'p', label: L('Chance of surviving one day', '活过一天的概率'), min: 0.6, max: 0.98, step: 0.01, value: 0.85, fmt: F.pct },
        { type: 'range', name: 'n', label: L('Days the parasite needs inside the mosquito', '疟原虫在蚊体内发育所需的天数'), min: 5, max: 20, step: 1, value: 10, fmt: F.int },
        { type: 'button', name: 'run', label: L('Release 300 new mosquitoes', '重新放出 300 只蚊子'), primary: true }
      ],
      canvases: [{ name: 'curve', h: 300, aria: L('Chart of the share of mosquitoes still alive on each day after emergence', '图：羽化后每一天仍存活的蚊子比例') }],
      tiles: [['alive', L('live long enough to transmit', '活到能传播的比例')], ['life', L('average life in days', '平均寿命（天）')], ['half', L('days until half are dead', '半数死亡所需的天数')], ['inf', L('infective days per mosquito that emerges', '每只羽化蚊子的感染性天数')]],
      caption: L('Move daily survival by a few points and watch the share that reaches the shaded zone. That steep response is why adult survival matters so much for transmission.', '把日存活率调动几个百分点，看看能到达阴影区的比例。这种剧烈的变化说明了成蚊存活率对传播为什么如此重要。')
    });
    function resample() { var u = DL.rng(seed); lives = []; for (var i = 0; i < NS; i++) lives.push(DL.rLifeDays(u, lab.v.p)); }
    lab.on('run', function () { seed++; resample(); lab.draw(); });
    lab.onParam = function (name) { if (name === 'p') resample(); };
    function alive(t) { var c = 0; for (var i = 0; i < lives.length; i++) if (lives[i] >= t) c++; return c / lives.length; }
    lab.draw = function () {
      var p = lab.v.p, n = lab.v.n, xs = range(0, DAYS);
      DL.plot(lab.c.curve, {
        x: { min: -0.7, max: DAYS + 0.7, label: L('Days since emergence', '羽化后的天数'), n: 9 },
        y: { min: 0, max: 1.04, pct: true, ticks: [0, 0.25, 0.5, 0.75, 1], label: L('Share still alive', '仍存活的比例') },
        layers: [
          { type: 'band', x0: n - 0.5, x1: DAYS + 0.7, color: '--c3', alpha: 0.13 },
          { type: 'bars', xs: xs, ys: xs.map(alive), w: 0.8, color: '--c1' },
          { type: 'line', xs: xs, ys: xs.map(function (t) { return Math.pow(p, t); }), color: '--c2', dots: 2.5 },
          { type: 'vline', x: n - 0.5, color: '--c3', label: L('parasite ready on day ' + n, '第 ' + n + ' 天疟原虫发育成熟'), labelY: 4 }
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
      return { x: t, html: L('<b>Day ' + t, '<b>第 ' + t + ' 天') + L('</b><br>Expected alive: ', '</b><br>期望存活：') + F.pct(Math.pow(lab.v.p, t)) + L('<br>Simulated alive: ', '<br>模拟存活：') + F.pct(alive(t)) };
    });
    resample();
  }

  /* ---------- lesson 7: beta ---------- */
  function labBeta() {
    var lab = makeLab('lab-beta', {
      title: L('What the survey says about the true share', '调查对真实比例说明了什么'),
      legend: [['theory', L('Plausibility of each true share', '各个真实比例的可信程度')], ['band', L('Middle 95%', '中间 95%')]],
      controls: [
        { type: 'range', name: 'n', label: L('Habitats checked', '检查的孳生地数'), min: 5, max: 200, step: 1, value: 20, fmt: F.int },
        { type: 'range', name: 'x', label: L('Habitats found positive', '其中阳性的孳生地数'), min: 0, max: 20, step: 1, value: 3, fmt: F.int }
      ],
      canvases: [{ name: 'pdf', h: 290, aria: L('Curve showing which true shares of positive habitats are plausible after the survey', '曲线：调查之后，阳性孳生地的各个真实比例有多可信') }],
      tiles: [['obs', L('share positive in the sample', '样本中的阳性比例')], ['ci', L('plausible range for the true share (95%)', '真实比例的可信范围（95%）')], ['w', L('width of that range', '该范围的宽度')]],
      caption: L('The curve is a beta distribution. Its peak sits at the share you observed, and its width is your uncertainty. Check more habitats and it narrows.', '这条曲线是贝塔分布。峰值位于你观察到的比例，宽度就是你的不确定性。检查的孳生地越多，曲线越窄。')
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
        x: { min: 0, max: 1, pct: true, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: L('True share of habitats that are positive', '阳性孳生地的真实比例') },
        y: { min: 0, max: maxOf(ys) * 1.16, hideTicks: true, label: L('Plausibility (taller = more plausible)', '可信程度（越高越可信）') },
        layers: [
          bx.length > 1 ? { type: 'line', xs: bx, ys: by, color: '--c3', fill: 0.2, width: 0 } : null,
          { type: 'line', xs: xs, ys: ys, color: '--c2', width: 2.5 },
          { type: 'vline', x: x / n, color: '--ink', dash: [2, 3], label: L('observed ', '观察值 ') + F.pct(x / n), align: x / n > 0.7 ? 'right' : 'left' }
        ]
      });
      lab.tile('obs', L(x + ' of ' + n, x + ' / ' + n) + ' = ' + F.pct(x / n));
      lab.tile('ci', F.pct(q[0]) + L(' to ', ' 至 ') + F.pct(q[1]));
      lab.tile('w', (100 * (q[1] - q[0])).toFixed(0) + L(' points', ' 个百分点'));
    };
  }

  /* ---------- lesson 8: central limit theorem ---------- */
  function labCLT() {
    var SIZES = [1, 2, 5, 10, 30, 100], MEAN = 5, R = 1000, seed = 801, means = [], timer = 0;
    var lab = makeLab('lab-clt', {
      title: L('From one skewed count to the average of many', '从单个偏态计数到许多计数的平均'),
      legend: [['sim', L('Averages from simulated surveys', '模拟调查得到的平均值')], ['theory', L('Normal curve predicted by the theorem', '定理预测的正态曲线')]],
      stageClass: 'two',
      controls: [
        { type: 'range', name: 'n', label: L('Habitats averaged in one survey', '一次调查中取平均的孳生地数'), min: 0, max: 5, step: 1, value: 3, map: function (i) { return SIZES[i]; }, fmt: F.int },
        logSlider('k', L('Aggregation k of single counts', '单个计数的聚集参数 k'), -0.5, 0.7, 0.6, L('Smaller k means more skew in single counts.', 'k 越小，单个计数越偏。')),
        { type: 'button', name: 'run', label: L('Run 1,000 new surveys', '重新做 1,000 次调查'), primary: true }
      ],
      canvases: [
        { name: 'pop', h: 280, title: L('One habitat: the count is strongly skewed', '单个孳生地：计数严重偏态'), aria: L('Distribution of the larval count in a single habitat', '单个孳生地幼虫数的分布') },
        { name: 'means', h: 280, title: L('One survey: the average over its habitats', '一次调查：各孳生地的平均值'), aria: L('Histogram of survey averages with a normal curve drawn over it', '直方图：各次调查的平均值，并叠加正态曲线') }
      ],
      tiles: [['mu', L('true mean count', '真实平均幼虫数')], ['sd1', L('spread of single counts', '单个计数的离散程度')], ['pred', L('predicted spread of the averages', '平均值离散程度的预测值')], ['obs', L('spread of the simulated averages', '模拟平均值的离散程度')]],
      caption: L('Left: counts in single habitats, far from a bell. Right: averages over n habitats. Raise n and the averages pull together into a bell around the true mean.', '左图：单个孳生地的计数，远不是钟形。右图：n 个孳生地的平均值。增大 n，平均值就向真实均值收拢，形成钟形。')
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
        x: { min: -0.7, max: top + 0.7, label: L('Larvae counted in one habitat', '一个孳生地的幼虫数'), n: 6 }, y: { min: 0, max: maxOf(pm) * 1.14, pct: true, label: L('Share of habitats', '孳生地占比') },
        layers: [{ type: 'line', xs: xs, ys: pm, color: '--c2', dots: top > 34 ? 2 : 3, fill: 0.14 }, { type: 'vline', x: MEAN, color: '--ink', dash: [2, 3], label: L('mean ', '均值 ') + MEAN }]
      });
      var lo = Math.max(0, MEAN - 4 * sd), hi = n === 1 ? top + 0.5 : MEAN + 4.6 * sd;
      var bw = Math.max(1, Math.ceil((hi - lo) / 34 * n)) / n, B = Math.ceil((hi - lo) / bw), h = new Array(B).fill(0), edges = [], cx = [], cy = [];
      lo = Math.max(0, Math.floor(lo / bw) * bw) - (n === 1 ? 0.5 : bw / 2);
      means.forEach(function (m) { var b = Math.floor((m - lo) / bw); if (b >= 0 && b < B) h[b]++; });
      for (i = 0; i < B; i++) edges.push([lo + i * bw, lo + (i + 1) * bw]);
      var dens = h.map(function (c) { return means.length ? c / (means.length * bw) : 0; });
      for (i = 0; i <= 200; i++) { var x = lo + (B * bw) * i / 200; cx.push(x); cy.push(DL.pdfNormal(x, MEAN, sd)); }
      DL.plot(lab.c.means, {
        x: { min: lo, max: lo + B * bw, label: L('Average larvae per habitat in one survey', '一次调查中每个孳生地的平均幼虫数'), n: 6 },
        y: { min: 0, max: Math.max(maxOf(cy), maxOf(dens)) * 1.16, hideTicks: true, label: L('Share of surveys', '调查的占比') },
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
      title: L('One survey, two questions', '一次调查，两个问题'),
      legend: [['sim', L('2,000 resampled values', '2,000 个重抽样值')], ['theory', L('Value in your survey', '你这次调查的值')], ['band', L('Shaded: see the tiles below', '阴影：见下方卡片')]],
      controls: [
        { type: 'range', name: 'skill', label: L('Ranking skill', '排序能力'), min: 0, max: 0.95, step: 0.05, value: 0.5, fmt: function (v) { return v < 0.01 ? L('none (random)', '无（随机）') : F.d2(v); }, hint: L('0 is a ranking that knows nothing. Near 1 it almost matches the true order.', '0 表示排序毫无信息。接近 1 时几乎与真实顺序一致。') },
        { type: 'seg', name: 'mode', label: L('Question', '问题'), value: 'boot', options: [['boot', L('How precise? (bootstrap)', '有多精确？（自助法）')], ['perm', L('Better than chance? (permutation)', '比随机强吗？（置换检验）')]] },
        { type: 'button', name: 'again', label: L('Resample again', '再重抽样一次') },
        { type: 'button', name: 'new', label: L('New survey of 60 habitats', '重新调查 60 个孳生地'), primary: true }
      ],
      canvases: [
        { name: 'strip', h: 130, title: L('Your survey: 60 habitats in the model\'s ranked order. Bar height is the larvae counted.', '你的调查：60 个孳生地按模型的排名排列。柱高是数到的幼虫数。'), aria: L('Bars for 60 habitats in ranked order, the top-ranked half highlighted', '柱状图：60 个孳生地按排名排列，排名前一半高亮显示') },
        { name: 'hist', h: 250, title: L('Share of larvae in the top-ranked half, over 2,000 resamples', '2,000 次重抽样中，排名前一半孳生地所占的幼虫比例'), aria: L('Histogram of the resampled statistic with the observed value marked', '直方图：重抽样得到的统计量，并标出观察值') }
      ],
      tiles: [['obs', L('of larvae are in the top-ranked half', '排名前一半孳生地所占的幼虫比例')], ['res', L('bootstrap 95% interval', '自助法 95% 区间')], ['rnd', L('expected under random order', '随机排序下的期望值')], ['r', L('resamples', '重抽样次数')]],
      caption: L('Bootstrap: resample the habitats with replacement and recompute. Permutation: shuffle the ranking so it carries no information and recompute.', '自助法：对孳生地做有放回的重抽样，然后重新计算。置换检验：把排序打乱，使它不含任何信息，然后重新计算。')
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
        x: { min: 0.3, max: N + 0.7, ticks: [1, 10, 20, 30, 40, 50, 60], label: L('Rank given by the model (1 = treat first)', '模型给出的排名（1 = 最先处理）') },
        y: { min: 0, max: Math.max(5, maxOf(counts)) * 1.1, hideTicks: true },
        layers: [
          { type: 'bars', xs: range(1, N), ys: order.map(function (o) { return counts[o]; }), w: 0.8, colors: range(1, N).map(function (r) { return r <= HALF ? '--c1' : '--zero'; }) },
          { type: 'vline', x: HALF + 0.5, color: '--ref', dash: [4, 3], label: L('top half', '前一半'), align: 'right' }
        ]
      });
      var lo = Math.min(0.2, Math.floor(Math.min(dist[0], obs) * 20) / 20), bw = 0.02, B = Math.round((1 - lo) / bw), h = new Array(B).fill(0), edges = [];
      dist.forEach(function (t) { h[Math.min(B - 1, Math.floor((t - lo) / bw))]++; });
      for (i = 0; i < B; i++) edges.push([lo + i * bw, lo + (i + 1) * bw]);
      var sh = h.map(function (c) { return c / dist.length; }), q = [DL.quantile(dist, 0.025), DL.quantile(dist, 0.975)];
      var ge = dist.filter(function (t) { return t >= obs - 1e-12; }).length, pv = (ge + 1) / (dist.length + 1);
      DL.plot(lab.c.hist, {
        x: { min: lo, max: 1, pct: true, label: L('Share of larvae in the top-ranked half of habitats', '排名前一半孳生地所占的幼虫比例') },
        y: { min: 0, max: maxOf(sh) * 1.2, pct: true, label: L('Share of resamples', '重抽样的占比') },
        layers: [
          boot ? { type: 'band', x0: q[0], x1: q[1], color: '--c3', alpha: 0.16 } : { type: 'band', x0: obs, x1: 1, color: '--c3', alpha: 0.16 },
          { type: 'bars', edges: edges, ys: sh, color: '--c1' },
          boot ? null : { type: 'vline', x: 0.5, color: '--ref', dash: [5, 4], label: L('random order', '随机排序'), align: 'right', labelY: 24 },
          { type: 'vline', x: obs, color: '--c2', width: 2.5, label: L('your survey ', '你的调查 ') + F.pct(obs), bold: true, align: obs > 0.8 ? 'right' : 'left', labelY: 4 }
        ]
      });
      lab.tile('obs', F.pct(obs));
      if (boot) lab.tile('res', F.pct(q[0]) + L(' to ', ' 至 ') + F.pct(q[1]), L('bootstrap 95% interval (shaded)', '自助法 95% 区间（阴影）'));
      else lab.tile('res', pv < 0.001 ? L('below 0.001', '小于 0.001') : pv.toFixed(3), L('P value: share of shuffles at or above your survey (shaded)', 'P 值：打乱后不低于你的调查值的比例（阴影）'));
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
      title: L('Where are the larvae?', '幼虫都在哪里？'),
      legend: [['theory', L('Most productive habitats first (the ceiling)', '高产孳生地优先（上限）')], ['ref', L('Random order', '随机顺序')], ['band', L('Habitats you treat', '你处理的孳生地')]],
      controls: [
        { type: 'range', name: 'top', label: L('Habitats you can treat', '你能处理的孳生地'), min: 0.05, max: 1, step: 0.05, value: 0.2, fmt: F.pct },
        { type: 'range', name: 'pi', label: L('Habitats with no larvae at all', '完全没有幼虫的孳生地'), min: 0, max: 0.8, step: 0.05, value: 0.3, fmt: F.pct },
        logSlider('k', L('Aggregation k among the rest', '其余孳生地的聚集参数 k'), -0.7, 0.7, 0.6, L('Smaller k: a few habitats hold most of the larvae.', 'k 越小，少数孳生地拥有大部分幼虫。')),
        { type: 'button', name: 'new', label: L('New survey of 400 habitats', '重新调查 400 个孳生地'), primary: true }
      ],
      canvases: [{ name: 'curve', h: 330, aria: L('Coverage curve: share of larvae covered against share of habitats treated, most productive first, compared with random order', '覆盖曲线：高产孳生地优先处理时，覆盖的幼虫比例随处理的孳生地比例的变化，并与随机顺序比较') }],
      tiles: [['hold', L('of larvae are in the habitats you treat', '你处理的孳生地所占的幼虫比例')], ['rand', L('if you picked habitats at random', '随机挑选孳生地时的比例')], ['need', L('of habitats hold 80% of the larvae', '拥有 80% 幼虫的孳生地比例')], ['gini', L('Gini coefficient (0 = even, 1 = all in one)', '基尼系数（0 = 完全均匀，1 = 全在一处）')]],
      caption: L('Sort the habitats from most to least productive and add up the larvae. The more clumped the counts, the higher the curve bulges above the diagonal.', '把孳生地按产量从高到低排序，把幼虫数逐个累加。计数越聚集，曲线在对角线上方鼓得越高。')
    });
    function survey() { var u = DL.rng(seed); counts = []; for (var i = 0; i < N; i++) counts.push(DL.rZINB(u, lab.v.pi, MEAN, lab.v.k)); cc = DL.concentration(counts); }
    lab.on('new', function () { seed++; survey(); lab.draw(); });
    lab.onParam = function (name) { if (name !== 'top') survey(); };
    lab.draw = function () {
      var top = lab.v.top, y = cc.y[Math.round(top * N)], need = 0;
      while (need < N && cc.y[need] < 0.8) need++;
      DL.plot(lab.c.curve, {
        x: { min: 0, max: 1, pct: true, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: L('Habitats treated, most productive first', '处理的孳生地，高产的优先') },
        y: { min: 0, max: 1.04, pct: true, ticks: [0, 0.25, 0.5, 0.75, 1], label: L('Share of all larvae covered', '覆盖的幼虫比例') },
        layers: [
          { type: 'band', x0: 0, x1: top, color: '--c3', alpha: 0.13 },
          { type: 'line', xs: [0, 1], ys: [0, 1], color: '--ref', dash: [6, 4], width: 2 },
          { type: 'line', xs: cc.x, ys: cc.y, color: '--c2', width: 2.75 },
          { type: 'point', x: top, y: top, color: '--ref', r: 4 },
          { type: 'point', x: top, y: y, color: '--c2', label: F.pct(y) + L(' of larvae', ' 的幼虫'), bold: true, dx: top > 0.7 ? -10 : 10, dy: 16, align: top > 0.7 ? 'right' : 'left' }
        ]
      });
      lab.tile('hold', F.pct(y));
      lab.tile('rand', F.pct(top));
      lab.tile('need', F.pct(need / N));
      lab.tile('gini', F.d2(cc.gini));
    };
    DL.hover(lab.c.curve, function (xv) {
      var i = Math.max(0, Math.min(N, Math.round(xv * N)));
      return { x: i / N, html: L('<b>Top ', '<b>前 ') + F.pct(i / N) + L(' of habitats</b><br>hold ', ' 的孳生地</b><br>拥有 ') + F.pct(cc.y[i]) + L(' of the larvae<br>Random order: ', ' 的幼虫<br>随机顺序：') + F.pct(i / N) };
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
          fb.textContent = (i === right ? L('Correct. ', '正确。') : L('Not quite. ', '不太对。')) + q.getAttribute('data-why');
          fb.className = 'fb ' + (i === right ? 'yes' : 'no');
        });
      });
    });
  }

  function nav() {
    var links = $$('.toc a'), map = {}, current = '';
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    // the language switch opens the other page at the lesson being read
    $$('.lang a:not([aria-current])').forEach(function (a) {
      var base = a.getAttribute('href').split('#')[0];
      a.addEventListener('click', function () {
        var id = window.scrollY > 300 ? current || location.hash.slice(1) : '';
        a.setAttribute('href', base + (id ? '#' + id : ''));
      });
    });
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        current = e.target.id;
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
      try { localStorage.setItem('dl-theme', dark ? 'light' : 'dark'); } catch (e) { /* the choice just will not carry over to the other language */ }
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
    // the labs were just built, so the page grew: go to the lesson named in the address again
    var target = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (target) target.scrollIntoView({ behavior: 'instant' });
    window.DLReady = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
