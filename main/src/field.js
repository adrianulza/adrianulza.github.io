// The network the visitor floats inside.
//
// Everything lives in one cube of side P that repeats in every direction, like
// a crystal lattice. The shaders redraw each point at the copy of it that is
// nearest the camera, and fog hides anything farther than P/2. So wherever the
// camera goes, the network surrounds it and never ends.

export const P = 36;          // period of the space, in world units
export const HALF = P / 2;

// Seeded random numbers, so the network is the same on every visit.
export function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 1831565813) >>> 0;
    let e = t;
    e = Math.imul(e ^ (e >>> 15), e | 1);
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// Shortest signed distance along one axis of the repeating space.
export const wrap = v => v - P * Math.round(v / P);

// A density field that also repeats with period P. Every wave has a whole
// number of wavelengths across the cube, so the field is seamless. Neurons
// gather where two of these fields are both near zero: that gives long
// filaments and thin sheets with voids between them, which the eye reads as
// scale, unlike a uniform soup of points.
function makeDensity(r) {
  const k = (2 * Math.PI) / P;
  const waves = () => Array.from({ length: 4 }, () => {
    let v;
    do v = [0, 1, 2].map(() => Math.round(r() * 4 - 2)); while (!v[0] && !v[1] && !v[2]);
    return { kx: v[0] * k, ky: v[1] * k, kz: v[2] * k, ph: r() * 6.283 };
  });
  const A = waves(), B = waves();
  const sum = (W, x, y, z) => { let s = 0; for (const w of W) s += Math.sin(w.kx * x + w.ky * y + w.kz * z + w.ph); return s / W.length; };
  return (x, y, z) => {
    const a = sum(A, x, y, z), b = sum(B, x, y, z);
    const filament = Math.exp(-(a * a + b * b) / 0.035);
    const sheet = Math.exp(-(a * a) / 0.02);
    return 0.03 + 0.72 * filament + 0.25 * sheet;
  };
}

// A spatial hash on the repeating grid, for nearest-neighbour searches.
function makeGrid(pos, count, cell) {
  const G = Math.round(P / cell), size = P / G, buckets = new Map();
  const idx = v => ((Math.floor((v + HALF) / size) % G) + G) % G;
  const key = (i, j, k) => (i * G + j) * G + k;
  for (let n = 0; n < count; n++) {
    const kk = key(idx(pos[n * 3]), idx(pos[n * 3 + 1]), idx(pos[n * 3 + 2]));
    let b = buckets.get(kk); if (!b) buckets.set(kk, b = []); b.push(n);
  }
  // All points within radius rad of (x, y, z), nearest first, as [dist, index].
  return (x, y, z, rad, skip = -1) => {
    const ci = idx(x), cj = idx(y), ck = idx(z), reach = Math.ceil(rad / size), out = [];
    for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) for (let c = -reach; c <= reach; c++) {
      const list = buckets.get(key((ci + a + G) % G, (cj + b + G) % G, (ck + c + G) % G));
      if (!list) continue;
      for (const n of list) {
        if (n === skip) continue;
        const d = Math.hypot(wrap(pos[n * 3] - x), wrap(pos[n * 3 + 1] - y), wrap(pos[n * 3 + 2] - z));
        if (d <= rad) out.push([d, n]);
      }
    }
    return out.sort((p, q) => p[0] - q[0]);
  };
}

