import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  resolve: {
    alias: {
      // next/dynamic → Vite 互換の React.lazy ベース shim に差し替え
      'next/dynamic': path.resolve(__dirname, 'src/shims/next-dynamic.tsx'),
    },
  },
});
