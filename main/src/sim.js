// Signals. A neuron that fires sends pulses along its edges, and each pulse
// fires the neuron it arrives at, one generation fewer. So a click becomes a
// cascade, and the cursor becomes attention.

export function createSim(field, { cap = 700, seed = 7 } = {}) {
  let s = seed >>> 0;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const flash = new Float32Array(field.nodeCount);
  const memLit = new Float32Array(field.tracts.length);
  const pulses = [];   // { e, from, t, dur, gen }
  const routed = [];   // { m, d } : distance d travelled along tract m
  const sim = { flash, memLit, pulses, routed, fired: 0, cap, rand };

  sim.fire = (a, gen, force = false) => {
    if (flash[a] > 0.45 && !force) return;
    flash[a] = 1; sim.fired++;
    if (gen <= 0) return;
    const adj = field.adj[a], chance = 0.78; // firing chance per edge
    for (const e of adj) {
      if (pulses.length >= cap) break;
      if (rand() < chance) pulses.push({ e, from: a, t: 0, dur: 0.22 + field.len[e] * 0.07, gen: gen - 1 });
    }
  };

  // A thought sent from the core to one memory along its tract.
  sim.send = m => { if (routed.length < 40) routed.push({ m, d: 0 }); };

  // The rhythm: one thought at a time. Every 3.6 s the core fires a small burst
  // and sends a thought to the next work in turn, so the motion tells one story
  // (from the origin to the work) instead of flickering everywhere.
  let coreT = 1.4, next = 0;

  sim.step = (dt, ambient = true) => {
    for (let i = 0; i < flash.length; i++) if (flash[i] > 0) flash[i] = Math.max(0, flash[i] - dt * 1.6);
    for (let i = 0; i < memLit.length; i++) if (memLit[i] > 0) memLit[i] = Math.max(0, memLit[i] - dt * 0.9);

    if (ambient) {
      if ((coreT -= dt) <= 0) {
        coreT = 3.6;
        sim.fire(field.core, 2, true);
        sim.send(next); next = (next + 1) % field.tracts.length;
      }
    }

    for (let i = pulses.length - 1; i >= 0; i--) {
      const q = pulses[i];
      q.t += dt / q.dur;
      if (q.t >= 1) {
        const to = field.edgesA[q.e] === q.from ? field.edgesB[q.e] : field.edgesA[q.e];
        pulses[i] = pulses[pulses.length - 1]; pulses.pop();
        sim.fire(to, q.gen);
      }
    }
    for (let i = routed.length - 1; i >= 0; i--) {
      const q = routed[i], tr = field.tracts[q.m];
      q.d += dt * 7;
      if (q.d >= tr.length) { memLit[q.m] = 1; flash[tr.nodes[tr.nodes.length - 1]] = 1; routed.splice(i, 1); }
    }
  };

  return sim;
}
