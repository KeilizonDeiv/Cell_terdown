// Pure maths used by the analytics section. No DOM, so it is unit-tested in tests/calc.test.js.
import { derive } from '../data/cells.js';

/** Share of stored energy a pack actually delivers (conversion losses + reserve). */
export const USABLE = 0.92;

/** Cells, cell mass and estimated range for a pack of `packKWh` built from `cell`. */
export function packStats(cell, packKWh, whPerKm) {
  const { wh } = derive(cell);
  const cells = Math.ceil((packKWh * 1000) / wh);
  return {
    cells,
    massKg: cells * cell.massKg,
    rangeKm: (packKWh * 1000 * USABLE) / whPerKm,
  };
}

/** Hours an energy store (Wh) can supply a steady load (W). */
export function runtimeHours(energyWh, watts) {
  if (!(watts > 0)) return 0;
  return (energyWh * USABLE) / watts;
}

/** "45 min", "2 h 21 min", "3.5 days". Rounds minutes, never shows "60 min". */
export function formatDuration(h) {
  if (!Number.isFinite(h) || h < 0) return '–';
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin} min`;
  if (h < 48) {
    const hh = Math.floor(totalMin / 60), mm = totalMin % 60;
    return `${hh} h${mm ? ' ' + mm + ' min' : ''}`;
  }
  return `${(h / 24).toLocaleString('en-US', { maximumFractionDigits: 1 })} days`;
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson) through [x, y] points sorted by x.
 * Smooth like a spline but never overshoots, so a discharge curve can't bump upward.
 */
export function monotone(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (n < 2) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    const xc = Math.min(xs[n - 1], Math.max(xs[0], x));
    let i = 0;
    while (i < n - 2 && xc > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (xc - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
