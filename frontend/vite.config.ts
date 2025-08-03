import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  logLevel: 'info',
  build: {
    rollupOptions: {
      output: {
        format: 'umd',
      },
    },
  },
  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    headers: {
      'Transfer-Encoding': 'chunked',
    },
  },
})