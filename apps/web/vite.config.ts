import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { verificarSecretos } from './verificar-secretos.ts';

export default defineConfig({
  plugins: [verificarSecretos(), react()],
  // El motor vive fuera de apps/web y usa imports con extension .ts.
  server: { fs: { allow: ['..', '../..'] } },
  build: { outDir: 'dist', sourcemap: true },
});
