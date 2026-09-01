import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // El motor vive fuera de apps/web y usa imports con extension .ts.
  server: { fs: { allow: ['..', '../..'] } },
  build: { outDir: 'dist', sourcemap: true },
});
