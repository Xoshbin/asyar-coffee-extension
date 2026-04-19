import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: /^asyar-sdk$/, replacement: resolve(__dirname, '../../asyar-sdk/src/index.ts') },
    ],
  },
});
