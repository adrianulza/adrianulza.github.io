import * as THREE from 'three';
import { P } from './field.js';

// The WebGL layer, drawn with these marks:
//   points   tiny squares, 0.9 + 1.3·depth px, alpha .12 + .7·depth², never wired
//   neurons  radius (1.6 + 2.4·depth)·(1 + 0.9·flash) px; 45% are 1.1 px rings,
//            the rest filled discs; a firing neuron shows a flat halo of 3.2× radius
//   synapses thin lines, alpha edge·(.35 + .65·depth) + activity·.35
// Pulses, landmarks and cursor lines are drawn on the 2D canvas above (hud.js).
//
// Everything repeats with period P; wrapRel() draws each mark at the copy
// nearest the camera, and fog hides anything farther than FOG_FAR < P/2.

const FOG_NEAR = 7.5, FOG_FAR = 16.5;

const COMMON = /* glsl */ `
uniform vec3 uCam;
uniform float uP;
uniform float uFogNear;
uniform float uFogFar;
uniform float uDpr;
uniform float uCondense;
vec3 wrapRel(vec3 p) { vec3 r = p - uCam; return r - uP * floor(r / uP + 0.5); }
float fogOf(float d) { return 1.0 - smoothstep(uFogNear, uFogFar, d); }
// "depth" in the hero's sense: 1 at the front of the form, 0 at the back.
float depthOf(float d) { return 1.0 - smoothstep(2.0, uFogFar, d); }
// Marks right against the lens fade out instead of filling the screen.
float closeOf(float d) { return smoothstep(2.6, 5.0, d); }
`;
const COLOUR = /* glsl */ `
uniform vec3 uG0;
uniform vec3 uG1;
uniform vec3 uG2;
uniform vec3 uInk;
uniform float uUseGrad;
uniform vec2 uRes;
uniform vec4 uPanel;      // reading panel rect in device px: x0, y0, x1, y1 (GL origin, bottom-left)
uniform float uMask;      // 0 to 1, eased with the panel
// Reading mask: the network fades behind the open panel, with a soft edge.
float readingMask() {
  if (uMask <= 0.0) return 1.0;
  vec2 p = gl_FragCoord.xy, f = vec2(140.0 * uRes.x / max(1.0, uRes.x));
  float inX = smoothstep(uPanel.x - f.x, uPanel.x, p.x) * (1.0 - smoothstep(uPanel.z, uPanel.z + f.x, p.x));
  float inY = smoothstep(uPanel.y - f.y, uPanel.y, p.y) * (1.0 - smoothstep(uPanel.w, uPanel.w + f.y, p.y));
  return 1.0 - 0.88 * uMask * inX * inY;
}
vec3 tint() {
  if (uUseGrad < 0.5) return uInk;
  float t = clamp(gl_FragCoord.x / uRes.x, 0.0, 1.0);
  return t < 0.5 ? mix(uG0, uG1, t * 2.0) : mix(uG1, uG2, t * 2.0 - 1.0);
}
`;

const POINT_VS = /* glsl */ `
${COMMON}
attribute vec3 aScatter;
varying float vA;
void main() {
  vec3 r = wrapRel(position + aScatter * (1.0 - uCondense));
  float d = length(r);
  gl_Position = projectionMatrix * viewMatrix * vec4(uCam + r, 1.0);
  float depth = depthOf(d);
  gl_PointSize = (0.9 + 1.3 * depth) * uDpr;
  vA = max(0.06, 0.12 + 0.7 * depth * depth) * fogOf(d) * closeOf(d);
}`;
const POINT_FS = /* glsl */ `
${COLOUR}
varying float vA;
void main() {
  float a = vA * readingMask();
  if (a < 0.004) discard;
  gl_FragColor = vec4(tint(), a);         // a crisp square, like fillRect
}`;

