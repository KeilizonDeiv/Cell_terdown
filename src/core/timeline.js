// Pure scroll → scene-state mapping. No DOM, no Three.js: easy to reason about and test.
// `t` is "section units": 0 at the top of the hero, 1 at the top of the specs section, etc.
// Section order comes from the cell's data, so every cell type gets the same story shape:
//   hero · specs · part 1 … part N · power · analytics

export function sectionsFor(cell) {
  return ['hero', 'specs', ...cell.parts.map((p) => p.id), 'power', 'analytics'];
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (t, a, b) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const mix = (a, b, k) => a + (b - a) * k;
// Plateau around the middle of a section, fading near its edges.
const focusOf = (t, i) => clamp(1 - (Math.abs(t - (i + 0.5)) - 0.3) / 0.22);
// "Happens as you enter section i" (0 → 1).
const enterOf = (t, i) => smooth(t, i - 0.2, i + 0.3);

export function computeState(t, cell, frame) {
  const ids = sectionsFor(cell);
  const S = Object.fromEntries(ids.map((id, i) => [id, i]));
  const reassemble = smooth(t, S.power - 0.25, S.power + 0.3);
  const keep = 1 - reassemble;

  const focus = {}, enter = {};
  for (const p of cell.parts) {
    focus[p.id] = focusOf(t, S[p.id]);
    enter[p.id] = enterOf(t, S[p.id]) * keep;
  }
  // The first part is shown in place; taking things apart starts with the second.
  const exploded = enter[cell.parts[1].id];
  const settle = smooth(t, S.specs + 0.2, S[cell.parts[0].id] + 0.1) * (1 - smooth(t, S.power - 0.1, S.power + 0.5));

  // Camera framing box (world units), blended hero → exploded → power. Model supplies the sizes.
  const hh = mix(mix(frame.hero.hh, frame.exploded.hh, exploded), frame.power.hh, reassemble);
  const hwWide = mix(mix(frame.hero.hw, frame.exploded.hwWide, exploded), frame.power.hw, reassemble);
  const hwNarrow = mix(mix(frame.hero.hw, frame.exploded.hwNarrow, exploded), frame.power.hw, reassemble);

  return {
    t, ids,
    focus, enter, keep, exploded, settle,
    pull: { cathode: focus.cathode || 0, separator: focus.separator || 0, anode: focus.anode || 0 },
    ions: focus.electrolyte || 0,
    power: smooth(t, S.power - 0.15, S.power + 0.35) * (1 - smooth(t, S.analytics - 0.1, S.analytics + 0.3)),
    specs: focusOf(t, S.specs),
    analytics: smooth(t, S.analytics - 0.35, S.analytics - 0.05),
    frame: { hh, hwWide, hwNarrow },
    camY: 1.2 + 1.4 * exploded,
    partIndex: clamp(Math.floor(t) - 2, -1, cell.parts.length - 1),
    progress: clamp((t - 2) / cell.parts.length),
  };
}
