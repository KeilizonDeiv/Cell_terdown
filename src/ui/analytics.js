// Power analytics: cell-vs-cell bars, discharge curves, pack and runtime calculators.
// Plain SVG, drawn at the container's real width so text stays readable on phones.
import { CELLS, CELL_ORDER, derive } from '../data/cells.js';
import { packStats, runtimeHours, formatDuration, monotone } from '../core/calc.js';

const NS = 'http://www.w3.org/2000/svg';
const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

const DEVICES = [
  { id: 'phone', name: 'Phone', watts: 4, note: 'average use' },
  { id: 'laptop', name: 'Laptop', watts: 40, note: 'working' },
  { id: 'ebike', name: 'E-bike', watts: 350, note: 'motor, riding' },
  { id: 'car', name: 'Electric car', watts: 18000, note: 'highway cruising' },
];

export function createAnalytics({ onSelect }) {
  const tip = document.getElementById('tip');
  const state = { active: 'cyl4680', packKWh: 75, whPerKm: 165, device: 'ebike', source: 'cell' };
  const $ = (id) => document.getElementById(id);

  // ---------- shared tooltip ----------
  function showTip(evt, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 12, evt.clientX + 14);
    tip.style.transform = `translate(${Math.max(8, x)}px, ${evt.clientY - tip.offsetHeight - 12}px)`;
  }
  const hideTip = () => { tip.hidden = true; };

  // ---------- segmented controls ----------
  function segmented(container, items, current, onPick) {
    container.replaceChildren();
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn';
      b.setAttribute('aria-pressed', String(it.id === current));
      b.innerHTML = it.swatch ? `<i style="background:${it.swatch}"></i>${it.label}` : it.label;
      b.addEventListener('click', () => onPick(it.id));
      container.appendChild(b);
    }
  }

  // ---------- horizontal bar chart (one metric, three cells) ----------
  function bars(container, rows, { unit, digits = 0, title }) {
    container.replaceChildren();
    const w = Math.max(240, container.clientWidth);
    const labelW = Math.min(118, w * 0.34), valueW = 74, rowH = 30, top = title ? 22 : 4;
    const svg = el('svg', { width: w, height: top + rows.length * rowH, role: 'img', 'aria-label': title || '' }, container);
    if (title) el('text', { x: 0, y: 13, class: 'ax-title' }, svg).textContent = title;
    const max = Math.max(...rows.map((r) => r.value)) || 1;
    const span = w - labelW - valueW;
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      const bw = Math.max(3, (r.value / max) * span);
      const g = el('g', { class: 'bar-row' + (r.active ? ' is-active' : '') }, svg);
      el('text', { x: 0, y: y + 17, class: 'bar-label' }, g).textContent = r.label;
      // 4px rounded data-end, square at the baseline: path instead of rx on both ends.
      const x0 = labelW, x1 = labelW + bw, h = 12, yb = y + 7, rr = Math.min(4, bw / 2);
      el('path', { d: `M${x0},${yb} H${x1 - rr} Q${x1},${yb} ${x1},${yb + rr} V${yb + h - rr} Q${x1},${yb + h} ${x1 - rr},${yb + h} H${x0} Z`, fill: r.color, opacity: r.active ? 1 : 0.55 }, g);
      el('text', { x: x1 + 8, y: y + 17, class: 'bar-value' }, g).textContent = `${fmt(r.value, digits)} ${unit}`;
      const hit = el('rect', { x: 0, y, width: w, height: rowH, fill: 'transparent' }, g);
      hit.addEventListener('pointermove', (e) => showTip(e, `<b>${r.label}</b><br>${fmt(r.value, digits)} ${unit}${r.extra ? '<br>' + r.extra : ''}`));
      hit.addEventListener('pointerleave', hideTip);
    });
  }

  const cellRows = (valueOf, extraOf) => CELL_ORDER.map((id) => {
    const c = CELLS[id];
    return { id, label: c.short, color: c.color, value: valueOf(c, derive(c)), active: id === state.active, extra: extraOf?.(c, derive(c)) };
  });

  // ---------- 1 · compare ----------
  function renderCompare() {
    bars($('cmpEnergy'), cellRows((c, k) => k.wh), { unit: 'Wh', title: 'Energy per cell' });
    bars($('cmpMass'), cellRows((c) => c.massKg), { unit: 'kg', digits: 2, title: 'Mass per cell' });
    bars($('cmpGrav'), cellRows((c, k) => k.whPerKg), { unit: 'Wh/kg', title: 'Energy per kilogram' });
    bars($('cmpVol'), cellRows((c, k) => k.whPerL), { unit: 'Wh/L', title: 'Energy per liter' });
  }

  // ---------- 2 · discharge curve ----------
  function renderCurve() {
    const box = $('curveChart');
    box.replaceChildren();
    const w = Math.max(260, box.clientWidth), h = 250;
    const m = { l: 40, r: 12, t: 12, b: 34 };
    const X = (s) => m.l + s * (w - m.l - m.r);
    const vMin = 2.5, vMax = 4.3;
    const Y = (v) => m.t + (1 - (v - vMin) / (vMax - vMin)) * (h - m.t - m.b);
    const svg = el('svg', { width: w, height: h, role: 'img', 'aria-label': 'Voltage versus capacity used for each cell type' }, box);
    for (const v of [2.5, 3.0, 3.5, 4.0]) {
      el('line', { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
      el('text', { x: m.l - 6, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = v.toFixed(1);
    }
    for (const s of [0, 0.25, 0.5, 0.75, 1]) el('text', { x: X(s), y: h - m.b + 18, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = `${s * 100}%`;
    el('text', { x: w - m.r, y: h - 4, class: 'ax-title', 'text-anchor': 'end' }, svg).textContent = 'Capacity used →';
    el('text', { x: m.l, y: m.t - 2, class: 'ax-title' }, svg).textContent = 'Volts';

    const fns = {};
    // Draw inactive cells first so the selected one sits on top.
    const order = [...CELL_ORDER].sort((a, b) => (a === state.active) - (b === state.active));
    for (const id of order) {
      const c = CELLS[id];
      const f = monotone(c.curve);
      fns[id] = f;
      let d = '';
      for (let i = 0; i <= 120; i++) { const s = i / 120; d += `${i ? 'L' : 'M'}${X(s).toFixed(1)},${Y(f(s)).toFixed(1)}`; }
      el('path', { d, fill: 'none', stroke: c.color, 'stroke-width': id === state.active ? 2.5 : 2, opacity: id === state.active ? 1 : 0.6, 'stroke-linejoin': 'round' }, svg);
    }
    // Direct labels on the plateau, nudged so the two NMC curves don't collide.
    const nudge = { pouch: -10, cyl4680: 16, prismatic: -10 };
    for (const id of CELL_ORDER) el('text', { x: X(0.3), y: Y(fns[id](0.3)) + nudge[id], class: 'direct' }, svg).textContent = `${CELLS[id].short} · ${CELLS[id].chemistry}`;

    // Crosshair + tooltip
    const cross = el('line', { y1: m.t, y2: h - m.b, class: 'cross', opacity: 0 }, svg);
    const dots = CELL_ORDER.map((id) => el('circle', { r: 4, fill: CELLS[id].color, stroke: 'var(--ink-2)', 'stroke-width': 2, opacity: 0 }, svg));
    const hit = el('rect', { x: m.l, y: m.t, width: w - m.l - m.r, height: h - m.t - m.b, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, (e.clientX - r.left - m.l) / (w - m.l - m.r)));
      cross.setAttribute('x1', X(s)); cross.setAttribute('x2', X(s)); cross.setAttribute('opacity', 1);
      CELL_ORDER.forEach((id, i) => { dots[i].setAttribute('cx', X(s)); dots[i].setAttribute('cy', Y(fns[id](s))); dots[i].setAttribute('opacity', 1); });
      showTip(e, `<b>${Math.round(s * 100)}% used</b>` + CELL_ORDER.map((id) => `<br><i style="background:${CELLS[id].color}"></i>${CELLS[id].short}: ${fns[id](s).toFixed(2)} V`).join(''));
    });
    hit.addEventListener('pointerleave', () => { hideTip(); cross.setAttribute('opacity', 0); dots.forEach((d) => d.setAttribute('opacity', 0)); });
  }

  // ---------- 3 · pack calculator ----------
  function renderPack() {
    const c = CELLS[state.active];
    const { cells, massKg: mass, rangeKm: range } = packStats(c, state.packKWh, state.whPerKm);
    $('packKWhOut').textContent = `${state.packKWh} kWh`;
    $('whKmOut').textContent = `${state.whPerKm} Wh/km`;
    $('packCells').textContent = fmt(cells);
    $('packMass').textContent = fmt(mass);
    $('packRange').textContent = fmt(range);
    $('packCellName').textContent = c.name;
    bars($('packBars'), cellRows(
      (cc) => packStats(cc, state.packKWh, state.whPerKm).massKg,
      (cc) => `${fmt(packStats(cc, state.packKWh, state.whPerKm).cells)} cells`,
    ), { unit: 'kg', title: `Cell mass for a ${state.packKWh} kWh pack` });
  }

  // ---------- 4 · runtime ----------
  function renderRuntime() {
    const dev = DEVICES.find((d) => d.id === state.device);
    segmented($('devicePick'), DEVICES.map((d) => ({ id: d.id, label: d.name })), state.device, (id) => { state.device = id; renderRuntime(); });
    segmented($('sourcePick'), [{ id: 'cell', label: 'One cell' }, { id: 'pack', label: `${state.packKWh} kWh pack` }], state.source, (id) => { state.source = id; renderRuntime(); });
    const c = CELLS[state.active], k = derive(c);
    const energy = state.source === 'cell' ? k.wh : state.packKWh * 1000;
    $('runOut').textContent = formatDuration(runtimeHours(energy, dev.watts));
    $('runNote').textContent = `${state.source === 'cell' ? 'One ' + c.name + ' cell' : 'A ' + state.packKWh + ' kWh pack'} running ${/^[aeiou]/i.test(dev.name) ? 'an' : 'a'} ${dev.name.toLowerCase()} at ${fmt(dev.watts)} W (${dev.note}).`;
    // Big loads drain one cell in minutes, so switch the unit instead of showing 0.004 h.
    const useMin = dev.watts >= 300;
    bars($('runBars'), cellRows((cc, kk) => runtimeHours(kk.wh, dev.watts) * (useMin ? 60 : 1)),
      { unit: useMin ? 'min' : 'h', digits: 1, title: `One cell of each type, ${dev.name.toLowerCase()}` });
  }

  function renderAll() {
    segmented($('anPick'), CELL_ORDER.map((id) => ({ id, label: CELLS[id].short, swatch: CELLS[id].color })), state.active, (id) => onSelect(id));
    renderCompare(); renderCurve(); renderPack(); renderRuntime();
  }

  $('packKWh').addEventListener('input', (e) => { state.packKWh = +e.target.value; renderPack(); renderRuntime(); });
  $('whKm').addEventListener('input', (e) => { state.whPerKm = +e.target.value; renderPack(); });
  window.addEventListener('scroll', hideTip, { passive: true });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderAll, 120); });

  return {
    setActive(id) { state.active = id; renderAll(); },
  };
}
