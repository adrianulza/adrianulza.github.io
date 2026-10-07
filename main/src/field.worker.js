// Builds the network off the main thread, so the page can paint and animate
// while about 20,000 neurons are placed and wired. The typed arrays are handed
// back without copying (transferred); the adjacency lists are rebuilt on the
// main thread from the edge arrays, which is quick.
import { buildField } from './field.js';

self.onmessage = e => {
  const f = buildField(e.data);
  delete f.adj;
  const transfer = ['pos', 'visible', 'hollow', 'scatter', 'edgesA', 'edgesB', 'mid', 'half', 'len', 'points', 'pointScatter'].map(k => f[k].buffer);
  self.postMessage(f, transfer);
};
