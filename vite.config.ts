import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // GitHub Pages hosts this repository under /ENG-HUB/; local dev remains at /.
  base: mode === 'production' ? '/ENG-HUB/' : '/',
  plugins: [react()],
  server: { port: 5173 },
}));
