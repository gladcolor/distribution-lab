/* Checks for core.js. Run with: node test_core.js */
'use strict';
var DL = require('./core.js');
var pass = 0, fail = 0;

function check(name, ok, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : ''));
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }
function sum(f, n) { var s = 0; for (var k = 0; k <= n; k++) s += f(k); return s; }
function draws(n, f) { var a = []; for (var i = 0; i < n; i++) a.push(f()); return a; }

// probability functions add up to 1 and have the right mean
check('binomial pmf sums to 1', near(sum(function (k) { return DL.pmfBinom(k, 20, 0.3); }, 20), 1, 1e-10));
check('binomial mean', near(sum(function (k) { return k * DL.pmfBinom(k, 20, 0.3); }, 20), 6, 1e-9));
check('poisson pmf sums to 1', near(sum(function (k) { return DL.pmfPoisson(k, 4.2); }, 80), 1, 1e-10));
check('poisson P(0)', near(DL.pmfPoisson(0, 2), Math.exp(-2), 1e-12));
check('NB pmf sums to 1', near(sum(function (k) { return DL.pmfNB(k, 4, 0.8); }, 2000), 1, 1e-8));
check('NB mean', near(sum(function (k) { return k * DL.pmfNB(k, 4, 0.8); }, 4000), 4, 1e-5));
check('NB P(0) formula', near(DL.pmfNB(0, 4, 0.8), Math.pow(1 + 4 / 0.8, -0.8), 1e-12));
check('NB with huge k is Poisson', near(DL.pmfNB(3, 2, 1e7), DL.pmfPoisson(3, 2), 1e-6));
check('ZINB zero share', near(DL.pmfZINB(0, 0.35, 6, 0.7), 0.35 + 0.65 * Math.pow(1 + 6 / 0.7, -0.7), 1e-12));
check('lgamma(5) = ln 24', near(DL.lgamma(5), Math.log(24), 1e-10));
check('lgamma(0.5) = ln sqrt(pi)', near(DL.lgamma(0.5), 0.5 * Math.log(Math.PI), 1e-10));
check('normal cdf at 1.96', near(DL.cdfNormal(1.96), 0.975, 1e-4));
check('normal cdf at -1.2816', near(DL.cdfNormal(-1.2815515655), 0.1, 1e-4));

// densities integrate to 1
function integrate(f, a, b, n) { var s = 0, h = (b - a) / n; for (var i = 0; i < n; i++) s += f(a + (i + 0.5) * h) * h; return s; }
check('lognormal pdf integrates to 1', near(integrate(function (x) { return DL.pdfLognormal(x, 3, 0.9); }, 0, 5000, 400000), 1, 1e-3));
check('beta pdf integrates to 1', near(integrate(function (x) { return DL.pdfBeta(x, 4, 18); }, 0, 1, 20000), 1, 1e-6));
var q = DL.betaQuantiles(4, 18, [0.025, 0.5, 0.975]);
check('beta quantiles ordered and sensible', q[0] < q[1] && q[1] < q[2] && near(q[1], 0.172, 0.01) && near(q[0], 0.054, 0.006) && near(q[2], 0.363, 0.01), q.map(function (v) { return v.toFixed(3); }).join(' '));
var q2 = DL.betaQuantiles(1, 21, [0.975]);
check('beta upper limit when nothing is found (0 of 20)', near(q2[0], 1 - Math.pow(0.025, 1 / 21), 2e-3), q2[0].toFixed(4));

