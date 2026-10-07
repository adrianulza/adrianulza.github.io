import * as THREE from 'three';
import { FOG_NEAR, FOG_FAR } from './scene.js';

// The landmark orbs:
//   core     the nucleus: a camera-facing disc with a rim and a centre dot, a
//            shell of 320 points, and a set of dials whose arcs turn at
//            different speeds, with a ripple each time the core fires
//   memories glass cells: a lumpy glass bubble that tumbles slowly, holding a
//            small 3D figure of the work, which comes alive on hover
// The Ulzanism palette suits them to the charcoal ground, and the nucleus
// dot is red: the origin of every thought.

const CORE_SCALE = 0.52;   // model units -> world units
const CELL_SCALE = 0.48;   // model units -> world units

const PALETTES = {
  light: {
    disc: [0.985, 0.985, 0.985], back: [0.43, 0.45, 0.47], rim: [0.3, 0.32, 0.34], dot: [0.3, 0.32, 0.34], halo: [0.43, 0.45, 0.47],
    hud: '#6c7277', shell: '#8a8f94',
    glassBody: [0.97, 0.975, 0.98], glassRim: [0.62, 0.65, 0.68], glassAlpha: 1,
    line: '#2a2e32', accent: '#6c7277', water: '#cfd6db',
    solid: hex => hex,
  },
  ulzanism: {
    disc: [0.96, 0.95, 0.95], back: [0.55, 0.6, 0.62], rim: [0.36, 0.33, 0.34], dot: [0.937, 0.31, 0.29], halo: [0.28, 0.81, 0.89],
    hud: '#ffffff', shell: '#b9cdd2',
    glassBody: [0.2, 0.19, 0.19], glassRim: [0.45, 0.86, 0.95], glassAlpha: 0.9, emissive: 0.18,
    line: '#e9f3f5', accent: '#9fb9c0', water: '#48cfe3',
    // Light solids become dark slate, dark solids become light, so each figure
    // keeps its contrast when the ground turns charcoal.
    solid: hex => {
      const c = new THREE.Color(hex), l = (c.r + c.g + c.b) / 3;
      return l > 0.7 ? '#9aa6ab' : l < 0.4 ? '#e3e8ea' : '#7c878c';
    },
  },
};

// ---------- core ----------
const NUCLEUS_FS = /* glsl */ `
uniform float uGlow;
uniform float uFade;
uniform vec3 uDisc;
uniform vec3 uBack;
uniform vec3 uRim;
uniform vec3 uDot;
uniform vec3 uHalo;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0) * 1.6;
  float halo = 0.1 * exp(-pow((r - 0.5) / 0.32, 2.0)) * uGlow;
  float disc = 1.0 - smoothstep(0.26, 0.3, r);
  float rim = (1.0 - smoothstep(0.0, 0.018, abs(r - 0.3))) * 0.45;
  float dot = (1.0 - smoothstep(0.045, 0.06, r)) * 0.55;
  vec3 col = mix(uHalo, uDisc, disc);
  col = mix(col, uRim, rim);
  col = mix(col, uDot, dot / 0.55);
  float a = max(max(disc * 0.92, halo), max(rim, dot / 0.55 * 0.9));
  a *= uFade;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;
const PLANE_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const SHELL_VS = /* glsl */ `
attribute float aSize;
attribute float aTone;
uniform float uPx;
uniform float uFade;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx / -mv.z, 1.0, 5.0);
  vA = aTone * uFade * 0.8;
}`;
const SHELL_FS = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float a = vA * (1.0 - smoothstep(0.6, 1.0, r));
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}`;

const arcPoints = (radius, a0, a1, n) => {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0); }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
};