export function buildField({ seed = 2026, spacing = 1.15, points = 110000, memoryCount = 7 }) {
  const r = rng(seed), density = makeDensity(r);

  // Landmarks: the core (About) sits at the origin, the seven memories around it
  // on a flattened shell, spread evenly by a Fibonacci spiral.
  const landmarks = [[0, 0, 0]];
  const turn = r() * 6.283;
  for (let i = 0; i < memoryCount; i++) {
    const y = 1 - (2 * (i + 0.5)) / memoryCount, rad = Math.sqrt(1 - y * y), th = turn + i * 2.39996;
    const R = 4.4 + r() * 1.4;
    landmarks.push([Math.cos(th) * rad * R, y * R * 0.62, Math.sin(th) * rad * R]);
  }
  const nearLandmark = (x, y, z, d) => landmarks.some(L => Math.hypot(wrap(x - L[0]), wrap(y - L[1]), wrap(z - L[2])) < d);

  // Neurons: evenly spread, so their wiring reads as a
  // calm, regular mesh. One neuron per cell of a grid, jittered inside its
  // cell (a cheap blue-noise pattern), with a faint trace of the density field.
  const G = Math.round(P / spacing), cs = P / G, cap = G * G * G;
  const tmp = new Float32Array(cap * 3);
  let n = 0;
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) for (let k = 0; k < G; k++) {
    const x = -HALF + (i + 0.15 + r() * 0.7) * cs, y = -HALF + (j + 0.15 + r() * 0.7) * cs, z = -HALF + (k + 0.15 + r() * 0.7) * cs;
    if (r() > 0.6 + 0.4 * Math.min(1, density(x, y, z) * 2)) continue;
    if (nearLandmark(x, y, z, spacing * 0.9)) continue;
    tmp.set([x, y, z], n * 3); n++;
  }
  const NN = n, total = NN + landmarks.length;
  const pos = new Float32Array(total * 3); pos.set(tmp.subarray(0, NN * 3));
  const visible = new Float32Array(total), hollow = new Float32Array(total), scatter = new Float32Array(total * 3);
  for (let i = 0; i < NN; i++) { visible[i] = 1; hollow[i] = r() < 0.45 ? 1 : 0; }
  landmarks.forEach((L, i) => pos.set(L, (NN + i) * 3));
  // Intro: every neuron starts out in a latent cloud, then condenses into place.
  const latent = out => { const u = r() * 2 - 1, th = r() * 6.283, q = Math.sqrt(1 - u * u), d = 2 + r() * 8; out[0] = q * Math.cos(th) * d; out[1] = u * d; out[2] = q * Math.sin(th) * d; return out; };
  const v3 = [0, 0, 0];
  for (let i = 0; i < total; i++) scatter.set(latent(v3), i * 3);

  // Wiring: each neuron links to its 3 nearest neurons.
  const maxLink = spacing * 2.6;
  const near = makeGrid(pos, total, maxLink);
  const edgesA = [], edgesB = [], seen = new Set();
  const link = (a, b) => {
    if (a === b) return;
    const k = a < b ? a * 100003 + b : b * 100003 + a;
    if (seen.has(k)) return; seen.add(k); edgesA.push(a); edgesB.push(b);
  };
  for (let i = 0; i < NN; i++)
    for (const [, j] of near(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], maxLink, i).filter(([, j]) => j < NN).slice(0, 3)) link(i, j);
  // Landmarks plug into the network.
  for (let li = 0; li < landmarks.length; li++) {
    const id = NN + li, L = landmarks[li];
    for (const [, j] of near(L[0], L[1], L[2], maxLink * 1.4, id).filter(([, j]) => j < NN).slice(0, li === 0 ? 5 : 3)) link(id, j);
  }

  // Each edge is stored as a midpoint plus a half-vector (both taken through the
  // shortest wrap), so the shader can wrap the midpoint and draw mid ± half.
  const E = edgesA.length;
  const mid = new Float32Array(E * 3), half = new Float32Array(E * 3), len = new Float32Array(E);
  const adj = Array.from({ length: total }, () => []);
  for (let e = 0; e < E; e++) {
    const a = edgesA[e], b = edgesB[e];
    const dx = wrap(pos[b * 3] - pos[a * 3]), dy = wrap(pos[b * 3 + 1] - pos[a * 3 + 1]), dz = wrap(pos[b * 3 + 2] - pos[a * 3 + 2]);
    mid.set([wrap(pos[a * 3] + dx / 2), wrap(pos[a * 3 + 1] + dy / 2), wrap(pos[a * 3 + 2] + dz / 2)], e * 3);
    half.set([dx / 2, dy / 2, dz / 2], e * 3);
    len[e] = Math.hypot(dx, dy, dz);
    adj[a].push(e); adj[b].push(e);
  }

  // A tract is the shortest path through the network from the core to a memory.
  // It is stored as a chain of points relative to the core, so it can be drawn
  // whole wherever the core's nearest copy happens to be.
  const core = NN;
  const tracts = [];
  for (let m = 1; m < landmarks.length; m++) {
    const target = NN + m, prev = new Int32Array(total).fill(-1), queue = [core];
    prev[core] = core;
    for (let q = 0; q < queue.length && prev[target] < 0; q++) {
      const a = queue[q];
      for (const e of adj[a]) {
        const b = edgesA[e] === a ? edgesB[e] : edgesA[e];
        if (prev[b] >= 0 || (b > NN && b !== target)) continue;
        prev[b] = a; queue.push(b);
      }
    }
    const nodes = [];
    for (let v = target; v !== core && v >= 0; v = prev[v]) nodes.push(v);
    nodes.push(core); nodes.reverse();
    const pts = [[0, 0, 0]];
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i], p = pts[i - 1];
      pts.push([p[0] + wrap(pos[b * 3] - pos[a * 3]), p[1] + wrap(pos[b * 3 + 1] - pos[a * 3 + 1]), p[2] + wrap(pos[b * 3 + 2] - pos[a * 3 + 2])]);
    }
    let L = 0; const cum = [0];
    for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); cum.push(L); }
    tracts.push({ nodes, pts, cum, length: L });
  }

  // Points: a fine scatter of unwired dots that gives the
  // space its texture. Every neuron sits on a point (so a hollow neuron shows
  // a dot in its centre, as in the original); the rest gather loosely around
  // neurons or drift free.
  const pts = new Float32Array(points * 3), pScatter = new Float32Array(points * 3);
  for (let i = 0; i < points; i++) {
    let x, y, z;
    if (i < NN) { x = pos[i * 3]; y = pos[i * 3 + 1]; z = pos[i * 3 + 2]; }
    else if (r() < 0.6) {
      const j = (r() * NN) | 0, s = spacing * 0.45;
      x = wrap(pos[j * 3] + gauss(r) * s); y = wrap(pos[j * 3 + 1] + gauss(r) * s); z = wrap(pos[j * 3 + 2] + gauss(r) * s);
    } else { x = (r() - 0.5) * P; y = (r() - 0.5) * P; z = (r() - 0.5) * P; }
    pts.set([x, y, z], i * 3);
    pScatter.set(latent(v3), i * 3);
  }

  return {
    neuronCount: NN, nodeCount: total, core, pos, visible, hollow, scatter,
    edgeCount: E, edgesA: Int32Array.from(edgesA), edgesB: Int32Array.from(edgesB), mid, half, len, adj,
    landmarks, tracts, points: pts, pointScatter: pScatter,
  };
}

// Rebuilds the edge lists per node after the field comes back from the worker.
export function attachAdjacency(f) {
  const adj = Array.from({ length: f.nodeCount }, () => []);
  for (let e = 0; e < f.edgeCount; e++) { adj[f.edgesA[e]].push(e); adj[f.edgesB[e]].push(e); }
  f.adj = adj;
  return f;
}
