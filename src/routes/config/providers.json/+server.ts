import { json } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function GET() {
  if (!import.meta.env.DEV) {
    return new Response(null, { status: 404 });
  }

  const filePath = resolve(process.cwd(), 'config', 'providers.json');

  try {
    const data = readFileSync(filePath, 'utf-8');
    return json(JSON.parse(data));
  } catch {
    return new Response(null, { status: 404 });
  }
}
