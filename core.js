/* Distributions in the Field: math, random numbers and simulators.
   Plain script: in a browser it defines window.DL, in Node it is module.exports. No dependencies. */
(function (root) {
  'use strict';
  var DL = {};

  /* ---------- random numbers ---------- */
  // mulberry32: small, fast, seedable. Returns a function that gives uniform numbers in [0, 1).
  DL.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  DL.rNormal = function (u) {
    var a = 0;
    while (a === 0) a = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
  };

  // Gamma(shape, scale) by Marsaglia and Tsang (2000).
  DL.rGamma = function (u, shape, scale) {
    if (shape < 1) {
      var a = 0;
      while (a === 0) a = u();
      return DL.rGamma(u, shape + 1, scale) * Math.pow(a, 1 / shape);
    }
    var d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      var x, v;
      do { x = DL.rNormal(u); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      var w = u();
      if (w < 1 - 0.0331 * x * x * x * x) return d * v * scale;
      if (Math.log(w) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
    }
  };

  // Poisson: multiplication method for small means, transformed rejection (Hormann 1993) for large ones.
  DL.rPoisson = function (u, lam) {
    if (!(lam > 0)) return 0;
    if (lam < 30) {
      var L = Math.exp(-lam), k = 0, p = 1;
      do { k++; p *= u(); } while (p > L);
      return k - 1;
    }
    var slam = Math.sqrt(lam), loglam = Math.log(lam);
    var b = 0.931 + 2.53 * slam, a = -0.059 + 0.02483 * b;
    var invalpha = 1.1239 + 1.1328 / (b - 3.4), vr = 0.9277 - 3.6224 / (b - 2);
    for (;;) {
      var U = u() - 0.5, V = u(), us = 0.5 - Math.abs(U);
      var kk = Math.floor((2 * a / us + b) * U + lam + 0.43);
      if (us >= 0.07 && V <= vr) return kk;
      if (kk < 0 || (us < 0.013 && V > us)) continue;
      if (Math.log(V) + Math.log(invalpha) - Math.log(a / (us * us) + b) <= -lam + kk * loglam - DL.lgamma(kk + 1)) return kk;
    }
  };

  DL.rBinom = function (u, n, p) {
    var k = 0;
    for (var i = 0; i < n; i++) if (u() < p) k++;
    return k;
  };

  // Negative binomial with mean m and aggregation k: a Poisson count whose rate is gamma distributed.
  DL.rNB = function (u, m, k) {
    if (!(m > 0)) return 0;
    return DL.rPoisson(u, DL.rGamma(u, k, m / k));
  };

  // Zero-inflated negative binomial: with chance pi the unit cannot produce at all.
  DL.rZINB = function (u, pi, m, k) {
    return u() < pi ? 0 : DL.rNB(u, m, k);
  };

  DL.rLognormal = function (u, mu, sigma) { return Math.exp(mu + sigma * DL.rNormal(u)); };

  DL.rBeta = function (u, a, b) {
    var x = DL.rGamma(u, a, 1), y = DL.rGamma(u, b, 1);
    return x / (x + y);
  };

  // Whole days lived when each day is survived with chance p.
  DL.rLifeDays = function (u, p) {
    var a = 0;
    while (a === 0) a = u();
    return Math.floor(Math.log(a) / Math.log(p));
  };

  DL.shuffle = function (u, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(u() * (i + 1)), t = arr[i];
      arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /* ---------- special functions, probability functions ---------- */
  DL.lgamma = function (x) {
    var c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - DL.lgamma(1 - x);
    x -= 1;
    var a = c[0], t = x + 7.5;
    for (var i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  };

  DL.pmfBinom = function (k, n, p) {
    if (k < 0 || k > n) return 0;
    if (p <= 0) return k === 0 ? 1 : 0;
    if (p >= 1) return k === n ? 1 : 0;
    return Math.exp(DL.lgamma(n + 1) - DL.lgamma(k + 1) - DL.lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  };

  DL.pmfPoisson = function (k, lam) {
    if (k < 0) return 0;
    if (!(lam > 0)) return k === 0 ? 1 : 0;
    return Math.exp(k * Math.log(lam) - lam - DL.lgamma(k + 1));
  };

  DL.pmfNB = function (k, m, r) {
    if (k < 0) return 0;
    if (!(m > 0)) return k === 0 ? 1 : 0;
    return Math.exp(DL.lgamma(k + r) - DL.lgamma(r) - DL.lgamma(k + 1) + r * Math.log(r / (r + m)) + k * Math.log(m / (r + m)));
  };

  DL.pmfZINB = function (k, pi, m, r) {
    return (k === 0 ? pi : 0) + (1 - pi) * DL.pmfNB(k, m, r);
  };

  DL.pdfNormal = function (x, mu, sd) {
    var z = (x - mu) / sd;
    return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
  };

  DL.pdfLognormal = function (x, mu, sigma) {
    if (!(x > 0)) return 0;
    var z = (Math.log(x) - mu) / sigma;
    return Math.exp(-0.5 * z * z) / (x * sigma * Math.sqrt(2 * Math.PI));
  };

  DL.pdfBeta = function (x, a, b) {
    if (x <= 0 || x >= 1) {
      if (x === 0 && a === 1) return b;
      if (x === 1 && b === 1) return a;
      return 0;
    }
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) + DL.lgamma(a + b) - DL.lgamma(a) - DL.lgamma(b));
  };

  // Standard normal cumulative probability (Abramowitz and Stegun 7.1.26, error below 1.5e-7).
  DL.cdfNormal = function (z) {
    var t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  };

  // Quantiles of Beta(a, b) for a, b >= 1, by summing the density on a fine grid.
  DL.betaQuantiles = function (a, b, probs) {
    var N = 4000, cum = new Array(N + 1), total = 0, i;
    cum[0] = 0;
    for (i = 0; i < N; i++) {
      total += DL.pdfBeta((i + 0.5) / N, a, b) / N;
      cum[i + 1] = total;
    }
    return probs.map(function (p) {
      var target = p * total, lo = 0, hi = N;
      while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (cum[mid] < target) lo = mid; else hi = mid;
      }
      var span = cum[hi] - cum[lo];
      return (lo + (span > 0 ? (target - cum[lo]) / span : 0)) / N;
    });
  };

  /* ---------- summaries ---------- */
  DL.mean = function (a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return a.length ? s / a.length : NaN;
  };

  DL.variance = function (a) {
    if (a.length < 2) return NaN;
    var m = DL.mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return s / (a.length - 1);
  };

  DL.quantile = function (sorted, p) {
    if (!sorted.length) return NaN;
    var h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
  };

  // Share of observations at each whole number 0..maxK; values above maxK are pooled into the last cell.
  DL.tally = function (a, maxK) {
    var t = new Array(maxK + 1).fill(0);
    for (var i = 0; i < a.length; i++) t[Math.min(maxK, a[i])]++;
    return t.map(function (c) { return a.length ? c / a.length : 0; });
  };

  // Smallest whole number x with P(X <= x) >= prob, for a probability function f(k).
  DL.upper = function (f, prob, cap) {
    var s = 0;
    for (var k = 0; k < cap; k++) {
      s += f(k);
      if (s >= prob) return k;
    }
    return cap;
  };

  /* ---------- simulators ---------- */
  // Points in the unit square. clump = 0 gives complete spatial randomness; larger values give a
  // Thomas cluster process (random parents, each with a Poisson number of offspring scattered nearby).
  DL.field = function (u, n, clump) {
    var pts = [], i, j;
    if (clump < 0.001) {
      var N = DL.rPoisson(u, n);
      for (i = 0; i < N; i++) pts.push([u(), u()]);
      return pts;
    }
    var perCluster = 1 + clump * 39, spread = 0.07 - 0.045 * clump;
    var parents = DL.rPoisson(u, n / perCluster);
    for (i = 0; i < parents; i++) {
      var px = u(), py = u(), m = DL.rPoisson(u, perCluster);
      for (j = 0; j < m; j++) {
        var x = px + spread * DL.rNormal(u), y = py + spread * DL.rNormal(u);
        pts.push([x - Math.floor(x), y - Math.floor(y)]);
      }
    }
    return pts;
  };

  DL.quadratCounts = function (pts, g) {
    var c = new Array(g * g).fill(0);
    for (var i = 0; i < pts.length; i++) {
      var cx = Math.min(g - 1, Math.floor(pts[i][0] * g)), cy = Math.min(g - 1, Math.floor(pts[i][1] * g));
      c[cy * g + cx]++;
    }
    return c;
  };

  // Coverage curve: units sorted from largest to smallest, cumulative share of the total.
  // Returns x and y arrays of length n + 1 and the Gini coefficient.
  DL.concentration = function (values) {
    var v = values.slice().sort(function (a, b) { return b - a; }), n = v.length, total = 0, i;
    for (i = 0; i < n; i++) total += v[i];
    var x = [0], y = [0], run = 0, area = 0;
    for (i = 0; i < n; i++) {
      run += v[i];
      x.push((i + 1) / n);
      y.push(total > 0 ? run / total : 0);
      area += (y[i] + y[i + 1]) / (2 * n);
    }
    return { x: x, y: y, gini: 2 * area - 1, total: total };
  };

  // Share of the total held by the first `half` units when units are taken in the given order.
  DL.topShare = function (counts, order, half) {
    var top = 0, total = 0;
    for (var i = 0; i < order.length; i++) {
      var c = counts[order[i]];
      total += c;
      if (i < half) top += c;
    }
    return total > 0 ? top / total : NaN;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DL;
  else root.DL = DL;
})(typeof window !== 'undefined' ? window : this);