function buildCore(seed) {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const group = new THREE.Group();
  const nucleus = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: {
      uGlow: { value: 1 }, uFade: { value: 1 },
      uDisc: { value: new THREE.Vector3() }, uBack: { value: new THREE.Vector3() }, uRim: { value: new THREE.Vector3() },
      uDot: { value: new THREE.Vector3() }, uHalo: { value: new THREE.Vector3() },
    },
    vertexShader: PLANE_VS, fragmentShader: NUCLEUS_FS,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), nucleus);
  plane.renderOrder = 14;

  // 320 points in a loose shell around the nucleus.
  const P = [], S = [], T = [];
  for (let i = 0; i < 320; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, q = Math.sqrt(1 - u * u), r = 0.42 + rand() ** 1.4 * 0.3;
    P.push(q * Math.cos(th) * r, u * r, q * Math.sin(th) * r); S.push(0.014 + rand() * 0.022); T.push(0.22 + rand() * 0.3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  sg.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1));
  sg.setAttribute('aTone', new THREE.Float32BufferAttribute(T, 1));
  const shellMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uPx: { value: 800 }, uFade: { value: 1 }, uColor: { value: new THREE.Color() } },
    vertexShader: SHELL_VS, fragmentShader: SHELL_FS,
  });
  const shell = new THREE.Points(sg, shellMat);
  shell.renderOrder = 13;

  // The instrument: concentric rings and arcs that turn at different speeds and
  // in opposite senses, like the dials of a measuring instrument. Each moving
  // arc carries a comet tail (alpha along its length), so the motion reads as a
  // direction rather than a spinning shape.
  const hud = new THREE.Group();
  const lines = [];
  const lineMat = (op, accent = false, tail = false) => new THREE.LineBasicMaterial({
    transparent: true, opacity: op, depthTest: false, depthWrite: false, vertexColors: tail, userData: { base: op, accent },
  });
  // An arc whose alpha rises from 0 at its tail to 1 at its head.
  const tailArc = (radius, len, n, power = 1.6) => {
    const g = arcPoints(radius, 0, len, n), col = [];
    for (let i = 0; i <= n; i++) col.push(1, 1, 1, (i / n) ** power);
    return g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  };
  const add = (o, parent = hud) => { o.renderOrder = 15; parent.add(o); lines.push(o); return o; };

  // Static frame: the inner ring and a faint outer guide.
  add(new THREE.LineLoop(arcPoints(0.78, 0, Math.PI * 2, 160), lineMat(0.3)));
  add(new THREE.LineLoop(arcPoints(1.05, 0, Math.PI * 2, 200), lineMat(0.1)));
  // A: the main arc. A full circle whose drawn length breathes (draw range).
  const arcA = add(new THREE.Line(arcPoints(0.91, 0, Math.PI * 2, 240), lineMat(0.62)));
  // B: a shorter arc with a tail, turning the other way on the outer guide.
  const arcB = add(new THREE.Line(tailArc(1.05, THREE.MathUtils.degToRad(62), 48), lineMat(0.6, false, true)));
  // C: two short accent arcs facing each other, slow.
  const pairC = new THREE.Group(); hud.add(pairC);
  const cLen = THREE.MathUtils.degToRad(20);
  add(new THREE.Line(arcPoints(1.17, 0, cLen, 20), lineMat(0.7, true)), pairC);
  add(new THREE.Line(arcPoints(1.17, Math.PI, Math.PI + cLen, 20), lineMat(0.7, true)), pairC);
  // D: a dial of 72 ticks, every sixth one longer, and a bright sweep across it.
  const tk = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, r0 = i % 6 === 0 ? 1.235 : 1.26;
    tk.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * 1.29, Math.sin(a) * 1.29, 0);
  }
  const ticks = add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tk, 3)), lineMat(0.22)));
  const sweep = add(new THREE.Line(tailArc(1.29, THREE.MathUtils.degToRad(48), 40, 2.2), lineMat(0.75, false, true)));
  // E: a ripple ring that leaves the nucleus each time the core fires.
  const ripple = add(new THREE.LineLoop(arcPoints(1, 0, Math.PI * 2, 120), lineMat(0)));
  ripple.visible = false;

  group.add(plane, hud, shell);
  group.scale.setScalar(CORE_SCALE);
  return {
    group, plane, nucleus, shell, shellMat, hud, lines, arcA, arcB, pairC, ticks, sweep, ripple,
    spin: { a: 0, b: 2.2, c: 0.6, d: 0, s: 1.1, sh: 0 }, rippleT: 1, lastF: 0,
  };
}

