import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

// @jm/ndi ist nativ → bleibt externalisiert (Laufzeit-require), wird NICHT
// gebündelt. @jm/app-runtime als Source-Workspace-Paket inline bündeln.
const internalPackages: string[] = ['@jm/app-runtime'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Entry des utilityProcess (nativer NDI-Sender) → out/main/ndi-sender.cjs.
          'ndi-sender': resolve(__dirname, 'src/utility/ndi-sender.ts'),
        },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: internalPackages })],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        ...sharedAlias,
      },
    },
    server: { host: true, port: 5184, strictPort: true },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
