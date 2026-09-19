import { browser } from '$app/environment';
import { loadLocale } from 'wuchale/load-utils';

import '../locales/main.loader.svelte.js';

export const ssr = false;

export async function load() {
  if (!browser) return;

  const locale = 'en';
  await loadLocale(locale);

  return { locale };
}
