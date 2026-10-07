// Colour modes. One object feeds both the WebGL shaders and the 2D overlay canvas,
// so every layer of the scene always agrees on colour.

export const MODES = {
  // The Ulzanism logo palette: charcoal ground, a mint to blue to cyan sweep
  // across the screen, and one red neuron where every thought begins.
  ulzanism: {
    ink: [255, 255, 255],
    grad: [[116, 240, 210], [90, 143, 220], [46, 216, 247]],
    red: [239, 79, 74],
    edge: 0.32,
    glow: 0.25,
    body: 1,
  },
  // Swiss black on grey.
  light: {
    ink: [17, 17, 17],
    grad: null,
    red: [214, 60, 56],
    edge: 0.22,
    glow: 0.09,
    body: 0.62,
  },
};

export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Colour at a horizontal position t in [0, 1]. Without a gradient, plain ink.
export function colourAt(mode, t) {
  const g = mode.grad;
  if (!g) return mode.ink;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const s = t < 0.5 ? 0 : 1, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const a = g[s], b = g[s + 1];
  return [a[0] + (b[0] - a[0]) * u | 0, a[1] + (b[1] - a[1]) * u | 0, a[2] + (b[2] - a[2]) * u | 0];
}

// A small lookup table so the overlay canvas does not rebuild colour strings for every dot.
export function colourTable(mode, steps = 48) {
  const out = [];
  for (let i = 0; i < steps; i++) out.push(colourAt(mode, i / (steps - 1)));
  return out;
}
