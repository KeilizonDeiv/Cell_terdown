// 4680 cylindrical cell. Scale: 1 unit = 10 mm, so the can is 4.6 wide and 8 tall.
import * as THREE from 'three';
import { createRegistry, makePart, anchorOn, brushedRoughness, buildIons, buildCircuit, disposeTree } from './common.js';

const R = 2.3, HALF = 4;
const CUT_START = Math.PI / 4;              // cut-away wedge faces +Z (the camera)
const CUT_LEN = Math.PI * 2 - Math.PI / 2;  // 270° of each layer is drawn

export function build() {
  const root = new THREE.Group();
  const parts = {};
  const { reg, apply } = createRegistry();
  const front = (r, y, a = 0.55) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  const std = (o) => new THREE.MeshStandardMaterial(o);

  const steel = reg(std({ color: '#c3c8cc', metalness: 1, roughness: 0.9, roughnessMap: brushedRoughness(), transparent: true, side: THREE.DoubleSide }), 'can');
  const lidSteel = reg(std({ color: '#a9afb4', metalness: 1, roughness: 0.35 }), 'cap');
  const alu = reg(std({ color: '#dfe2e4', metalness: 1, roughness: 0.25 }), 'cap');
  const gasket = reg(std({ color: '#1a1c1e', metalness: 0, roughness: 0.6 }), 'cap');
  const plateAlu = reg(std({ color: '#d7dadc', metalness: 1, roughness: 0.3 }), 'top');
  const plateCu = reg(std({ color: '#c9774a', metalness: 1, roughness: 0.3 }), 'bottom');
  const ds = THREE.DoubleSide;
  const cathodeCoat = reg(std({ color: '#3a4046', metalness: 0.35, roughness: 0.7, side: ds }), 'roll', 'cathode');
  const cathodeFoil = reg(std({ color: '#e1e4e6', metalness: 1, roughness: 0.25, side: ds }), 'roll', 'cathode', 'top');
  const sepFilm = reg(std({ color: '#ece8df', metalness: 0, roughness: 0.85, side: ds }), 'roll', 'separator');
  const anodeCoat = reg(std({ color: '#1d1f22', metalness: 0.1, roughness: 0.9, side: ds }), 'roll', 'anode');
  const anodeFoil = reg(std({ color: '#cf7c4c', metalness: 1, roughness: 0.28, side: ds }), 'roll', 'anode', 'bottom');
  const coreMat = reg(std({ color: '#2a2f33', metalness: 0.6, roughness: 0.5, side: ds }), 'roll');

  // 01 · steel can: lathe profile = outer wall, rolled lip, inner wall, floor
  {
    const p = [[0, -HALF], [2.2, -HALF], [2.27, -3.97], [R, -3.9], [R, 3.72], [2.26, 3.82], [2.2, 3.87], [2.25, 3.93], [2.22, 4.0], [2.13, 4.02],
      [2.1, 3.97], [2.22, 3.86], [2.22, -3.92], [0, -3.92]].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.LatheGeometry(p, 128), steel));
    makePart(parts, root, 'can', g, front(R, 1.2));
  }
  // 02 · cap: lid, vent score, gasket, positive terminal
  {
    const g = new THREE.Group();
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.12, 0.1, 96), lidSteel); lid.position.y = 3.9;
    const vent = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.022, 8, 96), gasket); vent.rotation.x = Math.PI / 2; vent.position.y = 3.955;
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.02, 0.08, 64), gasket); seal.position.y = 3.99;
    const term = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.74, 0.18, 64), alu); term.position.y = 4.1;
    const rivet = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 48), alu); rivet.rotation.x = Math.PI / 2; rivet.position.y = 4.2;
    g.add(lid, vent, seal, term, rivet);
    makePart(parts, root, 'cap', g, front(1.4, 4.0));
  }
  // 03 / 09 · slotted collector plates
  const plateGeo = collectorPlateGeometry();
  {
    const g = new THREE.Group(); const m = new THREE.Mesh(plateGeo, plateAlu); m.position.y = 3.74; g.add(m);
    makePart(parts, root, 'top', g, front(1.8, 3.78));
  }
  {
    const g = new THREE.Group(); const m = new THREE.Mesh(plateGeo, plateCu); m.position.y = -3.8; g.add(m);
    makePart(parts, root, 'bottom', g, front(1.8, -3.76));
  }
  // 04–07 · jelly roll: concentric layers with a cut-away wedge.
  // Tabless detail: bare cathode foil (aluminum) sticks out the top, bare anode foil (copper) the bottom.
  const shells = [];
  const roll = new THREE.Group();
  {
    const order = ['cathode', 'separator', 'anode', 'separator'];
    const n = 16, rIn = 0.55, rOut = 2.12;
    const cyl = (r, h, y, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96, 1, true, CUT_START, CUT_LEN), mat); m.position.y = y; return m; };
    for (let i = 0; i < n; i++) {
      const r = rIn + ((rOut - rIn) * i) / (n - 1);
      const type = order[i % 4];
      const sg = new THREE.Group();
      if (type === 'separator') sg.add(cyl(r, 7.1, 0, sepFilm));
      if (type === 'cathode') sg.add(cyl(r, 6.85, -0.025, cathodeCoat), cyl(r, 0.32, 3.56, cathodeFoil));
      if (type === 'anode') sg.add(cyl(r, 6.85, 0.025, anodeCoat), cyl(r, 0.32, -3.56, anodeFoil));
      roll.add(sg);
      shells.push({ group: sg, type, i, r });
    }
    roll.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 7.2, 48, 1, true), coreMat));
    makePart(parts, root, 'roll', roll, front(2.12, 1.6, 0.9));
    for (const type of ['cathode', 'separator', 'anode']) {
      const s = shells.filter((x) => x.type === type).at(-1);
      anchorOn(parts, type, s.group, front(s.r, type === 'anode' ? -1.2 : 1.4, CUT_START));
    }
  }
  // 08 · electrolyte
  const ions = buildIons({
    sample: () => { const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.5; return new THREE.Vector3(Math.sin(a) * r, (Math.random() - 0.5) * 6.8, Math.cos(a) * r); },
  });
  roll.add(ions.points);
  anchorOn(parts, 'electrolyte', roll, new THREE.Vector3(0.3, -0.6, 1.3));

  // External circuit: can bottom (−) → motor → terminal (+)
  const circuit = buildCircuit([[0.9, -4.05], [2.2, -4.9], [3.5, -3.2], [3.9, 0], [3.5, 3.4], [2.0, 5.2], [0.4, 4.8], [0, 4.25]]);

  const canAway = new THREE.Vector3();
  function update(state, time, layout) {
    const e = state.enter;
    root.rotation.set(0.12 + 0.1 * state.exploded, state.rotY, 0);
    root.position.y = -0.4 * state.exploded;
    circuit.group.position.y = root.position.y;

    // Where the can goes when removed depends on screen shape.
    if (layout.narrow) canAway.set(0, -13, -4); else canAway.set(4.6, -0.8, -5.5);
    parts.can.group.position.copy(canAway).multiplyScalar(e.cap);
    parts.can.group.rotation.z = -0.25 * e.cap;
    parts.cap.group.position.y = e.cap * 3.0;
    parts.top.group.position.y = e.top * 1.7;
    parts.bottom.group.position.y = -e.bottom * 1.7;
    for (const s of shells) s.group.position.y = (state.pull[s.type] || 0) * (1.3 + (s.i / 16) * 0.8);

    apply(state.focus, time);
    steel.opacity = 1 - 0.8 * state.power;
    steel.depthWrite = steel.opacity > 0.98;
    ions.update(time, Math.max(state.ions, state.power), state.power);
    circuit.update(time, state.power);
  }

  return {
    root, circuit: circuit.group, parts, update,
    settleAngle: -0.45,
    frame: { hero: { hh: 4.9, hw: 2.9 }, exploded: { hh: 7.3, hwWide: 5.0, hwNarrow: 2.9 }, power: { hh: 5.9, hw: 4.4 } },
    floorY: (s) => -4.4 - 0.4 * s.exploded - 1.9 * s.enter.bottom,
    dims: [
      { a: [3.0, 4, 0], b: [3.0, -4, 0], label: '80 mm' },
      { a: [-2.3, 4.8, 0], b: [2.3, 4.8, 0], label: 'Ø 46 mm' },
    ],
    dispose() { disposeTree(root); disposeTree(circuit.group); },
  };
}

// Slotted disc: the slots let electrolyte flow through and let the plate weld to the foil edge.
function collectorPlateGeometry() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 2.05, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true); shape.holes.push(hole);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, w = 0.09, r0 = 0.65, r1 = 1.75;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
    const slot = new THREE.Path();
    slot.moveTo(ca * r0 + px * w, sa * r0 + py * w); slot.lineTo(ca * r1 + px * w, sa * r1 + py * w);
    slot.lineTo(ca * r1 - px * w, sa * r1 - py * w); slot.lineTo(ca * r0 - px * w, sa * r0 - py * w); slot.closePath();
    shape.holes.push(slot);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false, curveSegments: 64 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}
