import * as THREE from 'three';

// The camera rig. At home it orbits the red core from inside the network, slowly,
// with the network streaming past in every direction. Only a drag (mouse held
// down, or a finger) orbits it, with inertia; scroll or pinch moves nearer or
// farther. Simply moving the mouse never moves the camera. Choosing a memory
// flies the camera along a curved path to stand in front of it.

const V = () => new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Zero speed and zero acceleration at both ends, so a flight starts and lands
// without a jolt.
const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);

export class CameraRig {
  constructor({ narrow, reduced }) {
    this.narrow = narrow; this.reduced = reduced;
    this.pos = V(); this.look = V(); this.fov = 60;
    this.center = V();            // the point the orbit turns around (the core)
    this.theta = 0.6; this.phi = 0.18;
    this.radius = this.homeRadius;
    this.radiusTarget = this.radius;
    this.vTheta = 0; this.vPhi = 0;
    this.dragging = false; this.lastInput = -10;
    this.flight = null;
    this.rest = null;             // when away: { pos, look, fov }
    this.restT = 0;               // when the camera arrived at its rest
    this.time = 0;
    this.swingT = 0;              // clock for the slow sway
    this.yawOff = 0;
    this.home(true);
  }

  get homeRadius() { return this.narrow ? 10.5 : 8.6; }
  get homeFov() { return this.narrow ? 68 : 60; }
  get flying() { return !!this.flight; }
  get atHome() { return !this.rest && !this.flight; }

  setNarrow(n) { this.narrow = n; if (this.atHome) this.radiusTarget = this.homeRadius; }

  drag(dx, dy) {
    this.vTheta = -dx * 0.0052; this.vPhi = dy * 0.0042;
    this.theta += this.vTheta; this.phi = clamp(this.phi + this.vPhi, -1.05, 1.05);
    this.lastInput = this.time;
  }
  release(vx, vy) { this.vTheta = -vx * 0.0052; this.vPhi = vy * 0.0042; this.dragging = false; }

  dolly(factor) {
    this.radiusTarget = clamp(this.radiusTarget * factor, 3.5, this.narrow ? 13 : 12);
    this.lastInput = this.time;
  }

  orbitPose(outPos, outLook) {
    const r = this.radius, th = this.theta + this.yawOff, ph = clamp(this.phi, -1.2, 1.2);
    outPos.set(
      this.center.x + Math.cos(th) * Math.cos(ph) * r,
      this.center.y + Math.sin(ph) * r,
      this.center.z + Math.sin(th) * Math.cos(ph) * r,
    );
    // The core sits at the centre of the screen.
    outLook.copy(this.center);
    return outPos;
  }

  // Fly along a cubic Bezier to { pos, look, fov }. The path arcs sideways so
  // the trip reads as travel through the network, not a zoom.
  fly(target, { instant = false, onProgress, done } = {}) {
    if (instant || this.reduced) {
      this.pos.copy(target.pos); this.look.copy(target.look); this.fov = target.fov;
      this.flight = null; onProgress?.(1); done?.(); return;
    }
    const p0 = this.pos.clone(), p3 = target.pos.clone(), dist = p0.distanceTo(p3);
    const dir = p3.clone().sub(p0), side = new THREE.Vector3(0, 1, 0).cross(dir).normalize().multiplyScalar(dist * 0.14);
    const lift = new THREE.Vector3(0, dist * 0.06, 0);
    this.flight = {
      p0, p1: p0.clone().addScaledVector(dir, 0.33).add(side).add(lift), p2: p0.clone().addScaledVector(dir, 0.7).add(side.multiplyScalar(0.5)), p3,
      l0: this.look.clone(), l1: target.look.clone(), f0: this.fov, f1: target.fov,
      t: 0, dur: clamp(1.7 + dist * 0.06, 1.9, 3), onProgress, done,
    };
  }

  // Leave home for a resting pose (a memory or the core).
  goTo(target, opts) { this.rest = target; this.fly(target, opts); }