// ---------- cells ----------
// The membrane: an icosphere with a few low sine bumps, so it reads as a cell.
function blob(radius, seed) {
  const g = new THREE.IcosahedronGeometry(radius, 18), p = g.getAttribute('position'), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.3) * Math.sin(v.z * 3.3 + seed * 0.7)
      + 0.5 * Math.sin(v.x * 6.3 + v.y * 5.1 + seed * 2.1) * 0.5;
    v.multiplyScalar(radius * (1 + 0.045 * n)); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
const GLASS_VS = 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }';
const GLASS_FS = /* glsl */ `
uniform float uOpacity;
uniform vec3 uBody;
uniform vec3 uRimC;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 N = normalize(vN), V = normalize(vV);
  float f = pow(1.0 - abs(dot(N, V)), 2.4);
  vec3 L = normalize(vec3(-0.4, 0.7, 0.6)), H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 60.0);
  vec3 col = mix(uBody, uRimC, f * 0.6) + spec * 0.35;
  gl_FragColor = vec4(col, (0.16 + f * 0.62 + spec * 0.4) * uOpacity);
}`;

// Ground motion for the shaking table and the frame's sway.
const ground = t => (0.55 + 0.45 * Math.sin(t * 0.7)) * (0.6 * Math.sin(t * 9.1) + 0.3 * Math.sin(t * 14.3 + 1.3) + 0.2 * Math.sin(t * 5.2 + 0.4));
const erf = x => { const s = Math.sign(x); x = Math.abs(x); const n = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * n - 1.453152027) * n + 1.421413741) * n - 0.284496736) * n + 0.254829592) * n * Math.exp(-x * x)); };
const lognormal = (x, m, b) => (x <= 0 ? 0 : 0.5 * (1 + erf(Math.log(x / m) / (b * Math.SQRT2))));

// Every material a figure uses is registered, so a mode change can recolour it.
class Kit {
  constructor() { this.lines = []; this.solids = []; this.extras = []; }
  line(op = 0.95) { const m = new THREE.LineBasicMaterial({ transparent: true, opacity: op, depthWrite: false }); m.userData.base = op; this.lines.push(m); return m; }
  accent(op = 0.6) { const m = new THREE.LineBasicMaterial({ transparent: true, opacity: op, depthWrite: false }); m.userData.base = op; m.userData.accent = true; this.lines.push(m); return m; }
  solid(hex = '#f3f4f5') { const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, transparent: true }); m.userData.hex = hex; this.solids.push(m); return m; }
  segs(arr, mat) { return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)), mat); }
  polyline(arr, mat) { return new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)), mat); }
  setMode(pal) {
    for (const m of this.lines) m.color.set(m.userData.accent ? pal.accent : pal.line);
    for (const m of this.solids) {
      m.color.set(pal.solid(m.userData.hex));
      // On charcoal, a little self-light keeps the figures readable.
      m.emissive.copy(m.color).multiplyScalar(pal.emissive ?? 0);
    }
    for (const f of this.extras) f(pal);
  }
}

