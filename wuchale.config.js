// @ts-check
import { adapter } from '@wuchale/svelte';
import { defineConfig } from 'wuchale';

export default defineConfig({
  locales: ['en', 'ja', 'zh', 'id'],
  adapters: { main: adapter({ loader: 'sveltekit' }) },
});
