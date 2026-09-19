import { browser } from '$app/environment';
import { loadLocale } from 'wuchale/load-utils';
import { Langs, type SupportedUiLocale } from '$lib/i18n/langs';

import '../locales/main.loader.svelte.js';

export const ssr = false;

const SUPPORTED_LOCALES: ReadonlySet<string> = new Set<SupportedUiLocale>(['en', 'ja', 'zh', 'id']);

export async function load() {
  if (!browser) return;

  const resolved = Langs.ui();
  const locale = SUPPORTED_LOCALES.has(resolved) ? resolved : 'en';
  await loadLocale(locale);

  return { locale };
}
