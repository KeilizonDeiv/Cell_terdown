// Prismatic (box) LFP cell, 280 Ah class. Scale: 1 unit ≈ 26 mm → 6.7 wide, 8 tall, 2.8 deep.
import * as THREE from 'three';
import { createRegistry, makePart, anchorOn, brushedRoughness, buildIons, buildCircuit, disposeTree } from './common.js';

const W = 6.72, H = 8, D = 2.78, T = 0.06;           // case outer size and wall thickness
const HW = W / 2, HD = D / 2;

export function build() {
  const root = new THREE.Group();
  const parts = {};
  const { reg, apply } = createRegistry();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const ds = THREE.DoubleSide;

  const caseAlu = reg(std({ color: '#c9ced2', metalness: 1, roughness: 0.8, roughnessMap: brushedRoughness(true), transparent: true }), 'case');
  const caseFilm = reg(std({ color: '#2d5f9c', metalness: 0.1, roughness: 0.4, transparent: true }), 'case');
  const lidAlu = reg(std({ color: '#d5d9dc', metalness: 1, roughness: 0.3 }), 'lid');
  const lidDark = reg(std({ color: '#1c1f22', metalness: 0.2, roughness: 0.6 }), 'lid');
  const posAlu = reg(std({ color: '#e3e6e8', metalness: 1, roughness: 0.22 }), 'terminals');
  const negCu = reg(std({ color: '#cc7848', metalness: 1, roughness: 0.25 }), 'terminals');
  const insul = reg(std({ color: '#2a2d30', metalness: 0, roughness: 0.7 }), 'terminals');
  const wrapFilm = reg(std({ color: '#dfe6ea', metalness: 0, roughness: 0.3, transparent: true, opacity: 0.5, side: ds, depthWrite: false }), 'wrap');
  const cathodeCoat = reg(std({ color: '#3b3f44', metalness: 0.3, roughness: 0.75, side: ds }), 'core', 'cathode');
  const sepFilm = reg(std({ color: '#ece8df', metalness: 0, roughness: 0.85, side: ds }), 'core', 'separator');
  const anodeCoat = reg(std({ color: '#1d1f22', metalness: 0.1, roughness: 0.9, side: ds }), 'core', 'anode');

  // 01 · case: open-top aluminum box with a blue insulating film around the walls
  {
    const g = new THREE.Group();
    const wallH = 7.85, wy = -H / 2 + wallH / 2;
    g.add(box(W, T, D, caseAlu, 0, -H / 2 + T / 2));
    g.add(box(W, wallH, T, caseAlu, 0, wy, HD - T / 2), box(W, wallH, T, caseAlu, 0, wy, -HD + T / 2));
    g.add(box(T, wallH, D - 2 * T, caseAlu, HW - T / 2, wy), box(T, wallH, D - 2 * T, caseAlu, -HW + T / 2, wy));
    const fh = 7.0, fy = -0.35;
    g.add(box(W + 0.02, fh, 0.01, caseFilm, 0, fy, HD + 0.006), box(W + 0.02, fh, 0.01, caseFilm, 0, fy, -HD - 0.006));
    g.add(box(0.01, fh, D + 0.02, caseFilm, HW + 0.006, fy), box(0.01, fh, D + 0.02, caseFilm, -HW - 0.006, fy));
    makePart(parts, root, 'case', g, new THREE.Vector3(HW * 0.7, 1.4, HD + 0.02));
  }
  // 02 · lid: plate, burst vent, sealed fill port
  const lidG = new THREE.Group();
  {
    lidG.add(box(W - 0.02, 0.12, D - 0.02, lidAlu, 0, 3.91));
    const vent = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 48), lidDark);
    vent.rotation.x = Math.PI / 2; vent.scale.set(1.5, 1, 1); vent.position.set(0, 3.98, 0);
    const ventDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 48), lidAlu);
    ventDisc.scale.set(1.5, 1, 1); ventDisc.position.set(0, 3.975, 0);
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 24), lidDark); port.position.set(-1.1, 4.0, 0.5);
    lidG.add(vent, ventDisc, port);
    makePart(parts, root, 'lid', lidG, new THREE.Vector3(0.9, 3.98, HD - 0.1));
  }
  // 03 · terminals and the tab bundles that join them to the rolls
  const termG = new THREE.Group();
  {
    for (const [x, mat] of [[2.2, posAlu], [-2.2, negCu]]) {
      termG.add(box(1.25, 0.08, 1.25, insul, x, 4.01));          // plastic insulator pad
      termG.add(box(0.95, 0.3, 0.95, mat, x, 4.2));              // post
      termG.add(box(1.3, 0.06, 1.9, mat, x, 3.74));              // connector under the lid
      for (const z of [0.66, -0.66]) termG.add(box(0.8, 0.3, 0.1, mat, x, 3.55, z)); // foil tab bundles
    }
    makePart(parts, root, 'terminals', termG, new THREE.Vector3(2.2 + 0.48, 4.25, 0.48));
  }
  // 04 · insulation wrap
  const wrapG = new THREE.Group();
  {
    const w = W - 0.18, d = D - 0.16, h = 7.3, y = -0.25;
    wrapG.add(box(w, h, 0.01, wrapFilm, 0, y, d / 2), box(w, h, 0.01, wrapFilm, 0, y, -d / 2));
    wrapG.add(box(0.01, h, d, wrapFilm, w / 2, y), box(0.01, h, d, wrapFilm, -w / 2, y), box(w, 0.01, d, wrapFilm, 0, y - h / 2));
    makePart(parts, root, 'wrap', wrapG, new THREE.Vector3(-1.4, -1.5, d / 2));
  }
  // 05–08 · two flat-wound rolls, front one cut away at the front-right so the layers show
  const shells = [];
  const core = new THREE.Group();
  {
    const order = ['cathode', 'separator', 'anode', 'separator'];
    const mats = { cathode: cathodeCoat, separator: sepFilm, anode: anodeCoat };
    const n = 12, a = 2.55;
    for (const [zc, cut] of [[0.66, true], [-0.66, false]]) {
      for (let i = 0; i < n; i++) {
        const d = 0.08 + (0.54 * i) / (n - 1);
        const type = order[i % 4];
        const h = type === 'separator' ? 6.9 : 6.7;
        const sg = new THREE.Group();
        const m = new THREE.Mesh(stadiumWall(a, d, -h / 2 - 0.3, h / 2 - 0.3, cut), mats[type]);
        m.position.z = zc;
        sg.add(m);
        core.add(sg);
        shells.push({ group: sg, type, i, d, zc, cut });
      }
    }
    makePart(parts, root, 'core', core, new THREE.Vector3(a + 0.6, 1.0, 0.66));
    for (const type of ['cathode', 'separator', 'anode']) {
      const s = shells.filter((x) => x.cut && x.type === type).at(-1);
      anchorOn(parts, type, s.group, new THREE.Vector3(0.2, type === 'anode' ? -1.3 : 1.2, s.zc + s.d));
    }
  }
  // 09 · electrolyte
  const ions = buildIons({
    mode: 'drift', count: 800,
    sample: () => new THREE.Vector3((Math.random() - 0.5) * 6.0, (Math.random() - 0.5) * 6.4 - 0.3, (Math.random() - 0.5) * 2.3),
  });
  core.add(ions.points);
  anchorOn(parts, 'electrolyte', core, new THREE.Vector3(0.9, -0.8, 0.9));

  // Circuit: negative post → motor above the cell → positive post
  const circuit = buildCircuit([[-2.2, 4.35], [-2.3, 5.3], [-1.4, 6.1], [0, 6.35], [1.4, 6.1], [2.3, 5.3], [2.2, 4.35]]);
  root.add(circuit.group);

  function update(state, time) {
    const e = state.enter;
    root.rotation.set(0.14 + 0.08 * state.exploded, state.rotY, 0);
    root.position.y = -1.2 * state.exploded - 1.0 * state.power;
    // Case slides down and away; lid + terminals lift; terminals lift further on their own step.
    parts.case.group.position.set(0, -16 * e.lid, -8 * e.lid);
    parts.case.group.rotation.x = 0.2 * e.lid;
    parts.case.group.visible = e.lid < 0.97;   // fully removed: hide it rather than park it in view
    lidG.position.y = 1.8 * e.lid;
    termG.position.y = 1.8 * e.lid + 1.0 * e.terminals;
    wrapG.position.y = -2.5 * e.wrap;
    wrapFilm.opacity = 0.5 * (1 - e.wrap);
    wrapG.visible = wrapFilm.opacity > 0.01;
    for (const s of shells) s.group.position.y = (state.pull[s.type] || 0) * (1.2 + (s.i / 12) * 0.7);

    apply(state.focus, time);
    caseAlu.opacity = caseFilm.opacity = 1 - 0.82 * state.power;
    caseAlu.depthWrite = caseFilm.depthWrite = caseAlu.opacity > 0.98;
    ions.update(time, Math.max(state.ions, state.power), state.power);
    circuit.update(time, state.power);
  }

  return {
    root, parts, update,
    settleAngle: -0.4,
    frame: { hero: { hh: 5.8, hw: 4.9 }, exploded: { hh: 7.8, hwWide: 4.7, hwNarrow: 4.2 }, power: { hh: 6.2, hw: 4.5 } },
    floorY: (s) => -4.4 - 1.2 * s.exploded - 1.0 * s.power,
    dims: [
      { a: [HW + 0.7, 4, 0], b: [HW + 0.7, -4, 0], label: '207 mm' },
      { a: [-HW, 4.9, 0], b: [HW, 4.9, 0], label: '174 mm' },
    ],
    dispose() { disposeTree(root); },
  };
}

// Vertical wall following a stadium (flattened oval): straight half-length `a`, end radius `d`.
// With `cut`, the front-right quarter is left open so the inner layers are visible.
function stadiumWall(a, d, y0, y1, cut) {
  const pts = [];
  const seg = 24;
  for (let i = 0; i <= 20; i++) pts.push([-a + (2 * a * i) / 20, d]);                                 // front straight
  for (let i = 1; i <= seg; i++) { const t = Math.PI / 2 - (Math.PI * i) / seg; pts.push([a + Math.cos(t) * d, Math.sin(t) * d]); } // right end
  for (let i = 1; i <= 20; i++) pts.push([a - (2 * a * i) / 20, -d]);                                 // back straight
  for (let i = 1; i <= seg; i++) { const t = -Math.PI / 2 - (Math.PI * i) / seg; pts.push([-a + Math.cos(t) * d, Math.sin(t) * d]); } // left end
  const skip = ([x, z]) => cut && z > -0.02 && x > 0.2;
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    if (skip(p) || skip(q)) continue;
    pos.push(p[0], y0, p[1], q[0], y0, q[1], q[0], y1, q[1], p[0], y0, p[1], q[0], y1, q[1], p[0], y1, p[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