const NEURON_VS = /* glsl */ `
${COMMON}
attribute float aVisible;
attribute float aHollow;
attribute float aFlash;
attribute vec3 aScatter;
uniform float uNet;
varying float vA;
varying float vVis;
varying float vHollow;
varying float vFlash;
varying float vPx;
varying float vR;
void main() {
  vec3 r = wrapRel(position + aScatter * (1.0 - uCondense));
  float d = length(r);
  gl_Position = projectionMatrix * viewMatrix * vec4(uCam + r, 1.0);
  float depth = depthOf(d);
  float radius = (1.6 + 2.4 * depth) * (1.0 + 0.9 * aFlash);
  float outer = max(radius + 1.4, radius * 3.2 * step(0.05, aFlash));   // room for ring or halo
  vPx = 2.0 * outer * uDpr;
  gl_PointSize = vPx;
  vR = radius / outer;                      // neuron radius as a fraction of the sprite
  vVis = fogOf(d) * closeOf(d) * aVisible * uNet;
  vA = (0.3 + 0.7 * depth) * vVis;
  vHollow = aHollow;
  vFlash = aFlash;
}`;
const NEURON_FS = /* glsl */ `
${COLOUR}
uniform float uDpr;
uniform float uGlow;
uniform float uBody;
varying float vA;
varying float vVis;
varying float vHollow;
varying float vFlash;
varying float vPx;
varying float vR;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0 || vVis < 0.004) discard;
  float px = 2.0 / vPx;                     // one device pixel in q units
  float a = 0.0;
  // Flat halo while firing (hero: fill at radius·3.2, alpha flash·.25).
  float halo = vFlash > 0.05 ? (1.0 - smoothstep(1.0 - px, 1.0, r)) * vFlash * uGlow : 0.0;
  if (vHollow > 0.5) {
    // Ring of 1.1 px at radius + 0.8 px.
    float ringR = vR + 0.8 * uDpr * px * 0.5 * 2.0;
    float w = 0.55 * uDpr * px;
    float ring = 1.0 - smoothstep(w, w + px, abs(r - ringR));
    a = ring * vA;
  } else {
    float body = 1.0 - smoothstep(vR - px, vR, r);
    a = body * min(vA, uBody);
  }
  a = max(a, halo * vVis) * readingMask();
  if (a < 0.003) discard;
  gl_FragColor = vec4(tint(), a);
}`;

const EDGE_VS = /* glsl */ `
${COMMON}
uniform float uWire;
uniform float uEdge;
attribute vec3 aHalf;
attribute float aSign;
attribute float aAct;
varying float vA;
void main() {
  vec3 r = wrapRel(position) + aHalf * aSign;
  float d = length(r);
  gl_Position = projectionMatrix * viewMatrix * vec4(uCam + r, 1.0);
  vA = (uEdge * (0.35 + 0.65 * depthOf(d)) + aAct * 0.35) * fogOf(d) * closeOf(d) * uWire;
}`;
const EDGE_FS = /* glsl */ `
${COLOUR}
varying float vA;
void main() { gl_FragColor = vec4(tint(), vA * readingMask()); }`;

const vec3Of = c => new THREE.Vector3(c[0] / 255, c[1] / 255, c[2] / 255);

