import { defineConfig } from 'vitest/config';

import adapterBun from '@sveltejs/adapter-bun';
import adapterStatic from '@sveltejs/adapter-static';
import tailwindcss from '@tailwindcss/vite';

import { wuchale } from 'wuchale/vite';
import { sveltekit } from '@sveltejs/kit/vite';

import { playwright } from '@vitest/browser-playwright';

const adapter = typeof globalThis.Bun === 'object' ? adapterBun() : adapterStatic({ fallback: 'index.html' });

export default defineConfig({
  server: { allowedHosts: ['localhost', '.local'] },

  build: {
    chunkSizeWarningLimit: 1000,
  },

  plugins: [
    wuchale(),
    tailwindcss(),
    sveltekit({
      adapter,
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
      },
      alias: { $components: 'src/components/*' },
    }),
  ],

  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', headless: true }],
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
        },
      },

      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
        },
      },
    ],
  },
});
