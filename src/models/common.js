// Shared building blocks for every cell model: highlight registry, textures,
// lithium-ion particles, the external circuit, and cleanup.
import * as THREE from 'three';

const GLOW = new THREE.Color('#ff9a5c');

// Tracks which part(s) each material belongs to, so focus can glow one part and dim the rest.
export function createRegistry() {
  const map = new Map();
  const tmp = new THREE.Color();
  return {
    reg(mat, ...ids) {
      if (!map.has(mat)) map.set(mat, { base: mat.color.clone(), parts: new Set() });
      ids.forEach((id) => map.get(mat).parts.add(id));
      return mat;
    },
    apply(focus, time) {
      let any = 0;
      for (const k in focus) any = Math.max(any, focus[k]);
      const pulse = 0.75 + 0.25 * Math.sin(time * 3);
      for (const [mat, info] of map) {
        let h = 0;
        for (const id of info.parts) h = Math.max(h, focus[id] || 0);
        const dim = any * (1 - h) * 0.72;
        mat.color.copy(info.base).multiplyScalar(1 - dim);
        mat.envMapIntensity = 1 - dim * 0.9;
        mat.emissive.copy(tmp.copy(GLOW)).multiplyScalar(h * 0.16 * pulse);
      }
    },
  };
}

// A part is a Group plus an anchor point the hotspot marker sticks to.
export function makePart(parts, root, id, group, anchorPos, parent = root) {
  const anchor = new THREE.Object3D();
  anchor.position.copy(anchorPos);
  group.add(anchor);
  parts[id] = { group, anchor };
  if (group.parent !== parent) parent.add(group);
  return group;
}

export function anchorOn(parts, id, group, pos) {
  const anchor = new THREE.Object3D();
  anchor.position.copy(pos);
  group.add(anchor);
  parts[id] = { group, anchor };
}

// Canvas-generated streaks = brushed metal without shipping an image file.
export function brushedRoughness(horizontal = false) {
  const c = document.createElement('canvas');
  c.width = horizontal ? 512 : 16; c.height = horizontal ? 16 : 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 512; i++) {
    const v = 90 + Math.random() * 60;
    g.fillStyle = `rgb(${v},${v},${v})`;
    if (horizontal) g.fillRect(i, 0, 1, 16); else g.fillRect(0, i, 16, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function glowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Lithium-ion particles. `sample()` returns a random resting point inside the cell's
// electrolyte volume; `mode` picks the motion: 'swirl' (round cells) or 'drift' (flat cells).
export function buildIons({ count = 700, sample, mode = 'swirl', size = 0.13 }) {
  const pos = new Float32Array(count * 3);
  const seed = Array.from({ length: count }, () => ({ p: sample(), s: 0.2 + Math.random() * 0.6, ph: Math.random() * Math.PI * 2 }));
  for (const s of seed) { s.a = Math.atan2(s.p.x, s.p.z); s.r = Math.hypot(s.p.x, s.p.z); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#86d4e2', size, map: glowSprite(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  let last = 0;
  return {
    points,
    update(time, strength, flow) {
      mat.opacity = strength;
      points.visible = strength > 0.01;
      const dt = Math.min(0.05, Math.max(0, time - last)); last = time;
      if (!points.visible) return;
      for (let i = 0; i < count; i++) {
        const q = seed[i];
        if (mode === 'swirl') {
          q.a += dt * q.s * (0.25 + flow * 1.2);
          const r = q.r + Math.sin(time * 1.7 + q.ph) * 0.09;
          pos[i * 3] = Math.sin(q.a) * r;
          pos[i * 3 + 1] = q.p.y + Math.sin(time * 0.8 + q.ph) * 0.06;
          pos[i * 3 + 2] = Math.cos(q.a) * r;
        } else {
          pos[i * 3] = q.p.x + Math.sin(time * q.s * (1 + flow * 2) + q.ph) * 0.18;
          pos[i * 3 + 1] = q.p.y + Math.sin(time * 1.9 + q.ph) * 0.05;
          pos[i * 3 + 2] = q.p.z + Math.cos(time * q.s * 1.3 + q.ph) * 0.08;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// Wire from the negative terminal through a "load" (motor coil) back to the positive one,
// with electrons riding it. `points` are [x, y, z] in the model's un-rotated frame.
export function buildCircuit(points) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)));
  const wireMat = new THREE.MeshBasicMaterial({ color: '#d9895a', transparent: true, opacity: 0 });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.03, 8), wireMat));
  const loadMat = new THREE.MeshBasicMaterial({ color: '#e9e5dd', transparent: true, opacity: 0 });
  const load = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 12, 48), loadMat);
  load.position.copy(curve.getPointAt(0.5));
  load.rotation.y = Math.PI / 2;
  group.add(load);
  const COUNT = 26;
  const eMat = new THREE.MeshBasicMaterial({ color: '#ffd8b8', transparent: true, opacity: 0 });
  const electrons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 12), eMat, COUNT);
  group.add(electrons);
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  group.visible = false;
  return {
    group,
    update(time, p) {
      group.visible = p > 0.01;
      if (!group.visible) return;
      wireMat.opacity = p * 0.85; loadMat.opacity = p * 0.9; eMat.opacity = p;
      load.rotation.x = time * 1.5;
      for (let i = 0; i < COUNT; i++) {
        curve.getPointAt((i / COUNT + time * 0.08) % 1, v);
        electrons.setMatrixAt(i, m.makeTranslation(v.x, v.y, v.z));
      }
      electrons.instanceMatrix.needsUpdate = true;
    },
  };
}

// Free GPU memory when switching models (geometries, materials, textures).
export function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of ['map', 'roughnessMap']) m[k]?.dispose();
      m.dispose();
    }
  });
}

export const smoothTo = (cur, target, k) => cur + (target - cur) * k;