const FIGURES = {
  // ASFRAVA-B: five fragility curves that draw in, with rungs between them.
  fragility(k) {
    const g = new THREE.Group(), med = [0.22, 0.34, 0.5, 0.72, 1];
    const X = i => -0.5 + i / 40, Z = j => -0.34 + (j / (med.length - 1)) * 0.68, Y = (i, j) => -0.36 + 0.72 * lognormal((i / 40) * 1.7, med[j], 0.45);
    const curves = med.map((_, j) => { const pts = []; for (let i = 0; i <= 40; i++) pts.push(X(i), Y(i, j), Z(j)); const l = k.polyline(pts, k.line(j === 2 ? 1 : 0.55)); g.add(l); return l; });
    const rungs = []; for (let i = 0; i <= 40; i += 4) for (let j = 0; j < med.length - 1; j++) rungs.push(X(i), Y(i, j), Z(j), X(i), Y(i, j + 1), Z(j + 1));
    const rung = k.segs(rungs, k.line(0.28)); g.add(rung);
    g.add(k.segs([-0.5, -0.38, -0.36, 0.52, -0.38, -0.36, -0.5, -0.38, -0.36, -0.5, 0.4, -0.36, -0.5, -0.38, -0.36, -0.5, -0.38, 0.4], k.accent(0.6)));
    g.rotation.set(-0.35, 0.55, 0);
    return { group: g, update(t, amp) {
      const cyc = (t % 7) / 7, n = Math.round(41 * (1 - amp + amp * Math.min(1, cyc * 1.6)));
      for (const c of curves) c.geometry.setDrawRange(0, Math.max(2, n));
      rung.geometry.setDrawRange(0, Math.floor(((n / 41) * (rungs.length / 3)) / 2) * 2);
      g.rotation.y = 0.55 + Math.sin(t * 0.25) * 0.25;
    } };
  },
  // OpenAnstruk: a 2×1-bay, 3-storey frame that sways in its first mode.
  frame(k) {
    const g = new THREE.Group(), xs = [-0.36, 0, 0.36], zs = [-0.2, 0.2], h = 0.24, y0 = -0.4, base = [];
    for (const x of xs) for (const z of zs) base.push(x, y0, z, x, y0 + 3 * h, z);
    for (let s = 1; s <= 3; s++) { const y = y0 + s * h; for (const z of zs) base.push(xs[0], y, z, xs[2], y, z); for (const x of xs) base.push(x, y, zs[0], x, y, zs[1]); }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(base.slice(), 3));
    g.add(new THREE.LineSegments(geo, k.line()));
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.56), k.solid('#e6e8ea')); slab.position.y = -0.42; g.add(slab);
    const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 10, 8), k.solid('#2a2e32'), xs.length * zs.length * 4); g.add(joints);
    const M = new THREE.Matrix4();
    g.rotation.set(0.28, -0.6, 0);
    return { group: g, update(t, amp) {
      const a = geo.getAttribute('position'), arr = a.array, d = 0.06 * amp * Math.sin(t * 1.7);
      for (let i = 0; i < base.length; i += 3) { const u = (base[i + 1] - y0) / (3 * h); arr[i] = base[i] + d * u * u * (1.6 - 0.6 * u); }
      a.needsUpdate = true;
      let n = 0;
      for (const x of xs) for (const z of zs) for (let s = 0; s <= 3; s++) { const u = s / 3; M.makeTranslation(x + d * u * u * (1.6 - 0.6 * u), y0 + s * h, z); joints.setMatrixAt(n++, M); }
      joints.instanceMatrix.needsUpdate = true;
      g.rotation.y = -0.6 + Math.sin(t * 0.2) * 0.2;
    } };
  },
  // SIM-GEUMPA: the shaking table carrying a two-storey specimen.
  table(k) {
    const g = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.42), k.solid('#dfe2e4')); bed.position.y = -0.42; g.add(bed);
    for (const z of [-0.12, 0.12]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.02, 0.03), k.solid('#9aa0a5')); r.position.set(0, -0.38, z); g.add(r); }
    const top = new THREE.Group(); g.add(top);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.36), k.solid('#f5f6f7')); plat.position.y = -0.34; top.add(plat);
    const xs = [-0.16, 0.16], zs = [-0.12, 0.12], y0 = -0.32, h = 0.26, base = [];
    for (const x of xs) for (const z of zs) base.push(x, y0, z, x, 0.2, z);
    for (let s = 1; s <= 2; s++) { const y = y0 + s * h; for (const z of zs) base.push(xs[0], y, z, xs[1], y, z); for (const x of xs) base.push(x, y, zs[0], x, y, zs[1]); }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(base.slice(), 3));
    top.add(new THREE.LineSegments(geo, k.line()));
    const slabs = [];
    for (let s = 1; s <= 2; s++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.28), k.solid('#e9ebed')); m.position.y = y0 + s * h; top.add(m); slabs.push(m); }
    g.rotation.set(0.3, 0.5, 0);
    let lag = 0;
    return { group: g, update(t, amp) {
      const x = ground(t) * amp; top.position.x = 0.07 * x; lag += (x - lag) * 0.18;
      const a = geo.getAttribute('position'), arr = a.array;
      for (let i = 0; i < base.length; i += 3) { const u = (base[i + 1] - y0) / (2 * h); arr[i] = base[i] + 0.06 * lag * u * u; }
      a.needsUpdate = true;
      slabs.forEach((m, i) => { const u = (i + 1) / 2; m.position.x = 0.06 * lag * u * u; });
      g.rotation.y = 0.5 + Math.sin(t * 0.18) * 0.2;
    } };
  },
  // supeRISKa lite: a 5×5 block of buildings under a loss curve.
  loss(k) {
    const g = new THREE.Group(), boxes = [], unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);
    let s = 11; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const h = 0.06 + rand() * 0.3, m = new THREE.Mesh(unit, k.solid(rand() > 0.8 ? '#cfd3d6' : '#f1f2f3'));
      m.position.set(-0.36 + i * 0.18, -0.42, -0.36 + j * 0.18); m.scale.set(0.12, h, 0.12); g.add(m);
      boxes.push({ m, h, d: Math.hypot(i - 2, j - 2) });
    }
    const curve = []; for (let i = 0; i <= 40; i++) { const u = i / 40; curve.push(-0.5 + u, -0.05 + 0.5 * Math.exp(-3.4 * u), 0.42); }
    const line = k.polyline(curve, k.line()); g.add(line);
    const fill = []; for (let i = 0; i <= 40; i += 2) { const u = i / 40; fill.push(-0.5 + u, -0.05 + 0.5 * Math.exp(-3.4 * u), 0.42, -0.5 + u, -0.05, 0.42); }
    const hatch = k.segs(fill, k.line(0.18)); g.add(hatch);
    g.rotation.set(0.42, -0.55, 0);
    return { group: g, update(t, amp) {
      const c = (t % 6) / 6;
      for (const b of boxes) { const w = Math.max(0, Math.sin((c * 2.2 - b.d * 0.18) * Math.PI)); b.m.scale.y = b.h * (1 - 0.35 * amp * w); }
      const n = Math.round(41 * (1 - amp + amp * Math.min(1, c * 1.5)));
      line.geometry.setDrawRange(0, Math.max(2, n)); hatch.geometry.setDrawRange(0, Math.max(0, Math.floor(n / 2) * 2));
      g.rotation.y = -0.55 + Math.sin(t * 0.2) * 0.2;
    } };
  },
  // Siaga Banjir: a house on stilts above rising water.
  flood(k) {
    const g = new THREE.Group(), house = new THREE.Group(); g.add(house);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.32), k.solid('#f4f5f6')); body.position.y = 0.02; house.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.34, 0.2, 4, 1), k.solid('#3b4146')); roof.rotation.y = Math.PI / 4; roof.position.y = 0.25; roof.scale.set(1, 1, 0.8); house.add(roof);
    const stilts = []; for (const x of [-0.17, 0.17]) for (const z of [-0.13, 0.13]) stilts.push(x, -0.11, z, x, -0.42, z);
    house.add(k.segs(stilts, k.line()));
    const water = new THREE.PlaneGeometry(1.1, 1.1, 28, 28); water.rotateX(-Math.PI / 2);
    const rest = water.getAttribute('position').array.slice();
    const sheet = new THREE.MeshStandardMaterial({ roughness: 0.25, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const wire = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.14, depthWrite: false });
    wire.userData.base = 0.14;
    k.extras.push(pal => { sheet.color.set(pal.water); sheet.userData.base = pal === PALETTES.light ? 0.55 : 0.32; wire.color.set(pal.accent); });
    g.add(new THREE.Mesh(water, sheet), new THREE.Mesh(water, wire));
    g.rotation.set(0.35, 0.6, 0);
    return { group: g, update(t, amp) {
      const level = -0.34 + 0.12 * amp * (0.5 + 0.5 * Math.sin(t * 0.45)), a = water.getAttribute('position'), arr = a.array;
      for (let i = 0; i < arr.length; i += 3) { const x = rest[i], z = rest[i + 2], w = Math.max(0, 1 - Math.hypot(x, z) / 0.62); arr[i + 1] = level + (0.018 + 0.02 * amp) * Math.sin(x * 11 - t * 1.8 + z * 4) * w; }
      a.needsUpdate = true; water.computeVertexNormals();
      house.position.y = Math.sin(t * 0.9) * 0.008;
      g.rotation.y = 0.6 + Math.sin(t * 0.2) * 0.2;
    } };
  },
  // Publications: eight pages orbiting in a helix.
  papers(k, count = 8) {
    const g = new THREE.Group(), page = new THREE.PlaneGeometry(0.2, 0.27), text = [];
    for (let i = 0; i < 6; i++) { const y = 0.09 - i * 0.035, w = i === 0 ? 0.14 : 0.16 - (i % 3) * 0.03; text.push(-0.075, y, 0.001, -0.075 + w, y, 0.001); }
    const textGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(text, 3));
    const paper = new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide, transparent: true });
    k.extras.push(pal => paper.color.set(pal === PALETTES.light ? '#fbfbfc' : '#4b4546'));
    const pages = [];
    for (let i = 0; i < count; i++) { const p = new THREE.Group(); p.add(new THREE.Mesh(page, paper), new THREE.LineSegments(textGeo, k.line(0.45))); g.add(p); pages.push(p); }
    return { group: g, update(t, amp) {
      const R = 0.2 + 0.2 * amp, step = 0.07 + 0.03 * amp;
      pages.forEach((p, i) => {
        const a = t * 0.25 + (i / count) * Math.PI * 2 * (0.62 + 0.38 * amp);
        p.position.set(Math.cos(a) * R, (i - (count - 1) / 2) * step * 0.9, Math.sin(a) * R);
        p.rotation.set(0, -a + Math.PI / 2, Math.sin(t * 0.6 + i) * 0.06);
      });
    } };
  },
  // Books: two books, one cover swinging open.
  books(k) {
    const g = new THREE.Group();
    const book = (coverHex, h, x) => {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, h - 0.02, 0.07), k.solid('#fbfaf8')));
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.21, h, 0.008), k.solid(coverHex)); back.position.z = -0.038; b.add(back);
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.008, h, 0.084), k.solid(coverHex)); spine.position.x = -0.104; b.add(spine);
      const hinge = new THREE.Group(); hinge.position.set(-0.104, 0, 0.038); b.add(hinge);
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.21, h, 0.008), k.solid(coverHex)); front.position.x = 0.105; hinge.add(front);
      const title = [0.03, h * 0.28, 0.005, 0.17, h * 0.28, 0.005, 0.03, h * 0.22, 0.005, 0.13, h * 0.22, 0.005].map((v, i) => (i % 3 === 0 ? v - 0.105 : v));
      const ink = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }); ink.userData.base = 0.7;
      front.add(k.segs(title, ink));
      b.position.x = x; g.add(b);
      return hinge;
    };
    const open = book('#3b4146', 0.5, -0.14);
    book('#b9bec2', 0.46, 0.14);
    g.rotation.set(0.12, 0.4, 0);
    return { group: g, update(t, amp) {
      open.rotation.y = -0.5 * amp * (0.6 + 0.4 * Math.sin(t * 0.8));
      g.rotation.y = 0.4 + Math.sin(t * 0.22) * 0.45;
    } };
  },
};

