import { wrap } from './field.js';
import { colourTable, rgba } from './theme.js';
import { FOG_NEAR, FOG_FAR } from './scene.js';

// The 2D layer over the WebGL canvas, drawn in the same marks as the network:
//   signals    a 1.9 px head and a tail over the last 18% of the synapse
//   attention  the cursor links to the 18 nearest points within 130 px

const fogOf = d => 1 - Math.min(1, Math.max(0, (d - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));

export class Hud {
  constructor(canvas, field, scene) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.field = field; this.scene = scene;
    this.w = 1; this.h = 1; this.pr = 1;
    this.p = [0, 0, 0];
    this.sx = new Float32Array(field.nodeCount);
    this.sy = new Float32Array(field.nodeCount);
    this.sd = new Float32Array(field.nodeCount); // distance, 0 if not on screen
    this.marks = field.landmarks.map(() => ({ x: 0, y: 0, r: 0, dist: 0, visible: false, world: [0, 0, 0] }));
  }

  setMode(mode) { this.mode = mode; this.table = colourTable(mode); }
  col(x) { const t = this.table; return t[Math.max(0, Math.min(t.length - 1, (x / this.w * (t.length - 1)) | 0))]; }

  resize(pr) {
    const w = innerWidth, h = innerHeight;
    if (w === this.w && h === this.h && pr === this.pr) return;
    this.w = w; this.h = h; this.pr = pr;
    this.c.width = Math.round(w * pr); this.c.height = Math.round(h * pr);
  }

  near(x, y, z, cam, out) {
    out[0] = cam.x + wrap(x - cam.x); out[1] = cam.y + wrap(y - cam.y); out[2] = cam.z + wrap(z - cam.z);
    return out;
  }

  // Project neurons and landmarks once per frame, for picking and the overlay.
  projectAll(cam) {
    const f = this.field, P = f.pos, p = this.p, w3 = [0, 0, 0];
    for (let i = 0; i < f.neuronCount; i++) {
      this.near(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], cam, w3);
      const dist = Math.hypot(w3[0] - cam.x, w3[1] - cam.y, w3[2] - cam.z);
      if (dist > FOG_FAR - 1 || dist < 3.5 || !this.scene.project(w3[0], w3[1], w3[2], p) || p[0] < -20 || p[0] > this.w + 20 || p[1] < -20 || p[1] > this.h + 20) { this.sd[i] = 0; continue; }
      this.sx[i] = p[0]; this.sy[i] = p[1]; this.sd[i] = dist;
    }
    f.landmarks.forEach((L, i) => {
      const m = this.marks[i];
      this.near(L[0], L[1], L[2], cam, m.world);
      m.dist = Math.hypot(m.world[0] - cam.x, m.world[1] - cam.y, m.world[2] - cam.z);
      m.visible = this.scene.project(m.world[0], m.world[1], m.world[2], p) && m.dist < FOG_FAR && m.dist > 1;
      m.x = p[0]; m.y = p[1];
      // Projected radius of the orb, for sizing its HTML button.
      m.r = m.visible ? this.scene.scaleAt(p[2]) * (i === 0 ? 0.666 : 0.5) : 0;
    });
  }

  pick(x, y, maxPx = 90) {
    let best = -1, bd = maxPx;
    for (let i = 0; i < this.field.neuronCount; i++) {
      if (!this.sd[i]) continue;
      const d = Math.hypot(this.sx[i] - x, this.sy[i] - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  randomVisible(rand) {
    for (let k = 0; k < 60; k++) { const i = (rand() * this.field.neuronCount) | 0; if (this.sd[i] && this.sd[i] < FOG_NEAR + 3) return i; }
    return -1;
  }

  draw(cam, sim, st) {
    const { ctx, w, h, field, mode, p } = this;
    ctx.setTransform(this.pr, 0, 0, this.pr, 0, 0);
    ctx.clearRect(0, 0, w + 2, h + 2);
    const core = this.marks[0];
    const w3 = [0, 0, 0], a3 = [0, 0, 0];
    const net = st.net;
    // Reading mask for the 2D marks: fade anything under the open panel.
    const R = st.panelRect, mk = st.mask || 0;
    const under = (x, y) => (R && mk > 0 && x > R.left - 60 && x < R.right + 60 && y > R.top - 60 && y < R.bottom + 60 ? 1 - 0.9 * mk : 1);

    // Tracts: faint traces from the core to each work, red when that work is chosen.
    const tractPoint = (tr, d, out) => {
      let i = 1; while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
      const u = Math.min(1, Math.max(0, (d - tr.cum[i - 1]) / (tr.cum[i] - tr.cum[i - 1] || 1)));
      const A = tr.pts[i - 1], B = tr.pts[i];
      out[0] = core.world[0] + A[0] + (B[0] - A[0]) * u; out[1] = core.world[1] + A[1] + (B[1] - A[1]) * u; out[2] = core.world[2] + A[2] + (B[2] - A[2]) * u;
      return out;
    };
    field.tracts.forEach((tr, m) => {
      const hot = st.hover === m || st.selected === m;
      if (!hot) return;
      ctx.lineWidth = 1.4;
      let prev = null;
      for (const q of tr.pts) {
        const x = core.world[0] + q[0], y = core.world[1] + q[1], z = core.world[2] + q[2];
        if (!this.scene.project(x, y, z, p)) { prev = null; continue; }
        const cur = [p[0], p[1], fogOf(Math.hypot(x - cam.x, y - cam.y, z - cam.z)) * under(p[0], p[1])];
        if (prev) { ctx.strokeStyle = rgba(mode.red, 0.8 * Math.min(prev[2], cur[2]) * net); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke(); }
        prev = cur;
      }
    });

    // Attention: lines from the cursor to the nearest points (the hero samples every
    // second point and keeps the 18 closest within 130 px).
    if (st.pointer) {
      const { x, y } = st.pointer, P = field.points, n = P.length / 3, near = [];
      for (let i = 0; i < n; i += 3) {
        this.near(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], cam, w3);
        const dx = w3[0] - cam.x, dy = w3[1] - cam.y, dz = w3[2] - cam.z, dd = dx * dx + dy * dy + dz * dz;
        if (dd > FOG_NEAR * FOG_NEAR || dd < 12 || !this.scene.project(w3[0], w3[1], w3[2], p)) continue;
        const d = Math.hypot(p[0] - x, p[1] - y);
        if (d < 130) near.push([d, p[0], p[1]]);
      }
      near.sort((a, b) => a[0] - b[0]);
      ctx.lineWidth = 0.7;
      for (const [d, px, py] of near.slice(0, 18)) {
        ctx.strokeStyle = rgba(this.col(px), (1 - d / 130) * 0.7);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px, py); ctx.stroke();
      }
      ctx.strokeStyle = rgba(mode.ink, 0.9); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.283); ctx.stroke();
    }

    // Signals.
    for (const q of sim.pulses) {
      const e = q.e, s = field.edgesA[e] === q.from ? 1 : -1, u = q.t * 2 - 1, u2 = Math.max(0, q.t - 0.18) * 2 - 1;
      const hx = field.half[e * 3] * s, hy = field.half[e * 3 + 1] * s, hz = field.half[e * 3 + 2] * s;
      this.near(field.mid[e * 3], field.mid[e * 3 + 1], field.mid[e * 3 + 2], cam, w3);
      const x = w3[0] + hx * u, y = w3[1] + hy * u, z = w3[2] + hz * u;
      const fog = fogOf(Math.hypot(x - cam.x, y - cam.y, z - cam.z));
      if (fog < 0.02 || !this.scene.project(x, y, z, p)) continue;
      const X = p[0], Y = p[1], c = this.col(X), fg = fog * under(X, Y);
      ctx.fillStyle = rgba(c, 0.95 * fg);
      ctx.beginPath(); ctx.arc(X, Y, 1.9, 0, 6.283); ctx.fill();
      if (this.scene.project(w3[0] + hx * u2, w3[1] + hy * u2, w3[2] + hz * u2, a3)) {
        ctx.strokeStyle = rgba(c, 0.5 * fg); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(a3[0], a3[1]); ctx.lineTo(X, Y); ctx.stroke();
      }
    }
    // Thoughts routed along tracts toward a work.
    for (const q of sim.routed) {
      const tr = field.tracts[q.m], hot = st.hover === q.m || st.selected === q.m;
      tractPoint(tr, q.d, w3);
      const fog = fogOf(Math.hypot(w3[0] - cam.x, w3[1] - cam.y, w3[2] - cam.z));
      if (fog < 0.02 || !this.scene.project(w3[0], w3[1], w3[2], p)) continue;
      const X = p[0], Y = p[1], c = hot ? mode.red : this.col(X), fg = fog * under(X, Y);
      ctx.fillStyle = rgba(c, 0.95 * fg * net);
      ctx.beginPath(); ctx.arc(X, Y, 1.9, 0, 6.283); ctx.fill();
      tractPoint(tr, Math.max(0, q.d - 0.9), a3);
      if (this.scene.project(a3[0], a3[1], a3[2], a3)) {
        ctx.strokeStyle = rgba(c, 0.5 * fg * net); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(a3[0], a3[1]); ctx.lineTo(X, Y); ctx.stroke();
      }
    }

    // The core and the memories are 3D orbs now (orbs.js).
  }
}
