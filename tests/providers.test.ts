import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

import { GET } from '../src/routes/config/providers.json/+server';

describe('GET /config/providers.json', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with the parsed JSON body in dev mode when the file exists', async () => {
    vi.stubEnv('DEV', true);
    const payload = { llm: { baseUrl: 'https://example.com' } };
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(payload));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns 404 in dev mode when the file is missing (readFileSync throws)', async () => {
    vi.stubEnv('DEV', true);
    vi.mocked(readFileSync).mockImplementation(() => {
      const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });

    const res = await GET();

    expect(res.status).toBe(404);
  });

  it('returns 404 in production mode without reading the file from disk', async () => {
    vi.stubEnv('DEV', false);

    const res = await GET();

    expect(res.status).toBe(404);
    expect(readFileSync).not.toHaveBeenCalled();
  });
});