// samplers match theory
var u = DL.rng(12345), N = 200000, a;
a = draws(N, function () { return DL.rNormal(u); });
check('normal sampler mean and variance', near(DL.mean(a), 0, 0.01) && near(DL.variance(a), 1, 0.02));
a = draws(N, function () { return DL.rGamma(u, 0.6, 2); });
check('gamma sampler, shape below 1', near(DL.mean(a), 1.2, 0.02) && near(DL.variance(a), 2.4, 0.08), DL.mean(a).toFixed(3) + ' ' + DL.variance(a).toFixed(3));
a = draws(N, function () { return DL.rGamma(u, 5, 0.5); });
check('gamma sampler, shape above 1', near(DL.mean(a), 2.5, 0.02) && near(DL.variance(a), 1.25, 0.04));
a = draws(N, function () { return DL.rPoisson(u, 3.5); });
check('poisson sampler, small mean', near(DL.mean(a), 3.5, 0.02) && near(DL.variance(a), 3.5, 0.06));
a = draws(N, function () { return DL.rPoisson(u, 120); });
check('poisson sampler, large mean', near(DL.mean(a), 120, 0.15) && near(DL.variance(a), 120, 1.5), DL.mean(a).toFixed(2) + ' ' + DL.variance(a).toFixed(2));
var t = DL.tally(a.map(function (v) { return v; }), 400);
check('poisson sampler, large mean, matches pmf at the mode', near(t[120], DL.pmfPoisson(120, 120), 0.002));
a = draws(N, function () { return DL.rNB(u, 4, 0.8); });
check('NB sampler mean and variance', near(DL.mean(a), 4, 0.05) && near(DL.variance(a), 4 + 16 / 0.8, 0.8), DL.mean(a).toFixed(3) + ' ' + DL.variance(a).toFixed(2));
check('NB sampler zero share', near(DL.tally(a, 50)[0], DL.pmfNB(0, 4, 0.8), 0.004));
a = draws(N, function () { return DL.rZINB(u, 0.35, 6, 0.7); });
check('ZINB sampler mean and zero share', near(DL.mean(a), 0.65 * 6, 0.06) && near(DL.tally(a, 50)[0], DL.pmfZINB(0, 0.35, 6, 0.7), 0.004));
a = draws(N, function () { return DL.rBinom(u, 20, 0.25); });
check('binomial sampler', near(DL.mean(a), 5, 0.03) && near(DL.variance(a), 3.75, 0.06));
a = draws(N, function () { return DL.rLognormal(u, 3, 0.9); });
a.sort(function (x, y) { return x - y; });
check('lognormal sampler median and mean', near(DL.quantile(a, 0.5), Math.exp(3), 0.3) && near(DL.mean(a), Math.exp(3 + 0.405), 0.5), DL.quantile(a, 0.5).toFixed(2) + ' ' + DL.mean(a).toFixed(2));
a = draws(N, function () { return DL.rBeta(u, 4, 18); });
check('beta sampler mean', near(DL.mean(a), 4 / 22, 0.002));
a = draws(N, function () { return DL.rLifeDays(u, 0.85); });
check('lifetime sampler: share alive after 10 days', near(a.filter(function (d) { return d >= 10; }).length / N, Math.pow(0.85, 10), 0.004));

// simulators
u = DL.rng(99);
var tot = 0, vm = 0, reps = 300, i;
for (i = 0; i < reps; i++) { var c = DL.quadratCounts(DL.field(u, 288, 0), 12); tot += DL.mean(c); vm += DL.variance(c) / DL.mean(c); }
check('random field: mean per cell and variance to mean ratio near 1', near(tot / reps, 2, 0.03) && near(vm / reps, 1, 0.05), (tot / reps).toFixed(3) + ' ' + (vm / reps).toFixed(3));
tot = 0; vm = 0;
for (i = 0; i < reps; i++) { c = DL.quadratCounts(DL.field(u, 288, 0.6), 12); tot += DL.mean(c); vm += DL.variance(c) / DL.mean(c); }
check('clumped field: same mean, variance to mean ratio well above 1', near(tot / reps, 2, 0.12) && vm / reps > 3, (tot / reps).toFixed(3) + ' ' + (vm / reps).toFixed(2));
var cc = DL.concentration([10, 40, 30, 20]);
check('concentration curve of 40, 30, 20, 10', near(cc.y[1], 0.4, 1e-12) && near(cc.y[2], 0.7, 1e-12) && near(cc.gini, 0.25, 1e-12));
check('concentration of equal values has Gini 0', near(DL.concentration([5, 5, 5, 5]).gini, 0, 1e-12));
check('top share', near(DL.topShare([40, 20, 30, 10], [0, 1, 2, 3], 2), 0.6, 1e-12));
var sh = DL.shuffle(DL.rng(5), [1, 2, 3, 4, 5, 6]).slice().sort().join('');
check('shuffle keeps all items', sh === '123456');
check('upper quantile helper', DL.upper(function (k) { return DL.pmfPoisson(k, 2); }, 0.99, 100) === 6);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
