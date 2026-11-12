// Stage: renderer, camera, lights and a procedural studio environment.
// Knows nothing about the battery — it only renders whatever is added to `scene`.
import * as THREE from 'three';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0c1114');
  // Image-based lighting gives metals (steel, aluminum, copper) believable reflections.
  scene.environment = buildStudioEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  camera.position.set(0, 1.5, 22);

  // Key / rim / fill. The environment does most of the work; these add shape.
  const key = new THREE.DirectionalLight('#fff1e2', 1.6);
  key.position.set(6, 10, 8);
  const rim = new THREE.DirectionalLight('#9fd0ff', 1.1);
  rim.position.set(-8, 4, -6);
  const fill = new THREE.HemisphereLight('#c9d4dc', '#0c1114', 0.35);
  scene.add(key, rim, fill);

  scene.add(buildTurntable());

  // Layout knowledge lives here: on wide screens the model sits right of the text column,
  // on phones it sits in the upper half above the bottom-sheet cards.
  const layout = { narrow: false, width: 1, height: 1 };
  function resize() {
    layout.narrow = window.innerWidth < 820;
    // The canvas's CSS box decides its size: full window on desktop, top split on phones.
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    layout.width = w; layout.height = h;
    // Desktop: shift the projection centre right of the text column without moving the camera.
    if (layout.narrow) camera.setViewOffset(w, h, 0, -h * 0.07, w, h);
    else camera.setViewOffset(w, h, -w * 0.19, 0, w, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(canvas);

  return { renderer, scene, camera, layout, resize, turntable: scene.getObjectByName('turntable') };
}

// A tiny "photo studio" rendered once into a PMREM cube: dark room, a few soft boxes.
function buildStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(30, 30, 30),
    new THREE.MeshBasicMaterial({ color: '#12181c', side: THREE.BackSide })
  );
  env.add(room);
  const panel = (w, h, color, strength, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  panel(10, 4, '#ffffff', 6, [0, 12, 4], [0, 0, 0]);    // overhead softbox
  panel(3, 14, '#ffe6cc', 4, [11, 2, 6], [0, 0, 0]);     // warm strip right
  panel(3, 14, '#bfe0ff', 3, [-11, 2, -4], [0, 0, 0]);   // cool strip left
  panel(8, 2, '#ffffff', 1.5, [0, -6, 10], [0, 0, 0]);   // low front bounce
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}

// Engineering-style ring with degree ticks under the cell.
function buildTurntable() {
  const g = new THREE.Group();
  g.name = 'turntable';
  const mat = new THREE.LineBasicMaterial({ color: '#d9895a', transparent: true, opacity: 0.35 });
  const ring = (r) => {
    const pts = [];
    for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  };
  g.add(ring(3.4), ring(4.6));
  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, r0 = 3.4, r1 = i % 6 === 0 ? 4.0 : 3.65;
    ticks.push(new THREE.Vector3(Math.cos(a) * r0, 0, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * r1, 0, Math.sin(a) * r1));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), mat));
  g.position.y = -4.4;
  return g;
}