const fogOf = d => 1 - Math.min(1, Math.max(0, (d - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));

export class Orbs {
  constructor(scene3, glyphs, seed = 26) {
    this.root = new THREE.Group();
    scene3.add(this.root);
    // Soft studio light for the figures (lighter than a room environment).
    this.hemi = new THREE.HemisphereLight('#ffffff', '#b8bec3', 1.6);
    this.sun = new THREE.DirectionalLight('#ffffff', 1.4); this.sun.position.set(-4, 6, 7);
    scene3.add(this.hemi, this.sun);

    this.core = buildCore(seed);
    this.root.add(this.core.group);

    this.kit = new Kit();
    this.glass = new THREE.ShaderMaterial({
      vertexShader: GLASS_VS, fragmentShader: GLASS_FS, transparent: true, depthWrite: false,
      uniforms: { uOpacity: { value: 1 }, uBody: { value: new THREE.Vector3() }, uRimC: { value: new THREE.Vector3() } },
    });
    this.cells = glyphs.map((name, i) => {
      const group = new THREE.Group();
      const glassMat = this.glass.clone();
      const membrane = new THREE.Mesh(blob(1.05, i + 1), glassMat); membrane.renderOrder = 16;
      const figure = FIGURES[name](this.kit);
      figure.group.scale.setScalar(1.38);
      figure.group.traverse(o => { o.renderOrder = 17; });
      // The figure sits in a holder that always turns to face the viewer, so the
      // work is seen from a three-quarter view, never from above
      // or below. The glass membrane keeps its own slow tumble.
      const holder = new THREE.Group();
      holder.add(figure.group);
      group.add(membrane, holder);
      this.root.add(group);
      return { group, membrane, holder, glassMat, figure, amp: 0.25, scale: 1, spin: i * 2.17, figMats: [] };
    });
    // Collect each cell's figure materials so they can fade with the fog.
    for (const c of this.cells) c.figure.group.traverse(o => { if (o.material && !c.figMats.includes(o.material)) c.figMats.push(o.material); });
  }

  setMode(name) {
    const pal = PALETTES[name] ?? PALETTES.ulzanism;
    this.pal = pal;
    const n = this.core.nucleus.uniforms;
    n.uDisc.value.fromArray(pal.disc); n.uBack.value.fromArray(pal.back); n.uRim.value.fromArray(pal.rim); n.uDot.value.fromArray(pal.dot); n.uHalo.value.fromArray(pal.halo);
    this.core.shellMat.uniforms.uColor.value.set(pal.shell);
    const accent = new THREE.Color().fromArray(pal.halo);
    this.core.lines.forEach(l => (l.material.userData.accent ? l.material.color.copy(accent) : l.material.color.set(pal.hud)));
    for (const c of this.cells) { c.glassMat.uniforms.uBody.value.fromArray(pal.glassBody); c.glassMat.uniforms.uRimC.value.fromArray(pal.glassRim); }
    this.kit.setMode(pal);
    this.hemi.intensity = 1.6;
  }

  // marks: landmark screen state from the Hud (world = nearest copy).
  update({ marks, camera, t, dt, flash, coreIndex, memoryNodes, hover, selected, coreHover, breath, coreAppear, cellAppear, pxScale, narrow, panelRect, mask = 0, still = false }) {
    // Reading mask: orbs under the open panel fade away.
    const under = m => (panelRect && mask > 0 && m.x > panelRect.left && m.x < panelRect.right && m.y > panelRect.top && m.y < panelRect.bottom ? 1 - 0.9 * mask : 1);
    const C = this.core, m0 = marks[0];
    C.group.position.fromArray(m0.world);
    const f0 = flash[coreIndex];
    const sc = (1 + 0.03 * breath + (coreHover ? 0.05 : 0) + f0 * 0.03) * (0.6 + 0.4 * coreAppear);
    // The core is the centre of gravity: its outer dial never drops below 40 px.
    const boost = m0.r > 0 ? Math.max(1, 40 / m0.r) : 1;
    m0.r *= boost;
    C.group.scale.setScalar(CORE_SCALE * sc * boost);
    C.nucleus.uniforms.uGlow.value = 0.6 + 0.4 * f0 + (coreHover ? 0.4 : 0);
    const fade = under(m0) * fogOf(m0.dist) * coreAppear * Math.min(1, Math.max(0, (m0.dist - 1.2) / 1.2));
    C.nucleus.uniforms.uFade.value = fade;
    C.shellMat.uniforms.uFade.value = fade;
    C.shellMat.uniforms.uPx.value = pxScale * CORE_SCALE * sc * boost * 2;
    C.lines.forEach(l => { l.material.opacity = l.material.userData.base * fade; });
    C.group.visible = fade > 0.01;
    C.hud.quaternion.copy(camera.quaternion);
    C.plane.quaternion.copy(camera.quaternion);

    // The dials. Each turns at its own speed (degrees per second) and the main
    // arcs get a short kick when the core fires, then settle back.
    const go = still ? 0 : dt, D = THREE.MathUtils.degToRad, sp = C.spin;
    const kick = 1 + 2.4 * f0;
    sp.a -= D(26) * kick * go;
    sp.b += D(16) * kick * go;
    sp.c += D(9) * go;
    sp.d -= D(3) * go;
    sp.s -= D(64) * go;
    sp.sh += 0.12 * go;
    C.arcA.rotation.z = sp.a;
    C.arcB.rotation.z = sp.b;
    C.pairC.rotation.z = sp.c;
    C.ticks.rotation.z = sp.d;
    C.sweep.rotation.z = sp.s;
    C.shell.rotation.y = sp.sh; C.shell.rotation.x = Math.sin(sp.sh * 0.4) * 0.3;
    // Arc A breathes between about 80 and 150 degrees on a slow cycle.
    const span = 115 + 35 * Math.sin(sp.sh * 3.1);
    C.arcA.geometry.setDrawRange(0, Math.round((span / 360) * 240) + 1);

    // The ripple: a ring that grows from the nucleus and fades, once per firing.
    if (f0 > C.lastF + 0.4 && !still) C.rippleT = 0;
    C.lastF = f0;
    if (C.rippleT < 1) {
      C.rippleT = Math.min(1, C.rippleT + dt / 1.3);
      const p = C.rippleT, e = 1 - (1 - p) ** 3;
      C.ripple.visible = true;
      C.ripple.scale.setScalar(0.32 + 1.08 * e);
      C.ripple.material.opacity = 0.55 * (1 - p) ** 1.6 * fade;
    } else C.ripple.visible = false;

    this.cells.forEach((c, i) => {
      const m = marks[i + 1];
      c.group.position.fromArray(m.world);
      const hot = hover === i || selected === i;
      const target = (hover === i ? 1.06 : 1) * (1 + flash[memoryNodes[i]] * 0.03);
      c.scale += (target - c.scale) * Math.min(1, dt * 7);
      const breathe = 1 + 0.018 * Math.sin(t * 0.8 + i * 1.7);
      // Each cell swells in with a soft overshoot (easeOutBack) when its turn comes.
      const a = cellAppear[i], pop = a <= 0 ? 0 : a >= 1 ? 1 : 1 + 2.2 * (a - 1) ** 3 + 1.2 * (a - 1) ** 2;
      // Near cells are capped on screen, so the closest work never swamps the frame.
      const capPx = narrow ? 44 : 62, cap = m.r > capPx ? capPx / m.r : 1;
      m.r = Math.min(m.r, capPx);
      c.group.scale.setScalar(CELL_SCALE * c.scale * breathe * cap * Math.max(0.001, pop));
      c.membrane.rotation.set(Math.sin(t * 0.07 + c.spin) * 0.4, t * 0.06 + c.spin, 0);
      c.holder.quaternion.copy(camera.quaternion);   // face the viewer
      c.amp += ((hot ? 1 : 0.25) - c.amp) * Math.min(1, dt * 3);
      c.figure.update(t + i * 1.9, c.amp);
      const fade = under(m) * fogOf(m.dist) * Math.min(1, a * 1.5) * Math.min(1, Math.max(0, (m.dist - 0.9) / 1.0));
      c.glassMat.uniforms.uOpacity.value = fade * this.pal.glassAlpha;
      for (const mat of c.figMats) mat.opacity = (mat.userData.base ?? 1) * fade;
      c.group.visible = fade > 0.01;
    });
  }
}
