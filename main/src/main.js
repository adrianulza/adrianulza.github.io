import * as THREE from 'three';
import './styles.css';
import { person, memories, memoryIds, publications, books } from './data.js';
import { MODES } from './theme.js';
import { buildField, attachAdjacency } from './field.js';
import FieldWorker from './field.worker.js?worker&inline';
import { createSim } from './sim.js';
import { Scene } from './scene.js';
import { Hud } from './hud.js';
import { Orbs } from './orbs.js';
import { CameraRig, memoryPose, corePose } from './camera.js';
import { Overlay } from './overlay.js';
import { Panel } from './panel.js';

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

function boot() {
  const html = document.documentElement;
  if (!hasWebGL()) { html.classList.remove('js'); document.body.classList.add('static'); return; }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const isNarrow = () => innerWidth <= 700 || innerWidth / innerHeight < 0.8;
  const light = isNarrow() || coarse;
  const debug = new URLSearchParams(location.search).has('debug');

  // Device budget. Tier 0 is a capable desktop, tier 2 a phone; the adaptive
  // quality steps further down remain as a second safety net.
  const cores = navigator.hardwareConcurrency || 8, memory = navigator.deviceMemory || 8;
  let tier = light ? 2 : 0;
  if (tier === 0 && (cores <= 4 || memory <= 4)) tier = 1;
  const budget = [{ spacing: 1.15, points: 110000, cap: 1300 }, { spacing: 1.3, points: 70000, cap: 900 }, { spacing: 1.5, points: 40000, cap: 600 }][tier];
  let pixelRatio = Math.min(devicePixelRatio || 1, light ? 2 : 1.75);

  // The network, the scene and the 2D layer exist only once the worker replies.
  let field = null, sim = null, scene = null, hud = null, orbs = null, ready = false, readyAt = 0;
  let largestComponent = '';
  let coreHover = false, labelsDirty = true;

  // One look: the dark Ulzanism palette.
  const modeName = 'ulzanism';
  const applyMode = name => {
    html.dataset.mode = name;
    if (ready) { scene.setMode(MODES[name]); hud.setMode(MODES[name]); orbs.setMode(name); }
    labelsDirty = true;
  };
  applyMode(modeName);

  document.getElementById('fallback').hidden = true;
  window.__booted = true;
  const app = document.getElementById('app');
  app.hidden = false;

  const rig = new CameraRig({ narrow: isNarrow(), reduced });
  const veil = document.querySelector('[data-veil]');

  // ---------- state ----------
  let state = { kind: 'home' }, hover = null, paused = reduced, selected = null;
  let introDone = false, awake = false, woke = false, pendingRoute = null;
  const cellAppear = new Float32Array(memories.length), cellSent = new Uint8Array(memories.length);

  const panel = new Panel(document.getElementById('panel'), { person, memories, publications, books, root: html.dataset.root || '' }, {
    onNavigate: s => go(s), onClose: () => go({ kind: 'home' }),
  });
  const overlay = new Overlay(document.getElementById('overlay'), person, memories, {
    onHover: (k, it) => {
      if (!ready) return;
      if (k === null) { if (it.kind === 'core') coreHover = false; else if (hover === it.index) hover = null; return; }
      if (k >= 0) attend(k);
      else { coreHover = true; sim.fire(field.core, 3, true); }
    },
    onSelect: s => go(s),
  });

  // Attending a work, from its orb or its row in the list: the orb swells and a
  // thought travels to it along its red path.
  function attend(k) { hover = k; sim.send(k); sim.fire(field.neuronCount + 1 + k, 2, true); }

  // ---------- the works list (the scan path) ----------

  const worldOf = i => new THREE.Vector3(...hud.marks[i].world);

  function hashFor(s) { return s.kind === 'home' ? '' : s.kind === 'core' ? '#about' : `#${s.id}`; }
  function parseHash(h) {
    const id = decodeURIComponent(h.replace(/^#/, ''));
    if (id === 'about' || id === 'core') return { kind: 'core' };
    if (memoryIds.includes(id)) return { kind: 'memory', id };
    return { kind: 'home' };
  }

  // Move to a state: home, the core, or a memory.
  function go(next, push = true) {
    // Before the network has woken, remember the request and honour it later.
    if (!introDone) { pendingRoute = next; return; }
    if (push) {
      const url = location.pathname + location.search + hashFor(next);
      if (url !== location.pathname + location.search + location.hash) history.pushState(null, '', url);
    }
    state = next;
    document.body.classList.toggle('away', next.kind !== 'home');
    panel.hide();
    const narrow = isNarrow();
    const showPanel = reveal => (next.kind === 'core' ? panel.showCore(reveal) : panel.showMemory(next.id, reveal));
    const cut = fn => {
      // Reduced motion: no flight, a quick cut behind the veil.
      if (!reduced) return fn();
      veil.classList.add('on');
      setTimeout(() => { fn(); veil.classList.remove('on'); }, 260);
    };
    if (next.kind === 'home') { selected = null; cut(() => rig.home(false)); return; }
    let target;
    if (next.kind === 'core') { selected = 'core'; sim.fire(field.core, 6, true); target = corePose(worldOf(0), rig.pos, narrow); }
    else {
      const k = memoryIds.indexOf(next.id);
      selected = next.id; sim.send(k);
      target = memoryPose(worldOf(k + 1), worldOf(0), rig.pos, narrow);
    }
    // The panel is built near the start of the flight, while the camera is
    // still slow (after the old panel has faded), and slides in at 66%.
    let built = false, shown = false;
    cut(() => rig.goTo(target, {
      onProgress: t => {
        if (t >= 0.15 && !built) { built = true; showPanel(false); }
        if (t >= 0.66 && !shown) { shown = true; panel.reveal(); }
      },
      done: () => {
        if (!built) { built = true; showPanel(false); }
        if (!shown) { shown = true; panel.reveal(); }
        panel.focus();
      },
    }));
  }

  addEventListener('popstate', () => go(parseHash(location.hash), false));

  // The order used by the arrow keys while reading: About, then each work.
  const menuStates = [{ kind: 'core' }, ...memories.map(m => ({ kind: 'memory', id: m.id }))];

  // ---------- keys ----------
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (state.kind !== 'home') go({ kind: 'home' }); return; }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && state.kind !== 'home') {
      const i = panel.indexOf(state), n = menuStates.length;
      go(menuStates[(i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n]);
    }
  });

  // ---------- pointer: drag to orbit, click to think, wheel and pinch to travel ----------
  const canvas = document.getElementById('scene');
  const pointers = new Map();
  let down = null, pinch0 = 0;
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.vx = dx * 0.6 + (p.vx || 0) * 0.4; p.vy = dy * 0.6 + (p.vy || 0) * 0.4;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0) rig.dolly(pinch0 / d);
      pinch0 = d; return;
    }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
    if (down?.moved && rig.atHome) { rig.dragging = true; rig.drag(dx, dy); document.body.classList.add('grabbing'); }
  });
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, vx: 0, vy: 0 });
    pinch0 = 0;
    down = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: false } : null;
  });
  const up = e => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId); pinch0 = 0;
    document.body.classList.remove('grabbing');
    if (!p) return;
    if (rig.dragging) rig.release(p.vx, p.vy);
    if (down && !down.moved && e.type === 'pointerup') {
      // A click: on a phone with a panel open, it returns to the network.
      // Otherwise it starts a full thought from the nearest neuron.
      if (state.kind !== 'home' && isNarrow()) go({ kind: 'home' });
      else if (introDone && ready) {
        const i = hud.pick(e.clientX, e.clientY, 160);
        sim.fire(i >= 0 ? i : field.core, 10, true);
      }
    }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (rig.atHome) rig.dolly(Math.exp(e.deltaY * 0.0012));
  }, { passive: false });

  addEventListener('resize', () => { rig.setNarrow(isNarrow()); labelsDirty = true; });
  document.fonts?.ready.then(() => { labelsDirty = true; });

  // ---------- loop ----------
  let last = performance.now(), ambT = 0, frames = [], quality = 0, raf = 0, skip = 30;
  const intro = { condense: 0, wire: 0, panelRect: null, mask: 0 };
  let maskV = 0, lastPanel = null;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const ease = m => (m < 0.5 ? 4 * m ** 3 : 1 - (-2 * m + 2) ** 3 / 2);   // the hero's ease-in-out cubic

  // Before the scene exists, the nucleus is drawn in SVG exactly where the 3D
  // core will appear, using the same camera pose.
  const nucleusEl = document.querySelector('.nucleus');
  const probe = new THREE.PerspectiveCamera(60, 1, 0.05, 200), v = new THREE.Vector3();
  function placeNucleus(pose) {
    probe.fov = pose.fov; probe.aspect = innerWidth / innerHeight; probe.updateProjectionMatrix();
    probe.position.copy(pose.pos); probe.lookAt(pose.look); probe.updateMatrixWorld();
    v.set(0, 0, 0).project(probe);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    const depth = pose.pos.distanceTo(v.set(0, 0, 0));
    const pxPerUnit = innerHeight / (2 * Math.tan((pose.fov * Math.PI) / 360)) / depth;
    const size = (220 / 105) * 0.441 * pxPerUnit;   // outer ring of radius 1.05 × core scale 0.42
    nucleusEl.style.setProperty('--size', `${size}px`);
    nucleusEl.style.left = `${x - size / 2}px`; nucleusEl.style.top = `${y - size / 2}px`;
  }

  // The opening, in seconds after the network is ready (s):
  //   0 to 0.4    the 3D core takes over from the SVG nucleus
  //   0 to 2.4    points condense out of a latent cloud; wiring fades in over the last 30%
  //   2.4         the core fires its first thought
  //   2.5 + 0.12i each glass cell swells in as a signal is sent to it
  //   ~3.6        labels arrive; the site is awake
  const WAKE = 2.4, CELLS = 2.5, STAGGER = 0.12, AWAKE = CELLS + STAGGER * memories.length + 0.3;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const pose = rig.update(dt, { paused });
    if (!ready) { placeNucleus(pose); return; }

    const s = reduced ? 99 : (now - readyAt) / 1000;
    const m = clamp01(s / 2.4);
    intro.condense = ease(m);
    intro.wire = clamp01((m - 0.7) / 0.3);
    if (s > 0.15) nucleusEl.classList.add('gone');
    if (!woke && s >= WAKE) { woke = true; if (!reduced) sim.fire(field.core, 6, true); }
    for (let i = 0; i < memories.length; i++) {
      const t0 = CELLS + i * STAGGER;
      cellAppear[i] = reduced ? 1 : clamp01((s - t0) / 0.55);
      if (!cellSent[i] && s >= t0 && !reduced) { cellSent[i] = 1; sim.send(i); }
    }
    if (!awake && s >= AWAKE) {
      awake = introDone = true;
      document.body.classList.add('awake');
      const r = pendingRoute ?? parseHash(location.hash);
      pendingRoute = null;
      if (r.kind !== 'home') setTimeout(() => go(r, false), reduced ? 0 : 350);
    }

    // Reading mask: eases in as the panel opens and out as it closes; the last
    // rect is kept so the fade-out happens in the right place.
    const open = panel.open && panel.el.classList.contains('in');
    if (open) lastPanel = panel.el.getBoundingClientRect();
    maskV += ((open ? 1 : 0) - maskV) * Math.min(1, dt * 5);
    intro.panelRect = lastPanel; intro.mask = lastPanel ? maskV : 0;

    const cam = pose.pos;
    scene.update(pose, sim, intro);
    hud.resize(scene.pixelRatio);
    hud.projectAll(cam);

    if (!paused) {
      sim.step(dt, woke);
      // Quiet background life: a single small thought now and then.
      if (woke && (ambT += dt) > 2.2) { ambT = 0; const i = hud.randomVisible(sim.rand); if (i >= 0) sim.fire(i, 2); }
    }

    const sel = selected && selected !== 'core' ? memoryIds.indexOf(selected) : -1;
    orbs.update({
      marks: hud.marks, camera: scene.camera, t: now / 1000, dt, flash: sim.flash, coreIndex: field.core,
      memoryNodes: memories.map((_, i) => field.neuronCount + 1 + i),
      hover, selected: sel, coreHover,
      breath: 0.5 + 0.5 * Math.sin(now / 1000 * 0.9),
      coreAppear: clamp01(s / 0.4), cellAppear,
      pxScale: scene.scaleAt(1) * scene.pixelRatio,
      narrow: isNarrow(), panelRect: lastPanel, mask: intro.mask, still: paused,
    });
    scene.render();
    const panelRect = panel.open && !rig.flying ? panel.el.getBoundingClientRect() : null;
    hud.draw(cam, sim, {
      dt, net: intro.wire, hover, selected: sel, panelRect: lastPanel, mask: intro.mask,
    });
    if (labelsDirty) { overlay.measured = false; labelsDirty = false; }
    overlay.update(hud.marks, {
      quiet: state.kind !== 'home' || rig.flying, selectedId: selected, w: innerWidth, h: innerHeight,
      panelRect, intro: !awake,
      narrow: isNarrow(), hover,
    });

    // Adaptive quality: if the median frame is slow, step down once, then again.
    if (introDone && !paused && quality < 2 && skip-- <= 0) {
      frames.push(dt);
      if (frames.length >= 150) {
        const med = frames.sort((a, b) => a - b)[75]; frames = [];
        if (med > 0.02) {
          quality++;
          if (quality === 1) { pixelRatio = Math.max(1, pixelRatio * 0.8); scene.setPixelRatio(pixelRatio); }
          else { scene.setPixelRatio(1); pixelRatio = 1; scene.thinPoints(0.5); html.classList.add('lite'); }
        } else quality = 2;
      }
    }
    if (debug) window.__nn = { tier, edges: field.edgeCount, component: largestComponent, buildMs: buildMs | 0, dt, fired: sim.fired, pulses: sim.pulses.length, quality, pixelRatio, cam: cam.toArray() };
  }
  raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else { last = performance.now(); raf = requestAnimationFrame(frame); }
  });

  // ---------- build the network off the main thread ----------
  const opts = { seed: 2026, spacing: budget.spacing, points: budget.points, memoryCount: memories.length };
  const t0 = performance.now();
  let buildMs = 0;
  requestField(opts).then(f => {
    buildMs = performance.now() - t0;
    field = attachAdjacency(f);
    try { scene = new Scene(document.getElementById('scene'), field, { pixelRatio }); }
    catch (err) { console.warn(err); html.classList.remove('js'); document.body.classList.add('static'); app.hidden = true; document.getElementById('fallback').hidden = false; return; }
    sim = createSim(field, { cap: budget.cap });
    hud = new Hud(document.getElementById('hud'), field, scene);
    orbs = new Orbs(scene.scene, memories.map(m => m.glyph));
    ready = true; readyAt = performance.now();
    applyMode(modeName);
    if (debug) largestComponent = componentSize(field);
  });
}

// Runs buildField in a worker; falls back to the main thread if workers fail.
function requestField(opts) {
  return new Promise(resolve => {
    let w;
    try { w = new FieldWorker(); } catch { resolve(buildField(opts)); return; }
    w.onmessage = e => { resolve(e.data); w.terminate(); };
    w.onerror = e => { e.preventDefault?.(); w.terminate(); resolve(buildField(opts)); };
    w.postMessage(opts);
  });
}

// Size of the largest connected piece of the network (debug only).
function componentSize(f) {
  const seen = new Uint8Array(f.nodeCount);
  let best = 0;
  for (let s = 0; s < f.nodeCount; s++) {
    if (seen[s]) continue;
    let size = 0; const stack = [s]; seen[s] = 1;
    while (stack.length) { const a = stack.pop(); size++; for (const e of f.adj[a]) { const b = f.edgesA[e] === a ? f.edgesB[e] : f.edgesA[e]; if (!seen[b]) { seen[b] = 1; stack.push(b); } } }
    best = Math.max(best, size);
  }
  return `${best}/${f.nodeCount}`;
}

boot();
