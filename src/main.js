// Entry point: wires input (scroll, drag, type switcher) → timeline (pure) → model + overlay (views).
import { createStage } from './core/scene.js';
import { MODELS } from './models/index.js';
import { CELLS, CELL_ORDER } from './data/cells.js';
import { computeState, sectionsFor } from './core/timeline.js';
import { createOverlay } from './ui/overlay.js';
import { renderStory } from './ui/story.js';
import { createAnalytics } from './ui/analytics.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('stage');
const storyEl = document.getElementById('story');
const typePick = document.getElementById('typePick');
const meter = document.getElementById('meter');
const meterLabel = document.getElementById('meterLabel');

// The 3D stage is optional: without WebGL the story and analytics still work.
let stage = null;
try { stage = createStage(canvas); } catch { document.documentElement.classList.add('no-webgl'); }
// If the GPU drops the context (driver reset, tab in background on mobile), show the text-only fallback
// instead of a frozen canvas; three.js rebuilds GPU resources when the context comes back.
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.documentElement.classList.add('no-webgl'); });
canvas.addEventListener('webglcontextrestored', () => document.documentElement.classList.remove('no-webgl'));
const overlay = stage && createOverlay({ camera: stage.camera, layout: stage.layout, canvas });
const analytics = createAnalytics({ onSelect: (id) => setType(id) });

let cell = null, model = null, steps = [];
let tSmooth = 0, spin = 0, last = performance.now();

// ---------- type switcher ----------
typePick.innerHTML = CELL_ORDER.map((id) => `<button type="button" class="seg-btn" data-type="${id}"><i style="background:${CELLS[id].color}"></i>${CELLS[id].tab}</button>`).join('');
typePick.addEventListener('click', (e) => { const b = e.target.closest('button[data-type]'); if (b) setType(b.dataset.type); });

function setType(id) {
  if (cell && cell.id === id) return;
  // Keep the reader where they were: same spot in analytics, otherwise the start of the teardown.
  const before = cell ? scrollT() : 0;
  const an = document.querySelector('[data-step="analytics"]');
  const anTop = an.getBoundingClientRect().top;
  const inAnalytics = cell && before > steps.length - 1.6;

  cell = CELLS[id];
  renderStory(storyEl, cell);
  steps = sectionsFor(cell).map((sid) => document.querySelector(`[data-step="${sid}"]`));

  if (stage) {
    if (model) { stage.scene.remove(model.root); model.dispose(); }
    model = MODELS[cell.model]();
    stage.scene.add(model.root);
    stage.turntable.scale.setScalar(cell.model === 'cylindrical' ? 1 : 1.25);
    overlay.bind(model, cell);
  }
  typePick.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === id)));
  analytics.setActive(id);
  document.documentElement.style.setProperty('--active', cell.color);

  if (inAnalytics) window.scrollBy({ top: an.getBoundingClientRect().top - anTop, behavior: 'instant' });
  else if (before >= 2) steps[2].scrollIntoView({ behavior: 'instant', block: 'start' });
  tSmooth = scrollT();
  try { localStorage.setItem('cell-type', id); } catch {}
}

// ---------- scroll → continuous section index ----------
// Reference line: middle of the viewport on desktop, middle of the text half on phones.
function refLine() {
  if (stage && stage.layout.narrow) { const b = canvas.getBoundingClientRect().bottom; return b + (window.innerHeight - b) * 0.45; }
  return window.innerHeight * 0.5;
}
function scrollT() {
  const mid = refLine();
  for (let i = 0; i < steps.length; i++) {
    const r = steps[i].getBoundingClientRect();
    if (mid >= r.top && mid < r.bottom) return i + (mid - r.top) / r.height;
  }
  return steps[0].getBoundingClientRect().top > mid ? 0 : steps.length - 0.001;
}

// ---------- drag to turn the model ----------
let yaw = 0, dragX = null;
canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging'); });
canvas.addEventListener('pointermove', (e) => { if (dragX === null) return; yaw += (e.clientX - dragX) * 0.01; dragX = e.clientX; });
const endDrag = () => { dragX = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------- start ----------
let saved = null;
try { saved = localStorage.getItem('cell-type'); } catch {}
setType(CELLS[saved] ? saved : 'cyl4680');

tSmooth = scrollT();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;

  // Ease toward the scroll target so wheel jumps become motion instead of teleports.
  const target = scrollT();
  tSmooth = reduceMotion ? target : tSmooth + (target - tSmooth) * Math.min(1, dt * 5);
  const state = computeState(tSmooth, cell, model.frame);

  // Idle spin, blended to a fixed viewing angle during the teardown, plus the user's drag.
  if (!reduceMotion) spin += dt * 0.35 * (1 - state.settle);
  const wrapped = model.settleAngle + wrapAngle(spin - model.settleAngle);
  state.rotY = wrapped + (model.settleAngle - wrapped) * state.settle + yaw;

  model.update(state, time, stage.layout);
  stage.turntable.position.y = model.floorY(state);
  stage.camera.position.set(0, state.camY, fitDistance(state.frame));
  stage.camera.lookAt(0, 0, 0);

  document.body.classList.toggle('in-analytics', state.analytics > 0.5);
  if (state.analytics > 0.5) overlay.hide(); else overlay.update(state);
  meter.style.setProperty('--p', state.progress.toFixed(3));
  meterLabel.textContent = labelFor(state);

  if (state.analytics < 0.999) stage.renderer.render(stage.scene, stage.camera);
}

// Distance at which a box of half-size (hh, hw) fills the free part of the canvas:
// right ~62% on desktop (text on the left), nearly all of the top split on phones.
function fitDistance(f) {
  const cam = stage.camera, tanV = Math.tan((cam.fov * Math.PI) / 360);
  const [fracW, fracH, hw] = stage.layout.narrow ? [0.9, 0.84, f.hwNarrow] : [0.62, 0.86, f.hwWide];
  return Math.max(f.hh / (tanV * fracH), hw / (tanV * cam.aspect * fracW));
}

function labelFor(s) {
  if (s.analytics > 0.5) return 'Analytics';
  if (s.power > 0.5) return 'Discharging';
  if (s.partIndex < 0) return 'Assembled';
  const n = cell.parts.length;
  return `Part ${String(s.partIndex + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
}

function wrapAngle(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  return (a < 0 ? a + Math.PI * 2 : a) - Math.PI;
}

if (stage) stage.renderer.setAnimationLoop(frame);
