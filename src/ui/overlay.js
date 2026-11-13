// DOM/SVG overlay: hotspot marker on the focused part, leader line to its card,
// and dimension lines during the spec section. Reads 3D positions, never writes to the scene.
import * as THREE from 'three';

const v = new THREE.Vector3();
const SVGNS = 'http://www.w3.org/2000/svg';

export function createOverlay({ camera, layout, canvas }) {
  const hotspot = document.getElementById('hotspot'), tag = hotspot.querySelector('.tag');
  const leader = document.getElementById('leader'), dimsG = document.getElementById('dims');
  let model = null, cards = {}, dimEls = [];

  // Called whenever the cell type changes (new model + freshly rendered cards).
  function bind(newModel, cell) {
    model = newModel;
    cards = {};
    cell.parts.forEach((p, i) => {
      cards[p.id] = { el: document.querySelector(`.step[data-step="${p.id}"] .card`), label: `${String(i + 1).padStart(2, '0')} ${p.short || p.name}` };
    });
    dimsG.replaceChildren();
    dimEls = model.dims.map((d) => {
      const g = document.createElementNS(SVGNS, 'g');
      const lines = [0, 1, 2].map(() => g.appendChild(document.createElementNS(SVGNS, 'line')));
      const text = g.appendChild(document.createElementNS(SVGNS, 'text'));
      text.textContent = d.label;
      dimsG.appendChild(g);
      return { d, lines, text };
    });
  }

  // Model-space point → CSS pixels relative to the page (canvas may not start at 0,0).
  function project(world) {
    v.copy(world).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x * 0.5 + 0.5) * layout.width, y: r.top + (-v.y * 0.5 + 0.5) * layout.height };
  }
  const setLine = (el, a, b) => { el.setAttribute('x1', a.x); el.setAttribute('y1', a.y); el.setAttribute('x2', b.x); el.setAttribute('y2', b.y); };

  function update(state) {
    if (!model) return;
    // ---- hotspot on the most-focused part ----
    let best = null, w = 0;
    for (const id in state.focus) if (state.focus[id] > w) { w = state.focus[id]; best = id; }
    if (best && w > 0.02 && cards[best]) {
      model.parts[best].anchor.getWorldPosition(v);
      const p = project(v);
      hotspot.style.opacity = w;
      hotspot.style.transform = `translate(${p.x}px, ${p.y}px)`;
      tag.textContent = cards[best].label;
      if (!layout.narrow && cards[best].el) {
        const r = cards[best].el.getBoundingClientRect();
        setLine(leader, { x: r.right, y: r.top + 34 }, { x: p.x - 10, y: p.y });
        leader.setAttribute('opacity', w * 0.8);
      } else leader.setAttribute('opacity', 0);
    } else {
      hotspot.style.opacity = 0;
      leader.setAttribute('opacity', 0);
    }

    // ---- dimension lines (spec section), in the model's un-rotated frame ----
    dimsG.setAttribute('opacity', state.specs);
    if (state.specs > 0.01) {
      const o = model.root.position;
      for (const { d, lines, text } of dimEls) {
        const a = project(v.set(d.a[0] + o.x, d.a[1] + o.y, d.a[2] + o.z));
        const b = project(v.set(d.b[0] + o.x, d.b[1] + o.y, d.b[2] + o.z));
        setLine(lines[0], a, b);
        // End ticks perpendicular to the line on screen.
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * 6, ny = (dx / len) * 6;
        setLine(lines[1], { x: a.x - nx, y: a.y - ny }, { x: a.x + nx, y: a.y + ny });
        setLine(lines[2], { x: b.x - nx, y: b.y - ny }, { x: b.x + nx, y: b.y + ny });
        const vertical = Math.abs(dy) > Math.abs(dx);
        text.setAttribute('x', vertical ? (a.x + b.x) / 2 + 10 : (a.x + b.x) / 2 - 26);
        text.setAttribute('y', vertical ? (a.y + b.y) / 2 : (a.y + b.y) / 2 - 10);
      }
    }
  }

  function hide() { hotspot.style.opacity = 0; leader.setAttribute('opacity', 0); dimsG.setAttribute('opacity', 0); }

  return { bind, update, hide };
}
