import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Относительные пути обязательны: в Android-сборке (Capacitor) страница
  // грузится с file:// или https://localhost, абсолютный /assets/... не найдётся.
  base: './',
  build: { outDir: 'dist' },
  server: { host: true, port: 5173 },
});
