// Pouch NMC cell, 60 Ah class, lying flat. Scale: 1 unit ≈ 46 mm → 7.2 long, 2.2 wide.
// Thickness is exaggerated (~2×) so the stacked layers are readable.
import * as THREE from 'three';
import { createRegistry, makePart, anchorOn, buildIons, buildCircuit, disposeTree } from './common.js';

const L = 7.2, WD = 2.2, CUP = 0.27;        // body length, width, half-thickness of the formed cavity
const FL = 7.7, FW = 2.7;                   // sealed flange outline
const N = 17, BASE_GAP = 0.03, OPEN_GAP = 0.15;

export function build() {
  const root = new THREE.Group();
  const parts = {};
  const { reg, apply } = createRegistry();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

  const laminateTop = reg(std({ color: '#b8bcc0', metalness: 0.7, roughness: 0.5, transparent: true }), 'film');
  const laminateBot = reg(std({ color: '#a9adb1', metalness: 0.7, roughness: 0.55, transparent: true }), 'tray');
  const tabAlu = reg(std({ color: '#e3e6e8', metalness: 1, roughness: 0.22 }), 'tabs');
  const tabNi = reg(std({ color: '#b98062', metalness: 1, roughness: 0.3 }), 'tabs');
  const sealant = reg(std({ color: '#2b2418', metalness: 0, roughness: 0.6 }), 'tabs');
  const cathodeCoat = reg(std({ color: '#3a4046', metalness: 0.3, roughness: 0.72 }), 'stack', 'cathode');
  const cathodeFoil = reg(std({ color: '#e1e4e6', metalness: 1, roughness: 0.25 }), 'stack', 'cathode', 'tabs');
  const sepFilm = reg(std({ color: '#ece8df', metalness: 0, roughness: 0.85 }), 'stack', 'separator');
  const anodeCoat = reg(std({ color: '#1d1f22', metalness: 0.1, roughness: 0.9 }), 'stack', 'anode');
  const anodeFoil = reg(std({ color: '#cf7c4c', metalness: 1, roughness: 0.28 }), 'stack', 'anode', 'tabs');

  // Half of the pouch: a shallow formed cup plus its flat sealed flange. sign = +1 top, −1 bottom.
  function pouchHalf(mat, sign) {
    const g = new THREE.Group();
    const t = 0.02;
    g.add(box(L, t, WD, mat, 0, sign * CUP));
    g.add(box(L, CUP, t, mat, 0, sign * CUP / 2, WD / 2), box(L, CUP, t, mat, 0, sign * CUP / 2, -WD / 2));
    g.add(box(t, CUP, WD, mat, L / 2, sign * CUP / 2), box(t, CUP, WD, mat, -L / 2, sign * CUP / 2));
    const shape = new THREE.Shape();
    shape.moveTo(-FL / 2, -FW / 2); shape.lineTo(FL / 2, -FW / 2); shape.lineTo(FL / 2, FW / 2); shape.lineTo(-FL / 2, FW / 2); shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-L / 2, -WD / 2); hole.lineTo(-L / 2, WD / 2); hole.lineTo(L / 2, WD / 2); hole.lineTo(L / 2, -WD / 2); hole.closePath();
    shape.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false });
    fg.rotateX(-Math.PI / 2);
    const flange = new THREE.Mesh(fg, mat);
    flange.position.y = sign > 0 ? 0.0 : -0.017;
    g.add(flange);
    return g;
  }

  // 01 · top film
  const film = pouchHalf(laminateTop, 1);
  makePart(parts, root, 'film', film, new THREE.Vector3(1.6, CUP + 0.01, WD / 2));
  // 08 · bottom tray
  const tray = pouchHalf(laminateBot, -1);
  makePart(parts, root, 'tray', tray, new THREE.Vector3(1.6, -CUP, WD / 2));

  // 02 · tabs with sealant bands, sticking out of the +X edge
  const tabs = new THREE.Group();
  {
    for (const [z, mat] of [[0.55, tabAlu], [-0.55, tabNi]]) {
      tabs.add(box(1.3, 0.02, 0.6, mat, L / 2 + 0.55, 0, z));
      tabs.add(box(0.28, 0.07, 0.74, sealant, L / 2 + 0.5, 0, z));
    }
    makePart(parts, root, 'tabs', tabs, new THREE.Vector3(L / 2 + 1.15, 0.02, 0.55 + 0.3));
  }

  // 03–06 · the stack: sheets with small foil tabs (cathode tabs one side, anode tabs the other)
  const stack = new THREE.Group();
  const sheets = [];
  {
    const order = ['separator', 'cathode', 'separator', 'anode'];
    for (let i = 0; i < N; i++) {
      const type = order[i % 4];
      const g = new THREE.Group();
      if (type === 'separator') g.add(box(6.9, 0.012, 2.08, sepFilm));
      if (type === 'cathode') g.add(box(6.5, 0.02, 1.88, cathodeCoat), box(0.5, 0.012, 0.5, cathodeFoil, 3.45, 0, 0.55));
      if (type === 'anode') g.add(box(6.65, 0.02, 1.98, anodeCoat), box(0.45, 0.012, 0.5, anodeFoil, 3.5, 0, -0.55));
      stack.add(g);
      sheets.push({ group: g, type, i });
    }
    makePart(parts, root, 'stack', stack, new THREE.Vector3(-3.3, 0, 1.0));
    for (const type of ['cathode', 'separator', 'anode']) {
      const s = sheets.filter((x) => x.type === type)[type === 'separator' ? 2 : 1];
      anchorOn(parts, type, s.group, new THREE.Vector3(-1.4, 0.01, type === 'separator' ? 1.04 : 0.95));
    }
  }
  // 07 · electrolyte
  const ions = buildIons({
    mode: 'drift', count: 650, size: 0.11,
    sample: () => new THREE.Vector3((Math.random() - 0.5) * 6.4, (Math.random() - 0.5) * N * OPEN_GAP, (Math.random() - 0.5) * 1.9),
  });
  stack.add(ions.points);
  anchorOn(parts, 'electrolyte', stack, new THREE.Vector3(-0.6, 0.3, 0.8));

  // Circuit: negative tab → motor → positive tab, looping out past the tab edge
  const tx = L / 2 + 1.2;
  const circuit = buildCircuit([[tx, 0, -0.55], [tx + 0.8, 0.15, -1.1], [tx + 1.4, 0.3, 0], [tx + 0.8, 0.15, 1.1], [tx, 0, 0.55]]);
  root.add(circuit.group);

  function update(state, time) {
    const e = state.enter;
    root.rotation.set(0.5 + 0.08 * state.exploded, state.rotY, 0);
    root.position.x = -1.2 * state.power;
    film.position.y = 2.1 * e.tabs;
    tabs.position.x = 1.2 * e.tabs;
    tray.position.y = -2.0 * e.tray;
    const gap = BASE_GAP + (OPEN_GAP - BASE_GAP) * e.stack;
    for (const s of sheets) {
      s.group.position.y = (s.i - (N - 1) / 2) * gap;
      s.group.position.z = (state.pull[s.type] || 0) * 1.6;
    }
    ions.points.scale.y = gap / OPEN_GAP;

    apply(state.focus, time);
    laminateTop.opacity = laminateBot.opacity = 1 - 0.85 * state.power;
    laminateTop.depthWrite = laminateBot.depthWrite = laminateTop.opacity > 0.98;
    ions.update(time, Math.max(state.ions, state.power), state.power);
    circuit.update(time, state.power);
  }

  return {
    root, parts, update,
    settleAngle: -0.3,
    frame: { hero: { hh: 2.6, hw: 5.9 }, exploded: { hh: 3.5, hwWide: 5.5, hwNarrow: 5.0 }, power: { hh: 2.8, hw: 6.4 } },
    floorY: (s) => -1.8 - 1.6 * s.enter.tray,
    dims: [
      { a: [-L / 2, 1.3, 0], b: [L / 2, 1.3, 0], label: '330 mm' },
      { a: [-L / 2 - 0.6, 0, -WD / 2], b: [-L / 2 - 0.6, 0, WD / 2], label: '100 mm' },
    ],
    dispose() { disposeTree(root); },
  };
}
