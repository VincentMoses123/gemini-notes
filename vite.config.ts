import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function cspPlugin(): Plugin {
  return {
    name: 'html-csp-transform',
    transformIndexHtml(html, { server }) {
      if (!server) {
        // Production build: replace with strict production CSP without dev hosts or unsafe-eval
        const prodCsp =
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self';";
        return html.replace(
          /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i,
          `<meta http-equiv="Content-Security-Policy" content="${prodCsp}" />`
        );
      }
      return html;
    },
  };
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
