/* Distributions in the Field: a small canvas chart helper (bars, lines, bands, markers, hover tips).
   Colors are CSS variable names such as '--c1', read at draw time so charts follow the page theme. */
(function () {
  'use strict';
  var DL = window.DL;

  DL.css = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  };
  function color(c) { return c && c.indexOf('--') === 0 ? DL.css(c) : c; }

  // Size the canvas for the screen's pixel density and clear it.
  DL.setup = function (canvas) {
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  };

  DL.niceTicks = function (min, max, n) {
    var span = max - min;
    if (!(span > 0)) return [min];
    var raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, out = [];
    for (var v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toFixed(10));
    return out;
  };

  function logTicks(min, max) {
    var out = [];
    for (var e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
      [1, 2, 5].forEach(function (m) {
        var v = m * Math.pow(10, e);
        if (v >= min * 0.999 && v <= max * 1.001) out.push(+v.toPrecision(3));
      });
    }
    return out;
  }

  function num(v) {
    var a = Math.abs(v);
    if (a >= 1000) return Math.round(v).toLocaleString('en-US');
    if (a === Math.round(a)) return String(v);
    return String(+v.toPrecision(a < 1 ? 2 : 3));
  }
  function pctFmt(ticks) {
    var step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1, d = step < 0.00999 ? 1 : 0;
    return function (v) { return (100 * v).toFixed(d) + '%'; };
  }

  function roundedBar(ctx, x0, x1, yTop, yBase) {
    var w = x1 - x0, r = Math.min(3, w / 2, Math.abs(yBase - yTop));
    ctx.beginPath();
    ctx.moveTo(x0, yBase);
    ctx.lineTo(x0, yTop + r);
    ctx.quadraticCurveTo(x0, yTop, x0 + r, yTop);
    ctx.lineTo(x1 - r, yTop);
    ctx.quadraticCurveTo(x1, yTop, x1, yTop + r);
    ctx.lineTo(x1, yBase);
    ctx.closePath();
    ctx.fill();
  }

  /* spec = { x: {min, max, label, ticks, tickLabels, fmt, pct, log}, y: {min, max, label, pct, fmt, hideTicks}, layers: [...] }
     layer types: bars, line, band, vline, hline, point, text */
  DL.plot = function (canvas, spec) {
    var s = DL.setup(canvas), ctx = s.ctx, W = s.w, H = s.h, X = spec.x, Y = spec.y;
    var m = { l: Y.hideTicks ? 14 : 50, r: 16, t: Y.label ? 30 : 14, b: X.label ? 48 : 28 };
    var pw = Math.max(10, W - m.l - m.r), ph = Math.max(10, H - m.t - m.b);
    var lx0 = X.log ? Math.log10(X.min) : X.min, lx1 = X.log ? Math.log10(X.max) : X.max;
    var xmap = function (v) { return m.l + ((X.log ? Math.log10(v) : v) - lx0) / (lx1 - lx0) * pw; };
    var ymap = function (v) { return m.t + ph - (v - Y.min) / (Y.max - Y.min) * ph; };
    var inv = function (px) { var t = lx0 + (px - m.l) / pw * (lx1 - lx0); return X.log ? Math.pow(10, t) : t; };
    var font = getComputedStyle(document.body).fontFamily;
    var ink = DL.css('--ink'), muted = DL.css('--muted'), grid = DL.css('--grid'), axis = DL.css('--axis');
    ctx.font = '12px ' + font;
    ctx.lineJoin = 'round';

    // horizontal grid and value labels
    var yt = Y.ticks || DL.niceTicks(Y.min, Y.max, 4), yfmt = Y.fmt || (Y.pct ? pctFmt(yt) : num);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    yt.forEach(function (v) {
      var y = Math.round(ymap(v)) + 0.5;
      if (y < m.t - 1 || y > m.t + ph + 1) return;
      ctx.strokeStyle = grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke();
      if (!Y.hideTicks) { ctx.fillStyle = muted; ctx.fillText(yfmt(v), m.l - 8, y); }
    });
    if (Y.label) { ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(Y.label, Y.hideTicks ? m.l : 6, 16); }

    // data layers, clipped to the plot area
    ctx.save();
    ctx.beginPath(); ctx.rect(m.l, m.t - 6, pw + 1, ph + 6); ctx.clip();
    var base = ymap(Math.max(Y.min, 0));
    (spec.layers || []).forEach(function (L) {
      if (!L) return;
      var i, c = color(L.color || '--c1');
      ctx.globalAlpha = L.alpha == null ? 1 : L.alpha;
      ctx.setLineDash(L.dash || []);
      if (L.type === 'bars') {
        for (i = 0; i < L.ys.length; i++) {
          if (!(L.ys[i] > 0)) continue;
          var a = L.edges ? xmap(L.edges[i][0]) : xmap(L.xs[i] - L.w / 2), b = L.edges ? xmap(L.edges[i][1]) : xmap(L.xs[i] + L.w / 2);
          var gap = Math.min(1.5, (b - a) * 0.12);
          ctx.fillStyle = L.colors ? color(L.colors[i]) : c;
          roundedBar(ctx, a + gap / 2, b - gap / 2, Math.min(ymap(L.ys[i]), base - 1), base);
        }
      } else if (L.type === 'line') {
        if (L.fill) {
          ctx.globalAlpha = L.fill; ctx.fillStyle = c;
          ctx.beginPath(); ctx.moveTo(xmap(L.xs[0]), base);
          for (i = 0; i < L.xs.length; i++) ctx.lineTo(xmap(L.xs[i]), ymap(L.ys[i]));
          ctx.lineTo(xmap(L.xs[L.xs.length - 1]), base); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = L.alpha == null ? 1 : L.alpha;
        }
        if (L.width !== 0) {
          ctx.strokeStyle = c; ctx.lineWidth = L.width || 2.25;
          ctx.beginPath();
          for (i = 0; i < L.xs.length; i++) { if (i) ctx.lineTo(xmap(L.xs[i]), ymap(L.ys[i])); else ctx.moveTo(xmap(L.xs[i]), ymap(L.ys[i])); }
          ctx.stroke();
        }
        if (L.dots) {
          ctx.setLineDash([]); ctx.fillStyle = c; ctx.strokeStyle = DL.css('--surface'); ctx.lineWidth = 1.5;
          for (i = 0; i < L.xs.length; i++) { ctx.beginPath(); ctx.arc(xmap(L.xs[i]), ymap(L.ys[i]), L.dots, 0, 6.2832); ctx.fill(); ctx.stroke(); }
        }
      } else if (L.type === 'band') {
        ctx.fillStyle = c;
        ctx.fillRect(xmap(L.x0), m.t - 6, xmap(L.x1) - xmap(L.x0), ph + 6);
      } else if (L.type === 'vline') {
        var vx = Math.round(xmap(L.x)) + 0.5;
        ctx.strokeStyle = c; ctx.lineWidth = L.width || 1.5;
        ctx.beginPath(); ctx.moveTo(vx, m.t - 6); ctx.lineTo(vx, m.t + ph); ctx.stroke();
      } else if (L.type === 'hline') {
        var hy = Math.round(ymap(L.y)) + 0.5;
        ctx.strokeStyle = c; ctx.lineWidth = L.width || 1.5;
        ctx.beginPath(); ctx.moveTo(m.l, hy); ctx.lineTo(m.l + pw, hy); ctx.stroke();
      } else if (L.type === 'point') {
        ctx.fillStyle = c; ctx.strokeStyle = DL.css('--surface'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(xmap(L.x), ymap(L.y), L.r || 5, 0, 6.2832); ctx.fill(); ctx.stroke();
      }
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // text notes sit above the data and are never clipped by it
    (spec.layers || []).forEach(function (L) {
      if (!L || !L.label) return;
      var tx, ty, align = L.align || 'left';
      if (L.type === 'vline') { tx = xmap(L.x) + (align === 'right' ? -6 : 6); ty = m.t + (L.labelY || 4) + 6; }
      else if (L.type === 'hline') { tx = align === 'right' ? m.l + pw - 4 : m.l + 6; ty = ymap(L.y) - 7; }
      else if (L.type === 'point' || L.type === 'text') { tx = xmap(L.x) + (L.dx == null ? 9 : L.dx); ty = ymap(L.y) + (L.dy == null ? -10 : L.dy); }
      else return;
      ctx.font = (L.bold ? '600 ' : '') + '12px ' + font;
      ctx.textAlign = align; ctx.textBaseline = 'middle';
      var tw = ctx.measureText(L.label).width, bx = align === 'right' ? tx - tw : align === 'center' ? tx - tw / 2 : tx;
      if (bx + tw > W - 2) { tx -= bx + tw - (W - 2); bx = W - 2 - tw; }
      if (bx < 2) { tx += 2 - bx; bx = 2; }
      ctx.fillStyle = DL.css('--surface'); ctx.globalAlpha = 0.86;
      ctx.fillRect(bx - 3, ty - 9, tw + 6, 18);
      ctx.globalAlpha = 1;
      ctx.fillStyle = L.labelColor ? color(L.labelColor) : ink;
      ctx.fillText(L.label, tx, ty);
    });
    ctx.font = '12px ' + font;

    // baseline and category labels
    ctx.strokeStyle = axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.l, Math.round(m.t + ph) + 0.5); ctx.lineTo(m.l + pw, Math.round(m.t + ph) + 0.5); ctx.stroke();
    var xt = X.ticks || (X.log ? logTicks(X.min, X.max) : DL.niceTicks(X.min, X.max, X.n || 6));
    var xfmt = X.fmt || (X.pct ? pctFmt(xt) : num), lastRight = -1e9;
    ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    xt.forEach(function (v) {
      var x = xmap(v);
      if (x < m.l - 1 || x > m.l + pw + 1) return;
      var lab = X.tickLabels && X.tickLabels[v] != null ? X.tickLabels[v] : xfmt(v), tw = ctx.measureText(lab).width;
      if (x - tw / 2 < lastRight + 6) return;
      lastRight = x + tw / 2;
      ctx.fillText(lab, x, m.t + ph + 7);
    });
    if (X.label) {
      // shrink a long axis title until it fits the canvas, then center it on the plot (or on the canvas if it is wider than the plot)
      var size = 12;
      while (size > 9.5 && ctx.measureText(X.label).width > W - 8) { size -= 0.5; ctx.font = size + 'px ' + font; }
      var lw = ctx.measureText(X.label).width, lx = Math.min(Math.max(m.l + pw / 2, lw / 2 + 4), W - lw / 2 - 4);
      ctx.fillStyle = muted; ctx.fillText(X.label, lx, m.t + ph + 27);
      ctx.font = '12px ' + font;
    }

    canvas._geo = { m: m, pw: pw, ph: ph, xmap: xmap, ymap: ymap, inv: inv };
  };

  // A floating note and a thin guide line for a canvas. Returns show(px, py, html, guideX) and hide().
  DL.tipFor = function (canvas) {
    var wrap = canvas.parentElement;
    var tip = document.createElement('div'), guide = document.createElement('div');
    tip.className = 'tip'; guide.className = 'guide';
    tip.hidden = true; guide.hidden = true;
    wrap.appendChild(guide); wrap.appendChild(tip);
    return {
      show: function (px, py, html, gx, top, height) {
        tip.innerHTML = html; tip.hidden = false;
        var left = canvas.offsetLeft + px + 14;
        if (left + tip.offsetWidth > wrap.clientWidth - 4) left = canvas.offsetLeft + px - 14 - tip.offsetWidth;
        tip.style.left = Math.max(2, left) + 'px';
        tip.style.top = (canvas.offsetTop + Math.max(4, py - tip.offsetHeight - 8)) + 'px';
        guide.hidden = gx == null;
        if (gx != null) { guide.style.left = (canvas.offsetLeft + gx) + 'px'; guide.style.top = (canvas.offsetTop + top) + 'px'; guide.style.height = height + 'px'; }
      },
      hide: function () { tip.hidden = true; guide.hidden = true; }
    };
  };

  // Hover for charts drawn with DL.plot. fn(xValue) returns { x: value to snap the guide to, html } or null.
  DL.hover = function (canvas, fn) {
    var t = DL.tipFor(canvas);
    canvas.addEventListener('pointermove', function (e) {
      var g = canvas._geo;
      if (!g) return;
      var r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (px < g.m.l - 6 || px > g.m.l + g.pw + 6 || py < g.m.t - 6 || py > g.m.t + g.ph + 6) { t.hide(); return; }
      var res = fn(g.inv(px));
      if (!res) { t.hide(); return; }
      t.show(res.x != null ? g.xmap(res.x) : px, py, res.html, res.x != null ? g.xmap(res.x) : null, g.m.t, g.ph);
    });
    canvas.addEventListener('pointerleave', t.hide);
  };
})();
