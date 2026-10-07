import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes a normal static site.
// `npm run build:single` inlines everything into one HTML file for previews.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: { assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096 },
}));
