# Inside the network

The source of my website. It places the visitor **inside** an endless neural
network drawn in the Ulzanism style: a charcoal background, a mint to blue to
cyan gradient across the screen, hollow and filled neurons, signal pulses with
tails, and one red origin neuron where every thought begins. Each of my works
is a memory in the network, and the core is me.

## How the endless space works

The whole network lives in a single cube of side `P = 36` that repeats in
every direction, like a crystal lattice (`src/field.js`). The vertex shaders
draw each point at the copy of it that is nearest the camera:

```glsl
vec3 r = p - uCam;
r -= uP * floor(r / uP + 0.5);   // shortest vector to the nearest copy
```

Fog fades everything to nothing between 7.5 and 16.5 units away. That is
less than `P / 2 = 18`, so the place where a point jumps from one copy to the next
is never visible. Wherever the camera goes, the network surrounds it, and it
never reaches an edge.

Neurons are spread evenly (one per
cell of a jittered grid) and each links to its 3 nearest, so the wiring reads
as a calm triangulated mesh. Neurons are 1.6 to 4 px in radius, 45% of them
1.1 px rings with a point at the centre. A separate layer of unwired points
(0.9 to 2.2 px squares) gives the texture. Sizes depend on depth only, never on
true perspective, and marks closer than a few units fade out, so the mesh keeps
the same scale on screen.

## Files

| File | Role |
| --- | --- |
| `src/data.js` | All content: profile, works, publications, books |
| `src/theme.js` | The Ulzanism palette (the site is dark only) |
| `src/field.js` | The repeating network, its wiring, and the tracts from the core to each memory |
| `src/sim.js` | Firing, pulses and cascades |
| `src/scene.js` | WebGL points, neurons and synapses |
| `src/hud.js` | The 2D layer: pulses, tracts, attention lines |
| `src/orbs.js` | The landmark orbs: the nucleus for the core, glass cells with 3D figures for the works |
| `src/camera.js` | Orbit, drag with inertia, scroll or pinch to travel, curved flights |
| `src/overlay.js`, `src/panel.js` | The labels and the reading panel |
| `src/main.js` | Boot, routing (`#about`, `#<work-id>`), keys, adaptive quality |

## Run and build

```sh
npm install
npm run dev            # local development
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/
```

Add `?debug` to the URL to expose frame stats on `window.__nn`.
