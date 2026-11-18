import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { autochessAssetsPlugin } from './scripts/vite-assets-plugin';

export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { hmr: { overlay: false } },
  plugins: [autochessAssetsPlugin({ quiet: true }), vinext()],
});