export class Scene {
  constructor(canvas, field, { pixelRatio = 1 } = {}) {
    this.field = field;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.pixelRatio = pixelRatio;
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
    this.scene = new THREE.Scene();

    this.u = {
      uCam: { value: new THREE.Vector3() }, uP: { value: P },
      uFogNear: { value: FOG_NEAR }, uFogFar: { value: FOG_FAR },
      uCondense: { value: 0 }, uWire: { value: 0 }, uNet: { value: 0 },
      uDpr: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
      uPanel: { value: new THREE.Vector4(0, 0, 0, 0) }, uMask: { value: 0 },
      uG0: { value: new THREE.Vector3() }, uG1: { value: new THREE.Vector3() }, uG2: { value: new THREE.Vector3() },
      uInk: { value: new THREE.Vector3() }, uUseGrad: { value: 1 },
      uEdge: { value: 0.32 }, uGlow: { value: 0.25 }, uBody: { value: 1 },
    };
    const mat = (vertexShader, fragmentShader) => new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false,
    });

    // Points.
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(field.points, 3));
    pg.setAttribute('aScatter', new THREE.BufferAttribute(field.pointScatter, 3));
    this.points = new THREE.Points(pg, mat(POINT_VS, POINT_FS));

    // Neurons (landmarks are in the same arrays but invisible here; hud.js draws them).
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(field.pos, 3));
    g.setAttribute('aVisible', new THREE.BufferAttribute(field.visible, 1));
    g.setAttribute('aHollow', new THREE.BufferAttribute(field.hollow, 1));
    g.setAttribute('aScatter', new THREE.BufferAttribute(field.scatter, 3));
    this.flashAttr = new THREE.BufferAttribute(new Float32Array(field.nodeCount), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aFlash', this.flashAttr);
    this.neurons = new THREE.Points(g, mat(NEURON_VS, NEURON_FS));

    // Synapses: two vertices per edge, both carrying the edge midpoint as "position".
    const E = field.edgeCount;
    const eg = new THREE.BufferGeometry(), mids = new Float32Array(E * 6), halves = new Float32Array(E * 6), signs = new Float32Array(E * 2);
    for (let e = 0; e < E; e++) for (let k = 0; k < 2; k++) {
      mids.set(field.mid.subarray(e * 3, e * 3 + 3), (e * 2 + k) * 3);
      halves.set(field.half.subarray(e * 3, e * 3 + 3), (e * 2 + k) * 3);
      signs[e * 2 + k] = k ? 1 : -1;        // -1 is end A, +1 is end B
    }
    eg.setAttribute('position', new THREE.BufferAttribute(mids, 3));
    eg.setAttribute('aHalf', new THREE.BufferAttribute(halves, 3));
    eg.setAttribute('aSign', new THREE.BufferAttribute(signs, 1));
    this.actAttr = new THREE.BufferAttribute(new Float32Array(E * 2), 1).setUsage(THREE.DynamicDrawUsage);
    eg.setAttribute('aAct', this.actAttr);
    this.edges = new THREE.LineSegments(eg, mat(EDGE_VS, EDGE_FS));

    // Draw order as in the hero: edges, then points, then neurons on top.
    for (const o of [this.edges, this.points, this.neurons]) { o.frustumCulled = false; this.scene.add(o); }

    this.vp = new THREE.Matrix4();
    this.cssW = 1; this.cssH = 1;
  }

  setMode(mode) {
    const g = mode.grad;
    this.u.uUseGrad.value = g ? 1 : 0;
    if (g) { this.u.uG0.value.copy(vec3Of(g[0])); this.u.uG1.value.copy(vec3Of(g[1])); this.u.uG2.value.copy(vec3Of(g[2])); }
    this.u.uInk.value.copy(vec3Of(mode.ink));
    this.u.uEdge.value = mode.edge; this.u.uGlow.value = mode.glow; this.u.uBody.value = mode.body;
  }

  setPixelRatio(pr) { this.pixelRatio = pr; this.cssW = 0; }
  thinPoints(fraction) { this.points.geometry.setDrawRange(0, Math.floor(this.field.points.length / 3 * fraction)); }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (w === this.cssW && h === this.cssH && this.renderer.getPixelRatio() === this.pixelRatio) return;
    this.cssW = w; this.cssH = h;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.u.uRes.value.set(w * this.pixelRatio, h * this.pixelRatio);
    this.u.uDpr.value = this.pixelRatio;
  }

  update({ pos, look, fov }, sim, intro) {
    this.resize();
    const cam = this.camera;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.position.copy(pos);
    cam.lookAt(look);
    cam.updateMatrixWorld();
    this.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.u.uCam.value.copy(pos);
    this.u.uCondense.value = intro.condense;
    this.u.uWire.value = intro.wire;
    // Reading mask: convert the panel's CSS rect to GL device pixels (y flipped).
    const r = intro.panelRect, pr = this.pixelRatio;
    if (r) this.u.uPanel.value.set(r.left * pr, (this.cssH - r.bottom) * pr, r.right * pr, (this.cssH - r.top) * pr);
    this.u.uMask.value = intro.mask ?? 0;
    this.u.uNet.value = intro.wire;   // neurons appear with the wiring, as in the hero

    this.flashAttr.array.set(sim.flash); this.flashAttr.needsUpdate = true;
    const a = this.actAttr.array, A = this.field.edgesA, B = this.field.edgesB, f = sim.flash;
    for (let e = 0; e < A.length; e++) { const v = Math.max(f[A[e]], f[B[e]]); a[e * 2] = v; a[e * 2 + 1] = v; }
    this.actAttr.needsUpdate = true;
  }

  render() { this.renderer.render(this.scene, this.camera); }

  // Projects a world point to CSS pixels. Returns false if it is behind the camera.
  project(x, y, z, out) {
    const e = this.vp.elements;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (w < 0.1) return false;
    out[0] = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w * 0.5 + 0.5) * this.cssW;
    out[1] = (-(e[1] * x + e[5] * y + e[9] * z + e[13]) / w * 0.5 + 0.5) * this.cssH;
    out[2] = w;
    return true;
  }

  scaleAt(depth) { return this.cssH / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) / depth; }

  dispose() { this.renderer.dispose(); }
}

export { FOG_NEAR, FOG_FAR };
