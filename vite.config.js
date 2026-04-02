import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl()
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        preview: resolve(__dirname, 'preview.html')
      }
    }
  },
  server: {
    host: true, // Listen on all network interfaces
    port: 5173,
    https: true // Enable HTTPS
  }
});