  // Return to the orbit, starting from wherever the camera is now.
  home(instant = false, opts = {}) {
    this.rest = null;
    const off = this.pos.clone().sub(this.center);
    if (off.lengthSq() > 1) {
      this.theta = Math.atan2(off.z, off.x) - this.yawOff;
      this.phi = clamp(Math.asin(clamp(off.y / off.length(), -1, 1)), -0.6, 0.6);
    }
    this.radius = this.radiusTarget = this.homeRadius;
    const pos = V(), look = V();
    this.orbitPose(pos, look);
    this.fly({ pos, look, fov: this.homeFov }, { instant, ...opts });
  }

  update(dt, { paused }) {
    this.time += dt;

    if (this.flight) {
      // One eased clock drives position, gaze and lens together, so the turn
      // of the head never runs ahead of the travel.
      const F = this.flight;
      F.t = Math.min(1, F.t + dt / F.dur);
      const u = smootherstep(F.t), v = 1 - u;
      this.pos.set(0, 0, 0)
        .addScaledVector(F.p0, v * v * v).addScaledVector(F.p1, 3 * v * v * u)
        .addScaledVector(F.p2, 3 * v * u * u).addScaledVector(F.p3, u * u * u);
      this.look.lerpVectors(F.l0, F.l1, u);
      this.fov = F.f0 + (F.f1 - F.f0) * u + Math.sin(Math.PI * u) * 3;
      F.onProgress?.(F.t);
      if (F.t >= 1) { this.flight = null; this.restT = this.time; F.done?.(); }
      return this.pose();
    }

    if (this.rest) {
      // Resting in front of a memory: a slow breath of drift that fades in
      // over 2.5 s after landing, so the arrival never jumps.
      const R = this.rest, t = this.time - this.restT;
      const a = smootherstep(clamp(t / 2.5, 0, 1));
      this.pos.copy(R.pos).add(new THREE.Vector3(Math.sin(t * 0.21) * 0.12 * a, Math.sin(t * 0.17) * 0.08 * a, 0));
      this.look.copy(R.look);
      this.fov = R.fov;
      return this.pose();
    }

    // Home: the view sways slowly from side to side (yaw = sin(t * 0.16) * 0.85).
    // A drag turns the whole orbit and keeps some inertia.
    if (!this.dragging) {
      const decay = Math.exp(-dt / 0.35);
      this.vTheta *= decay; this.vPhi *= decay;
      this.theta += this.vTheta; this.phi = clamp(this.phi + this.vPhi, -1.05, 1.05);
    }
    if (!paused && !this.reduced) this.swingT += dt;
    this.yawOff = this.reduced ? 0 : Math.sin(this.swingT * 0.16) * 0.85;
    this.radius += (this.radiusTarget - this.radius) * Math.min(1, dt * 4);
    this.orbitPose(this.pos, this.look);
    this.fov = this.homeFov;
    return this.pose();
  }

  pose() { return { pos: this.pos, look: this.look, fov: this.fov }; }
}

// Where to stand to look at a memory: outside it, facing back toward the core,
// a little to the visitor's side, with the gaze shifted so the panel has room.
export function memoryPose(world, center, from, narrow) {
  const out = world.clone().sub(center).normalize();
  const toCam = from.clone().sub(world).normalize();
  const dir = out.multiplyScalar(1).addScaledVector(toCam, 0.7).normalize();
  const pos = world.clone().addScaledVector(dir, narrow ? 4.6 : 3.8);
  return withShift(pos, world, narrow ? 52 : 44, narrow ? [0, 1.05] : [1.2, 0]);
}

export function corePose(center, from, narrow) {
  const dir = from.clone().sub(center).normalize();
  const pos = center.clone().addScaledVector(dir, narrow ? 6.2 : 5.2);
  return withShift(pos, center, narrow ? 58 : 50, narrow ? [0, 1.3] : [1.6, 0]);
}

// Shift the gaze so the subject sits beside the panel (desktop) or above the
// bottom sheet (phone), instead of under it.
function withShift(pos, subject, fov, [sx, sy]) {
  const fwd = subject.clone().sub(pos).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd);
  const look = subject.clone().addScaledVector(right, -sx).addScaledVector(up, -sy);
  return { pos, look, fov };
}
