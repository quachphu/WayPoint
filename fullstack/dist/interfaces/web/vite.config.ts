import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { waypointServer } from './backend/plugin';

// One process serves everything: the React frontend plus Waypoint's own
// backend (see backend/plugin.ts) — no MindStudio platform involved.
export default defineConfig({
  plugins: [react(), tailwindcss(), waypointServer()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    allowedHosts: true,
  },
});
