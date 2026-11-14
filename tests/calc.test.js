import { describe, it, expect } from 'vitest';
import { packStats, runtimeHours, formatDuration, monotone, USABLE } from '../src/core/calc.js';
import { CELLS, derive } from '../src/data/cells.js';

describe('packStats', () => {
  it('rounds cell count up so the pack is never undersized', () => {
    const c = CELLS.prismatic; // 280 Ah × 3.2 V = 896 Wh
    const s = packStats(c, 100, 165);
    expect(s.cells).toBe(112);                    // 100 000 / 896 = 111.6 → 112
    expect(s.cells * derive(c).wh).toBeGreaterThanOrEqual(100_000);
    expect(s.massKg).toBeCloseTo(112 * 5.4, 6);
    expect(s.rangeKm).toBeCloseTo((100_000 * USABLE) / 165, 6);
  });
});

describe('runtimeHours', () => {
  it('divides usable energy by load', () => {
    expect(runtimeHours(896, 350)).toBeCloseTo((896 * USABLE) / 350, 9);
  });
  it('returns 0 for a zero or invalid load instead of Infinity/NaN', () => {
    expect(runtimeHours(100, 0)).toBe(0);
    expect(runtimeHours(100, -5)).toBe(0);
    expect(runtimeHours(100, NaN)).toBe(0);
  });
});

describe('formatDuration', () => {
  it.each([
    [0.25, '15 min'],
    [59.6 / 60, '1 h'],          // rounds to 60 min → shown as 1 h, never "60 min"
    [2.355, '2 h 21 min'],
    [3, '3 h'],
    [72, '3 days'],
  ])('%s h → %s', (h, out) => expect(formatDuration(h)).toBe(out));
  it('handles bad input', () => {
    expect(formatDuration(NaN)).toBe('–');
    expect(formatDuration(-1)).toBe('–');
  });
});

describe('monotone', () => {
  const pts = [[0, 4.2], [0.3, 3.9], [0.6, 3.7], [1, 3.0]];
  const f = monotone(pts);
  it('passes through every control point', () => {
    for (const [x, y] of pts) expect(f(x)).toBeCloseTo(y, 9);
  });
  it('never rises on a falling curve (no overshoot)', () => {
    let prev = Infinity;
    for (let i = 0; i <= 200; i++) { const v = f(i / 200); expect(v).toBeLessThanOrEqual(prev + 1e-12); prev = v; }
  });
  it('clamps outside the data range', () => {
    expect(f(-1)).toBeCloseTo(4.2, 9);
    expect(f(2)).toBeCloseTo(3.0, 9);
  });
});
